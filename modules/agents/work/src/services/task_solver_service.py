"""
Task Solver AI Service

Provides contextual AI assistance for individual tasks:
- Conversational Q&A about the task
- Quick actions (suggest approach, break down, estimate time, identify blockers)
- Tool calling for progressive disclosure (read attachments, search tasks, etc.)
- Streaming responses via LangChain ChatOpenAI (reuses vLLM backend)

Architecture: Hybrid context + Manual Tool Calling Loop
- Level 0 (always preloaded): task metadata, comments, attachment metadata
- Level 1 (LLM calls on demand): ReadAttachment, SearchRelatedTasks, GetTaskDetails
- Max 3 tool-calling rounds, then stream final answer
- Fallback to direct response if tool calling fails
"""

import os
import asyncio
import logging
from typing import List, Optional, Dict, Any, AsyncIterator

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage

from modules.tools.solver import SOLVER_TOOLS

logger = logging.getLogger(__name__)

# vLLM configuration (same env vars as email_ai_service)
VLLM_API_BASE = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
VLLM_MODEL = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")

# Module-level singleton LLM — streaming, for final response output.
_solver_llm = ChatOpenAI(
    model=VLLM_MODEL,
    openai_api_base=VLLM_API_BASE,
    openai_api_key="EMPTY",
    temperature=0.4,
    max_tokens=1536,
    streaming=True,
    request_timeout=90.0,
)

# Non-streaming LLM with tools bound — used for tool-calling detection loop.
_solver_llm_with_tools = ChatOpenAI(
    model=VLLM_MODEL,
    openai_api_base=VLLM_API_BASE,
    openai_api_key="EMPTY",
    temperature=0.4,
    max_tokens=1536,
    streaming=False,
    request_timeout=90.0,
).bind_tools(SOLVER_TOOLS, tool_choice="auto")

# Max conversation history messages to send to LLM (prevents context overflow)
MAX_HISTORY_MESSAGES = 20

# Tool calling limits
MAX_TOOL_ROUNDS = 3
MAX_TOOL_OUTPUT = 3000

# Pre-built tool lookup map — avoids rebuilding on every _execute_tool call
_TOOL_MAP = {t.name: t for t in SOLVER_TOOLS}

# Quick action prompts — keyed by action type
QUICK_ACTIONS: Dict[str, Dict[str, str]] = {
    "suggest_approach": {
        "label": "Suggest Approach",
        "prompt": "Suggest a practical, step-by-step approach to complete this task. Be specific and actionable.",
    },
    "break_down": {
        "label": "Break Down",
        "prompt": "Break this task down into smaller, manageable sub-tasks. List them as a numbered checklist.",
    },
    "estimate_time": {
        "label": "Estimate Time",
        "prompt": "Estimate how long this task will take. Provide a range (optimistic, realistic, pessimistic) and explain the key factors affecting duration.",
    },
    "identify_blockers": {
        "label": "Identify Blockers",
        "prompt": "Identify potential blockers, risks, or dependencies for this task. Suggest how to mitigate each one.",
    },
}


def build_task_context(task) -> str:
    """
    Build a concise context string from a Todo model instance.
    Includes Level 0 data: metadata + comments (small) + attachment metadata (no content).
    """
    parts = [f"Task ID: {task.id}", f"Title: {task.title}"]

    if task.ai_summary:
        bullets = task.ai_summary if isinstance(task.ai_summary, list) else []
        if bullets:
            parts.append("AI Summary:\n" + "\n".join(f"  - {b}" for b in bullets))

    if task.description and not task.ai_summary:
        parts.append(f"Description: {task.description[:500]}")

    parts.append(f"Status: {task.status or 'none'}")
    parts.append(f"Priority: {task.priority or 'none'}")

    if task.due_date:
        parts.append(f"Due Date: {task.due_date.strftime('%Y-%m-%d')}")

    if task.category:
        parts.append(f"Category: {task.category}")

    if task.ai_priority_reasoning:
        parts.append(f"AI Priority Reasoning: {task.ai_priority_reasoning}")

    if task.ai_estimated_minutes:
        parts.append(f"Estimated Duration: {task.ai_estimated_minutes} minutes")

    # Level 0: preload comments (small data)
    if hasattr(task, 'comments') and task.comments:
        comment_lines = []
        for c in task.comments[:10]:
            date_str = c.created_at.strftime('%Y-%m-%d %H:%M') if c.created_at else ''
            comment_lines.append(f"  [{date_str}]: {c.content[:200]}")
        parts.append("Comments:\n" + "\n".join(comment_lines))

    # Level 0: attachment metadata only (content via ReadAttachment tool)
    if hasattr(task, 'attachments') and task.attachments:
        from modules.tools.common.file_readers import SUPPORTED_TYPES
        att_lines = []
        for a in task.attachments:
            size_str = f"{a.file_size} bytes" if a.file_size else "unknown size"
            readable = (a.file_type or '').lower().strip('.') in SUPPORTED_TYPES
            label = "readable" if readable else "image/binary, not readable"
            att_lines.append(f"  - [ID:{a.id}] {a.original_filename} ({a.file_type}, {size_str}, {label})")
        parts.append("Attachments (use ReadAttachment tool to read text-based files only):\n" + "\n".join(att_lines))

    return "\n".join(parts)


SYSTEM_PROMPT = """\
You are a helpful AI task assistant. You help users understand, plan, and solve their tasks.

You have context about the user's current task below. Use this context to provide relevant, specific advice.

=== TASK CONTEXT ===
{task_context}
=== END CONTEXT ===

You have access to tools that require specific IDs. The current task's ID is shown as "Task ID:" in the context above.
- ReadAttachment(attachment_id): Read text content of an attachment by its ID (shown in brackets like [ID:3]). Only works for text-based files (PDF, TXT, DOCX, CSV, MD, JSON). Do NOT call this for image files (PNG, JPG, GIF) — they are not readable as text.
- GetTaskComments(task_id): Get all comments on a task. For the current task, use the Task ID from the context above.
- SearchRelatedTasks(query): Search for related tasks by keyword.
- GetTaskDetails(task_id): Get full details of another task by ID.

Guidelines:
- Be concise and actionable
- Reference specific details from the task context
- When calling tools that need task_id for the current task, always use the Task ID shown in the context
- If the task has readable attachments and the user asks about them, use ReadAttachment with the attachment ID. Skip image/binary files marked as "not readable"
- The context above already includes a summary of comments and attachment metadata — only call tools when you need MORE detail than what's shown
- Provide practical advice, not generic platitudes"""


def build_solver_messages(
    task_context: str,
    conversation_history: List[Dict[str, str]],
    user_message: str,
    quick_action: Optional[str] = None,
) -> list:
    """
    Build LangChain message list for the solver conversation.
    """
    messages = [SystemMessage(content=SYSTEM_PROMPT.format(task_context=task_context))]

    # Add conversation history (truncate to last N messages to prevent context overflow)
    recent_history = conversation_history[-MAX_HISTORY_MESSAGES:] if len(conversation_history) > MAX_HISTORY_MESSAGES else conversation_history
    for msg in recent_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))

    # Current message — use quick action prompt if provided
    if quick_action and quick_action in QUICK_ACTIONS:
        content = QUICK_ACTIONS[quick_action]["prompt"]
    else:
        content = user_message

    messages.append(HumanMessage(content=content))
    return messages


def _execute_tool(tool_call: dict, user_id: int, current_task_id: Optional[int] = None) -> str:
    """Execute a single tool call, injecting user_id for access control."""
    tool_name = tool_call["name"]
    tool_args = dict(tool_call.get("args", {}))
    tool_args["user_id"] = user_id  # Server-side injection

    # For GetTaskComments: override task_id with the current task's ID
    # to prevent LLM from guessing wrong IDs
    if tool_name == "GetTaskComments" and current_task_id is not None:
        tool_args["task_id"] = current_task_id

    if tool_name not in _TOOL_MAP:
        return f"Error: Unknown tool '{tool_name}'"
    try:
        result = _TOOL_MAP[tool_name].invoke(tool_args)
        # ReadAttachment handles its own compression (LLM summary + cache),
        # so skip redundant hard truncation for it.
        if tool_name != "ReadAttachment" and len(result) > MAX_TOOL_OUTPUT:
            result = result[:MAX_TOOL_OUTPUT] + "\n[... truncated]"
        return result
    except Exception as e:
        return f"Error executing {tool_name}: {str(e)}"


async def stream_solver_response(
    task,
    user_message: str,
    conversation_history: List[Dict[str, str]],
    quick_action: Optional[str] = None,
    user_id: Optional[int] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """
    Stream AI solver response with tool calling support.

    Two-phase architecture:
    1. Tool-calling loop (non-streaming): detect and execute tools, max 3 rounds
    2. Final response (streaming): stream the LLM's answer to the user

    Yields:
        {"type": "tool_call", "name": "...", "args": {...}} when calling a tool
        {"type": "tool_result", "name": "...", "preview": "..."} after tool execution
        {"type": "token", "content": "..."} for each streamed token
        {"type": "complete", "content": "full response"} at the end
        {"type": "tool_error", "content": "..."} on tool subsystem failure (before fallback)
        {"type": "error", "content": "..."} on complete failure
    """
    try:
        task_context = build_task_context(task)
        messages = build_solver_messages(
            task_context, conversation_history, user_message, quick_action
        )

        # Phase 1: Tool-calling loop (non-streaming)
        tool_rounds = 0
        used_tools = False
        response = None

        while tool_rounds < MAX_TOOL_ROUNDS:
            response = await _solver_llm_with_tools.ainvoke(messages)

            if not response.tool_calls:
                break  # No tool calls — proceed to Phase 2

            used_tools = True
            # Append the AIMessage ONCE (it contains all tool_calls for this round)
            messages.append(response)

            loop = asyncio.get_running_loop()
            for tc in response.tool_calls:
                yield {"type": "tool_call", "name": tc["name"], "args": tc.get("args", {})}

                current_task_id = task.id if hasattr(task, 'id') else None
                result = await loop.run_in_executor(
                    None, _execute_tool, tc, user_id or 1, current_task_id
                )

                yield {"type": "tool_result", "name": tc["name"], "preview": result[:200]}

                messages.append(ToolMessage(content=result, tool_call_id=tc["id"]))

            tool_rounds += 1

        # Phase 2: Stream final response
        # Always use the streaming LLM for the final answer — whether tools were
        # called or not.  When no tools were needed, discard the non-streaming
        # response (it was only used for tool-call detection) and re-stream with
        # _solver_llm so the client receives true token-by-token output.
        if used_tools:
            # After tool rounds, the non-streaming response contained tool_calls
            # (already appended to messages).  Stream a fresh answer that
            # incorporates the tool results.
            pass  # messages already have tool context — fall through to stream
        elif response is not None:
            # No tools called — the non-streaming LLM already produced a final
            # answer, but it arrived all-at-once.  Drop it and re-stream so the
            # client sees real incremental tokens.  (The re-invocation is cheap:
            # the prompt is already assembled and vLLM KV-cache usually hits.)
            pass  # fall through to stream with same messages

        full_response = ""
        async for chunk in _solver_llm.astream(messages):
            chunk_content = chunk.content if hasattr(chunk, "content") else str(chunk)
            if chunk_content:
                full_response += chunk_content
                yield {"type": "token", "content": chunk_content}
        yield {"type": "complete", "content": full_response}

    except Exception as e:
        logger.error(f"Tool calling failed: {e}, falling back to direct response")
        yield {"type": "tool_error", "content": str(e)}

        # Fallback: direct response without tools
        try:
            fallback_context = build_task_context(task)
            fallback_messages = build_solver_messages(
                fallback_context, conversation_history, user_message, quick_action
            )
            full_response = ""
            async for chunk in _solver_llm.astream(fallback_messages):
                chunk_content = chunk.content if hasattr(chunk, "content") else str(chunk)
                if chunk_content:
                    full_response += chunk_content
                    yield {"type": "token", "content": chunk_content}
            yield {"type": "complete", "content": full_response}
        except Exception as fallback_err:
            logger.error(f"Fallback also failed: {fallback_err}")
            yield {"type": "error", "content": f"AI service error: {str(fallback_err)}"}
