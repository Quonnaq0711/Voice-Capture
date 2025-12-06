"""
vLLM Chat Service Implementation

This module implements the chat service using vLLM's OpenAI-compatible API.
vLLM provides high-performance LLM inference with PagedAttention and continuous batching.

Performance Benefits:
- 2-5x faster inference compared to Ollama
- 5-10x better concurrent request handling
- More efficient GPU memory utilization
- Support for larger batch sizes

Supported Models:
- Qwen/Qwen2.5-3B-Instruct (Recommended, ~7GB VRAM)
- Qwen/Qwen2.5-7B-Instruct (~14GB VRAM)
- mistralai/Mistral-7B-Instruct-v0.3 (~14GB VRAM)
- meta-llama/Meta-Llama-3-8B-Instruct (~16GB VRAM)
- Any HuggingFace model compatible with vLLM
"""

import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langchain_core.chat_history import BaseChatMessageHistory, InMemoryChatMessageHistory
from typing import Dict, List, Optional, AsyncIterator, Any
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
import httpx
import json
import re
import tiktoken
from sqlalchemy.orm import Session
from backend.db.database import SessionLocal
from backend.utils.db_session import get_db_session
from backend.models.chat import ChatMessage
from backend.models.profile import UserProfile
from backend.models.user import User
from backend.models.daily_recommendation import DailyRecommendation
from prompts import FOLLOW_UP_PROMPT
from base_chat_service import BaseChatService
from backend.models.career_insight import CareerInsight

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ChatServiceVLLM(BaseChatService):
    """
    vLLM-based chat service implementation.

    Uses vLLM's OpenAI-compatible API through LangChain's ChatOpenAI interface.
    Provides the same functionality as Ollama service but with significantly better performance.

    Key Features:
    - OpenAI-compatible API (easy integration)
    - PagedAttention for efficient memory usage
    - Continuous batching for high throughput
    - Streaming response support
    - Session-based conversation history
    - User profile context injection
    - Database persistence
    """

    def __init__(
        self,
        model_name: str,
        api_base: str,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        top_p: float = 0.9,
        frequency_penalty: float = 0.0,
        presence_penalty: float = 0.0,
        max_history_turns: int = 10,
        max_model_len: int = 4096,
        safety_margin: int = 512
    ):
        """
        Initialize vLLM chat service.

        Args:
            model_name: HuggingFace model name (e.g., Qwen/Qwen2.5-3B-Instruct)
            api_base: vLLM OpenAI-compatible API base URL
            temperature: Sampling temperature (0-2, default 0.7)
            max_tokens: Maximum tokens to generate (default, can be adjusted dynamically)
            top_p: Nucleus sampling parameter
            frequency_penalty: Frequency penalty (-2.0 to 2.0)
            presence_penalty: Presence penalty (-2.0 to 2.0)
            max_history_turns: Maximum conversation turns to keep in sliding window
            max_model_len: Maximum context length supported by model
            safety_margin: Reserved tokens for response generation
        """
        self.model_name = model_name
        self.api_base = api_base
        self.base_url = api_base  # For compatibility with health_check
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p
        self.frequency_penalty = frequency_penalty
        self.presence_penalty = presence_penalty
        self.max_history_turns = max_history_turns
        self.max_model_len = max_model_len
        self.safety_margin = safety_margin

        # Thread pool executor for CPU-bound operations
        # Increased from 4 to 16 to match vLLM's concurrency capability
        self.executor = ThreadPoolExecutor(max_workers=16)
        self._shutdown = False  # Track cleanup state

        # Session store for chat histories (in-memory cache)
        self.store: Dict[str, InMemoryChatMessageHistory] = {}

        # Cache tiktoken encoder for efficient token counting
        # Create once and reuse to avoid repeated initialization overhead
        try:
            import tiktoken
            self._tiktoken_encoder = tiktoken.get_encoding("cl100k_base")
        except Exception as e:
            logger.warning(f"Failed to initialize tiktoken encoder: {e}. Token counting may be less efficient.")
            self._tiktoken_encoder = None

        try:
            # Initialize LangChain ChatOpenAI with vLLM endpoint
            self.llm = ChatOpenAI(
                model=model_name,
                openai_api_base=api_base,
                openai_api_key="EMPTY",  # vLLM doesn't require API key
                temperature=temperature,
                max_tokens=max_tokens,
                top_p=top_p,
                frequency_penalty=frequency_penalty,
                presence_penalty=presence_penalty,
                streaming=True,
                # Timeout settings
                request_timeout=120.0
            )

            logger.info(f"ChatServiceVLLM initialized successfully:")
            logger.info(f"  Model: {model_name}")
            logger.info(f"  API Base: {api_base}")
            logger.info(f"  Temperature: {temperature}")
            logger.info(f"  Max Tokens: {max_tokens}")
            logger.info(f"  Max History Turns: {max_history_turns}")
            logger.info(f"  Max Model Length: {max_model_len}")
            logger.info(f"  Safety Margin: {safety_margin}")

        except Exception as e:
            # Cleanup executor if LLM initialization failed
            if hasattr(self, 'executor') and self.executor:
                try:
                    self.executor.shutdown(wait=False, cancel_futures=True)
                    logger.info("[vLLM Career] Cleaned up executor after initialization failure")
                except Exception as cleanup_error:
                    logger.warning(f"[vLLM Career] Error cleaning up executor: {cleanup_error}")

            logger.error(f"Failed to initialize ChatServiceVLLM: {str(e)}")
            raise

    def _create_llm_with_max_tokens(self, max_tokens: int) -> ChatOpenAI:
        """
        Create a new LLM instance with specified max_tokens.

        This ensures thread safety by creating request-specific LLM instances
        instead of modifying the shared self.llm object.

        Args:
            max_tokens: Maximum tokens for this specific request

        Returns:
            ChatOpenAI instance configured for this request
        """
        return ChatOpenAI(
            model=self.model_name,
            openai_api_base=self.api_base,
            openai_api_key="EMPTY",
            temperature=self.temperature,
            max_tokens=max_tokens,  # Request-specific max_tokens
            top_p=self.top_p,
            frequency_penalty=self.frequency_penalty,
            presence_penalty=self.presence_penalty,
            streaming=True,
            request_timeout=120.0
        )

    def get_session_history(self, session_id: str) -> BaseChatMessageHistory:
        """
        Return chat history for a given session.

        If the session does not exist in memory, attempt to hydrate it from the
        persistent store (chat_messages table). This prevents loss of conversation
        context after an application restart.

        Args:
            session_id: The identifier of the chat session

        Returns:
            InMemoryChatMessageHistory instance containing the full conversation history
        """
        # Return cached history if already in memory
        if session_id in self.store:
            return self.store[session_id]

        # Create new in-memory history object
        history = InMemoryChatMessageHistory()

        # Load historical messages from database if session_id is numeric
        # Convert string digits to int if needed
        numeric_session_id = None
        if isinstance(session_id, str) and session_id.isdigit():
            numeric_session_id = int(session_id)
        elif isinstance(session_id, int):
            numeric_session_id = session_id

        if numeric_session_id is not None:
            try:
                # Use context manager for safe database session management
                with get_db_session() as db:
                    messages = (
                        db.query(ChatMessage)
                        .filter(ChatMessage.session_id == numeric_session_id)
                        .order_by(ChatMessage.id.asc())
                        .all()
                    )

                    # Populate in-memory history from database records
                    for msg in messages:
                        if msg.sender == "user":
                            history.add_message(HumanMessage(content=msg.message_text))
                        else:
                            history.add_message(AIMessage(content=msg.message_text))

                    logger.debug(f"Loaded {len(messages)} historical messages for session {session_id}")
            except Exception as e:
                logger.error(f"Failed to load chat history from DB for session {session_id}: {str(e)}")
                # Continue with empty history - don't fail the request
        else:
            logger.debug(f"Skipping database history load for non-numeric session_id: {session_id}")

        # Cache the reconstructed history
        self.store[session_id] = history
        return history

    def _count_message_tokens(self, messages: List) -> int:
        """
        Count tokens in messages using tiktoken.

        This provides accurate token counting before making API requests,
        enabling dynamic max_tokens adjustment.

        Args:
            messages: List of LangChain messages (SystemMessage, HumanMessage, AIMessage)

        Returns:
            Estimated token count
        """
        try:
            # Use cached tiktoken encoder for efficient token counting
            # If encoder wasn't initialized, fall back to character estimation
            if self._tiktoken_encoder is None:
                logger.warning("[vLLM Career] tiktoken encoder not available, using character estimation")
                total_chars = sum(len(str(msg.content)) for msg in messages)
                return int(total_chars / 4)  # ~4 chars per token (more accurate than 3)

            enc = self._tiktoken_encoder

            total_tokens = 0
            for message in messages:
                # Convert message to string
                content = str(message.content)

                # Count tokens in content
                tokens = len(enc.encode(content))

                # Add tokens for message formatting (role, etc.)
                # OpenAI format: each message has ~4 tokens overhead
                tokens += 4

                total_tokens += tokens

            # Add 3 tokens for priming the assistant's response
            total_tokens += 3

            return total_tokens

        except Exception as e:
            logger.warning(f"[vLLM] Token counting failed: {e}. Using character estimation.")
            # Fallback: character-based estimation (conservative)
            total_chars = sum(len(str(msg.content)) for msg in messages)
            return int(total_chars / 3)  # ~3 chars per token (conservative)

    def _apply_sliding_window(self, messages: List) -> List:
        """
        Apply sliding window to conversation history to prevent context overflow.

        Uses a two-phase approach:
        1. First, truncate by maximum number of turns (VLLM_MAX_HISTORY_TURNS)
        2. Then, verify total tokens don't exceed safe limit and further truncate if needed

        This ensures that even if individual messages are very long, the total context
        won't exceed the model's capacity.

        System messages are always preserved and not counted in the window.

        Args:
            messages: List of messages (SystemMessage, HumanMessage, AIMessage)

        Returns:
            Truncated list of messages within sliding window and token budget
        """
        if not messages:
            return messages

        # Separate system messages from conversation messages
        system_messages = [msg for msg in messages if isinstance(msg, SystemMessage)]
        conversation_messages = [msg for msg in messages if not isinstance(msg, SystemMessage)]

        # Phase 1: Truncate by number of turns
        # Each turn = 1 user message + 1 assistant message = 2 messages
        max_conversation_messages = self.max_history_turns * 2

        if len(conversation_messages) > max_conversation_messages:
            # Keep only the most recent messages
            conversation_messages = conversation_messages[-max_conversation_messages:]
            logger.info(f"[vLLM] Sliding window (phase 1): kept last {self.max_history_turns} turns "
                       f"({len(conversation_messages)} messages)")

        # Phase 2: Verify token count and truncate further if needed
        # Calculate maximum allowed input tokens (leave room for output and safety margin)
        max_input_tokens = self.max_model_len - self.max_tokens - self.safety_margin

        # Check total tokens including system messages
        current_messages = system_messages + conversation_messages
        current_token_count = self._count_message_tokens(current_messages)

        if current_token_count > max_input_tokens:
            logger.warning(f"[vLLM] Sliding window (phase 2): {self.max_history_turns} turns = "
                          f"{current_token_count} tokens > {max_input_tokens} safe limit. "
                          f"Truncating further...")

            # Remove messages from the beginning (oldest first) until we're under the limit
            # Always keep at least the most recent turn (2 messages)
            while len(conversation_messages) > 2:
                # Remove oldest conversation message
                conversation_messages.pop(0)

                # Recalculate token count
                current_messages = system_messages + conversation_messages
                current_token_count = self._count_message_tokens(current_messages)

                if current_token_count <= max_input_tokens:
                    logger.info(f"[vLLM] Sliding window (phase 2): reduced to {len(conversation_messages)//2} turns "
                               f"({current_token_count} tokens)")
                    break

            # If still over limit even with just 1 turn, warn but keep it
            # (the dynamic max_tokens adjustment will handle this)
            if current_token_count > max_input_tokens:
                logger.warning(f"[vLLM] Sliding window (phase 2): Even single turn exceeds safe limit "
                              f"({current_token_count} > {max_input_tokens}). "
                              f"Relying on dynamic max_tokens adjustment.")

        # Reconstruct: system messages + windowed conversation
        return system_messages + conversation_messages

    def _ensure_alternating_roles(self, messages: List) -> List:
        """
        Ensure conversation roles strictly alternate user/assistant/user/assistant.

        vLLM's OpenAI-compatible API requires strict role alternation. This method:
        1. Removes consecutive messages with the same role (keeps the last one)
        2. Ensures conversation starts with user message (after system messages)
        3. Ensures conversation ends with user message (ready for assistant response)

        Args:
            messages: List of messages (SystemMessage, HumanMessage, AIMessage)

        Returns:
            List of messages with strictly alternating user/assistant roles
        """
        if not messages:
            return messages

        # Separate system messages from conversation messages
        system_messages = [msg for msg in messages if isinstance(msg, SystemMessage)]
        conversation_messages = [msg for msg in messages if not isinstance(msg, SystemMessage)]

        if not conversation_messages:
            return system_messages

        # Fix role alternation in conversation messages
        fixed_conversation = []
        last_role = None

        for msg in conversation_messages:
            current_role = "user" if isinstance(msg, HumanMessage) else "assistant"

            # Skip if same role as previous (keeps the latest message of each role sequence)
            if current_role == last_role:
                # Replace the last message with current one (keep latest)
                fixed_conversation[-1] = msg
                logger.warning(f"[vLLM] Removed duplicate {current_role} message to fix role alternation")
            else:
                fixed_conversation.append(msg)
                last_role = current_role

        # Ensure conversation starts with user message
        if fixed_conversation and not isinstance(fixed_conversation[0], HumanMessage):
            logger.warning("[vLLM] Conversation started with assistant message, removing it")
            fixed_conversation.pop(0)

        # Ensure conversation ends with user message (since we're generating assistant response)
        if fixed_conversation and not isinstance(fixed_conversation[-1], HumanMessage):
            logger.warning("[vLLM] Conversation ended with assistant message, removing it")
            fixed_conversation.pop()

        # Reconstruct with system messages first
        return system_messages + fixed_conversation

    def _calculate_dynamic_max_tokens(self, input_tokens: int) -> int:
        """
        Calculate dynamic max_tokens based on input token count.

        Ensures the response won't exceed model's context limit by adjusting
        max_tokens based on how many tokens are already in the input.

        Args:
            input_tokens: Number of tokens in the input (from usage_metadata)

        Returns:
            Adjusted max_tokens value
        """
        # Calculate available tokens for response
        available_tokens = self.max_model_len - input_tokens - self.safety_margin

        # Ensure we don't exceed default max_tokens or available space
        adjusted_max_tokens = min(available_tokens, self.max_tokens)

        # Ensure minimum viable response length (at least 100 tokens)
        adjusted_max_tokens = max(adjusted_max_tokens, 100)

        if adjusted_max_tokens < self.max_tokens:
            logger.info(f"[vLLM] Adjusted max_tokens: {self.max_tokens} -> {adjusted_max_tokens} "
                       f"(input: {input_tokens}, available: {available_tokens})")

        return adjusted_max_tokens

    async def generate_response(
        self,
        user_message: str,
        session_id: Optional[str] = None,
        user_id: Optional[int] = None,
        db: Optional[Session] = None,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> Dict[str, Any]:
        """
        Generate AI response for user message.

        Args:
            user_message: User's input message
            session_id: Optional session ID for conversation context
            user_id: Optional user ID for profile context
            db: Optional database session
            cancellation_event: Optional event to signal cancellation

        Returns:
            Dictionary containing the AI response and metadata
        """
        try:
            logger.info(f"[vLLM] Generating response for message: {user_message[:50]}...")

            # Use default session if none provided
            if session_id is None:
                session_id = "default"

            # Check if request was cancelled before starting
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled before processing")

            # Get user profile data if user_id is provided
            profile_data = None
            if user_id and db:
                profile_data = await self.get_user_profile(user_id, db)

            # Run generation in thread pool
            loop = asyncio.get_running_loop()

            task = loop.run_in_executor(
                self.executor,
                self._generate_sync_response,
                user_message,
                session_id,
                profile_data,
                cancellation_event
            )

            # Wait for either task completion or cancellation
            if cancellation_event:
                wait_task = asyncio.create_task(cancellation_event.wait())
                try:
                    done, pending = await asyncio.wait(
                        [task, wait_task],
                        return_when=asyncio.FIRST_COMPLETED,
                        timeout=120.0  # 2 minute timeout for response generation
                    )

                    # Handle timeout
                    if not done:
                        logger.warning("[vLLM Career] Response generation timed out after 120 seconds")
                        for pending_task in [task, wait_task]:
                            pending_task.cancel()
                        raise asyncio.TimeoutError("Response generation timed out after 120 seconds")

                    # Cancel pending tasks
                    for pending_task in pending:
                        pending_task.cancel()
                        try:
                            await pending_task
                        except asyncio.CancelledError:
                            pass

                    # If cancelled, raise error
                    if cancellation_event.is_set():
                        if not task.done():
                            task.cancel()
                            try:
                                await task
                            except asyncio.CancelledError:
                                pass
                        raise asyncio.CancelledError("Request was cancelled during processing")

                    response = await task
                finally:
                    if not wait_task.done():
                        wait_task.cancel()
                        try:
                            await wait_task
                        except asyncio.CancelledError:
                            pass
            else:
                response = await task

            # Generate follow-up questions
            follow_up_questions = await self.generate_follow_up_questions(
                user_message, response, session_id, profile_data, cancellation_event
            )

            return {
                "response": response,
                "follow_up_questions": follow_up_questions,
                "model": self.model_name,
                "session_id": session_id,
                "status": "success"
            }

        except asyncio.CancelledError:
            logger.info(f"[vLLM] Request cancelled for session: {session_id}")
            raise
        except Exception as e:
            logger.error(f"[vLLM] Error generating response: {str(e)}")
            return {
                "response": "I apologize, but I'm having trouble processing your request right now. Please try again.",
                "model": self.model_name,
                "session_id": session_id,
                "status": "error",
                "error": str(e)
            }

    def _generate_sync_response(
        self,
        user_message: str,
        session_id: str = "default",
        profile_data: Optional[Dict[str, Any]] = None,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> str:
        """
        Synchronous method to generate response using vLLM.

        Args:
            user_message: User's input message
            session_id: Session identifier
            profile_data: Optional user profile data
            cancellation_event: Optional event to check for cancellation

        Returns:
            AI-generated response string
        """
        try:
            # Check for cancellation
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled")

            # Get conversation history
            history = self.get_session_history(session_id)

            # Build messages list
            messages = []

            # System message with profile context
            # Keep base system prompt consistent for better prefix caching
            system_content = "You are a specialized career agent. Provide expert advice on career-related topics including job search, career development, professional skills, resume optimization, interview preparation, and career transitions."

            if profile_data:
                profile_context = self._format_profile_for_context(profile_data)
                system_content += f"\n\nUser Profile Context:\n{profile_context}\n\nUse this profile information to provide personalized and relevant responses."

            messages.append(SystemMessage(content=system_content))

            # Add conversation history
            for msg in history.messages:
                messages.append(msg)

            # Add current user message
            messages.append(HumanMessage(content=user_message))

            # Apply sliding window to prevent context overflow
            messages = self._apply_sliding_window(messages)

            # Ensure roles strictly alternate (vLLM requirement)
            messages = self._ensure_alternating_roles(messages)

            # Count input tokens BEFORE making the request
            input_token_count = self._count_message_tokens(messages)

            # Calculate dynamic max_tokens based on actual input
            dynamic_max_tokens = self._calculate_dynamic_max_tokens(input_token_count)

            logger.info(f"[vLLM] Input tokens: ~{input_token_count}, Dynamic max_tokens: {dynamic_max_tokens}")

            # Create request-specific LLM instance with dynamic max_tokens (thread-safe)
            llm = self._create_llm_with_max_tokens(dynamic_max_tokens)

            # Generate response with dynamically adjusted max_tokens
            response = llm.invoke(messages)

            # Extract actual token usage from response for verification
            input_tokens = 0
            output_tokens = 0
            total_tokens = 0

            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage = response.usage_metadata
                input_tokens = usage.get('input_tokens', 0)
                output_tokens = usage.get('output_tokens', 0)
                total_tokens = usage.get('total_tokens', 0)

                logger.info(f"[vLLM] Actual usage - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}")
                if input_tokens > 0:
                    accuracy = (input_token_count / input_tokens * 100)
                    logger.info(f"[vLLM] Token estimation accuracy: {accuracy:.1f}% (estimated: {input_token_count}, actual: {input_tokens})")
            elif hasattr(response, 'response_metadata') and response.response_metadata:
                token_usage = response.response_metadata.get('token_usage', {})
                input_tokens = token_usage.get('prompt_tokens', 0)
                output_tokens = token_usage.get('completion_tokens', 0)
                total_tokens = token_usage.get('total_tokens', 0)

                logger.info(f"[vLLM] Actual usage - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}")
                if input_tokens > 0:
                    accuracy = (input_token_count / input_tokens * 100)
                    logger.info(f"[vLLM] Token estimation accuracy: {accuracy:.1f}% (estimated: {input_token_count}, actual: {input_tokens})")

            # Extract content from response
            response_text = response.content if hasattr(response, 'content') else str(response)

            # Add to history
            history.add_user_message(user_message)
            history.add_ai_message(response_text)

            # Check for cancellation after generation
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled")

            return response_text.strip()

        except Exception as e:
            logger.error(f"[vLLM] Error in sync response generation: {str(e)}")
            raise

    async def generate_streaming_response(
        self,
        user_message: str,
        session_id: Optional[str] = None,
        user_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Generate streaming AI response using Server-Sent Events.

        Args:
            user_message: User's input message
            session_id: Optional session ID for conversation context
            user_id: Optional user ID for profile context
            db: Optional database session

        Yields:
            Dictionary chunks with type, content, and optional follow-up questions
        """
        try:
            logger.info(f"[vLLM] Generating streaming response for message: {user_message[:50]}...")

            # Use default session if none provided
            if session_id is None:
                session_id = "default"

            # Get conversation history
            history = await self.get_conversation_history(session_id)

            # Get user profile data
            profile_data = None
            if user_id and db:
                profile_data = await self.get_user_profile(user_id, db)

            # Get latest career insights for context
            career_insights = None
            if user_id and db:
                career_insights = await self.get_latest_career_insights(user_id, db)

            # Build messages list
            messages = []

            # System message with profile context
            # Keep base system prompt consistent for better prefix caching
            system_content = "You are a specialized career agent. Provide expert advice on career-related topics including job search, career development, professional skills, resume optimization, interview preparation, and career transitions."

            if profile_data:
                profile_context = self._format_profile_for_context(profile_data)
                system_content += f"\n\nUser Profile Context:\n{profile_context}\n\nUse this profile information to provide personalized and relevant career advice."

            if career_insights:
                # Add career insights context from recent resume analysis
                insights_summary = self._format_career_insights_for_context(career_insights)
                system_content += f"\n\nLatest Career Insights from Resume Analysis:\n{insights_summary}\n\nUse these insights to provide informed advice about the user's career development, skills, and opportunities based on their latest resume analysis."

            messages.append(SystemMessage(content=system_content))

            # Add conversation history
            for msg in history:
                if msg["role"] == "user":
                    messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    messages.append(AIMessage(content=msg["content"]))

            # Add current user message
            if not history or history[-1]["role"] != "user" or history[-1]["content"] != user_message:
                messages.append(HumanMessage(content=user_message))
                # Persist user message immediately
                self.get_session_history(session_id).add_user_message(user_message)

            # Apply sliding window to prevent context overflow
            messages = self._apply_sliding_window(messages)

            # Ensure roles strictly alternate (vLLM requirement)
            messages = self._ensure_alternating_roles(messages)

            # Count input tokens BEFORE streaming
            input_token_count = self._count_message_tokens(messages)

            # Calculate dynamic max_tokens
            dynamic_max_tokens = self._calculate_dynamic_max_tokens(input_token_count)

            logger.info(f"[vLLM Streaming] Input tokens: ~{input_token_count}, Dynamic max_tokens: {dynamic_max_tokens}")

            # Create request-specific LLM instance with dynamic max_tokens (thread-safe)
            llm = self._create_llm_with_max_tokens(dynamic_max_tokens)

            # Stream response from vLLM
            full_response = ""
            input_tokens = 0
            output_tokens = 0
            total_tokens = 0

            async for chunk in llm.astream(messages):
                # Extract content from chunk
                chunk_content = chunk.content if hasattr(chunk, 'content') else str(chunk)

                if chunk_content:
                    full_response += chunk_content
                    yield {
                        "type": "token",
                        "content": chunk_content
                    }

                # Try to extract token usage from streaming chunks (if available)
                if hasattr(chunk, 'usage_metadata') and chunk.usage_metadata:
                    usage = chunk.usage_metadata
                    input_tokens = usage.get('input_tokens', input_tokens)
                    output_tokens = usage.get('output_tokens', output_tokens)
                    total_tokens = usage.get('total_tokens', total_tokens)

            # Add complete response to history
            self._add_to_history(session_id, user_message, full_response)

            # Log token usage if available
            if input_tokens > 0 or output_tokens > 0:
                logger.info(f"[vLLM Streaming] Actual usage - Input: {input_tokens}, Output: {output_tokens}, Total: {total_tokens}")
                if input_tokens > 0:
                    accuracy = (input_token_count / input_tokens * 100)
                    logger.info(f"[vLLM Streaming] Token estimation accuracy: {accuracy:.1f}% (estimated: {input_token_count}, actual: {input_tokens})")

            # Generate follow-up questions
            follow_up_questions = await self.generate_follow_up_questions(
                user_message, full_response, session_id, profile_data
            )

            yield {
                "type": "complete",
                "content": full_response,
                "follow_up_questions": follow_up_questions
            }

        except Exception as e:
            logger.error(f"[vLLM] Error in streaming response: {str(e)}")
            yield {
                "type": "error",
                "content": f"Error generating response: {str(e)}"
            }

    def _add_to_history(self, session_id: str, user_message: str, ai_response: str):
        """
        Add user message and AI response to conversation history.

        Args:
            session_id: Session identifier
            user_message: User's message
            ai_response: AI's response
        """
        try:
            history = self.get_session_history(session_id)

            # Ensure the latest entry is the corresponding user message (avoid duplicates)
            if not history.messages or not isinstance(history.messages[-1], HumanMessage) or history.messages[-1].content != user_message:
                history.add_user_message(user_message)

            # Always append the assistant response
            history.add_ai_message(ai_response)
        except Exception as e:
            logger.error(f"[vLLM] Error adding to history: {str(e)}")

    async def generate_follow_up_questions(
        self,
        user_message: str,
        ai_response: str,
        session_id: str = "default",
        profile_data: Optional[Dict[str, Any]] = None,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> List[str]:
        """
        Generate 3 follow-up questions based on conversation.

        Args:
            user_message: Original user message
            ai_response: AI's response
            session_id: Session identifier
            profile_data: Optional user profile data
            cancellation_event: Optional event to check for cancellation

        Returns:
            List of 3 follow-up questions
        """
        try:
            # Check for cancellation
            if cancellation_event and cancellation_event.is_set():
                return []

            # Format profile context
            profile_context = ""
            if profile_data:
                profile_context = self._format_profile_for_context(profile_data)

            # Create specialized prompt
            follow_up_prompt = FOLLOW_UP_PROMPT.format(
                user_message=user_message,
                ai_response=ai_response,
                profile_context=profile_context
            )

            # Generate follow-up questions
            loop = asyncio.get_running_loop()
            task = loop.run_in_executor(
                self.executor,
                self._generate_follow_up_sync,
                follow_up_prompt,
                cancellation_event
            )

            # Handle cancellation
            if cancellation_event:
                wait_task = asyncio.create_task(cancellation_event.wait())
                try:
                    done, pending = await asyncio.wait(
                        [task, wait_task],
                        return_when=asyncio.FIRST_COMPLETED,
                        timeout=120.0  # 2 minute timeout for follow-up generation
                    )

                    # Handle timeout
                    if not done:
                        logger.warning("[vLLM Career] Follow-up generation timed out after 120 seconds")
                        for pending_task in [task, wait_task]:
                            pending_task.cancel()
                        raise asyncio.TimeoutError("Follow-up generation timed out after 120 seconds")

                    for pending_task in pending:
                        pending_task.cancel()
                        try:
                            await pending_task
                        except asyncio.CancelledError:
                            pass

                    if cancellation_event.is_set():
                        if not task.done():
                            task.cancel()
                            try:
                                await task
                            except asyncio.CancelledError:
                                pass
                        return []

                    questions_text = await task
                finally:
                    if not wait_task.done():
                        wait_task.cancel()
                        try:
                            await wait_task
                        except asyncio.CancelledError:
                            pass
            else:
                questions_text = await task

            # Parse questions
            questions = self._parse_follow_up_questions(questions_text)

            logger.info(f"[vLLM] Generated {len(questions)} follow-up questions for session: {session_id}")
            return questions

        except Exception as e:
            logger.error(f"[vLLM] Error generating follow-up questions: {str(e)}")
            return [
                "Can you provide more details about this?",
                "What are the next steps I should take?",
                "Are there any alternatives I should consider?"
            ]

    def _generate_follow_up_sync(
        self,
        prompt: str,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> str:
        """
        Synchronous method to generate follow-up questions.

        Args:
            prompt: Formatted prompt for follow-up generation
            cancellation_event: Optional event to check for cancellation

        Returns:
            Generated follow-up questions as text
        """
        try:
            # Check for cancellation
            if cancellation_event and cancellation_event.is_set():
                return ""

            # Build messages
            messages = [HumanMessage(content=prompt)]

            # Count tokens and calculate dynamic max_tokens
            input_token_count = self._count_message_tokens(messages)
            dynamic_max_tokens = self._calculate_dynamic_max_tokens(input_token_count)

            logger.info(f"[vLLM Career Follow-up] Input tokens: ~{input_token_count}, Dynamic max_tokens: {dynamic_max_tokens}")

            # Create request-specific LLM instance for follow-up generation (thread-safe)
            # Follow-up questions should be short (~300 tokens max for 3 questions)
            follow_up_max_tokens = min(dynamic_max_tokens, 300)
            llm = self._create_llm_with_max_tokens(follow_up_max_tokens)

            # Use LLM with adjusted max_tokens
            response = llm.invoke(messages)

            # Check for cancellation after generation
            if cancellation_event and cancellation_event.is_set():
                return ""

            response_text = response.content if hasattr(response, 'content') else str(response)
            return response_text.strip()

        except Exception as e:
            logger.error(f"[vLLM] Error in sync follow-up generation: {str(e)}")
            raise

    async def optimize_query(
        self,
        user_query: str,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> Dict[str, Any]:
        """
        Optimize user query to make it clearer and more structured.

        Args:
            user_query: Original user query to optimize
            cancellation_event: Optional event to signal cancellation

        Returns:
            Dictionary containing optimized query and metadata
        """
        try:
            logger.info(f"[vLLM] Optimizing query: {user_query[:50]}...")

            # Check if cancelled before starting
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled before processing")

            # Format optimization prompt
            optimization_prompt = OPTIMIZE_QUERY_PROMPT.format(user_query=user_query)

            # Run optimization in thread pool
            loop = asyncio.get_running_loop()

            task = loop.run_in_executor(
                self.executor,
                self._optimize_sync_query,
                optimization_prompt,
                cancellation_event
            )

            # Wait for completion or cancellation
            if cancellation_event:
                wait_task = asyncio.create_task(cancellation_event.wait())
                try:
                    done, pending = await asyncio.wait(
                        [task, wait_task],
                        return_when=asyncio.FIRST_COMPLETED,
                        timeout=120.0  # 2 minute timeout for query optimization
                    )

                    # Handle timeout
                    if not done:
                        logger.warning("[vLLM Career] Query optimization timed out after 120 seconds")
                        for pending_task in [task, wait_task]:
                            pending_task.cancel()
                        raise asyncio.TimeoutError("Query optimization timed out after 120 seconds")

                    for pending_task in pending:
                        pending_task.cancel()
                        try:
                            await pending_task
                        except asyncio.CancelledError:
                            pass

                    if cancellation_event.is_set():
                        if not task.done():
                            task.cancel()
                            try:
                                await task
                            except asyncio.CancelledError:
                                pass
                        raise asyncio.CancelledError("Request was cancelled during processing")

                    optimized_query = await task
                finally:
                    if not wait_task.done():
                        wait_task.cancel()
                        try:
                            await wait_task
                        except asyncio.CancelledError:
                            pass
            else:
                optimized_query = await task

            return {
                "original_query": user_query,
                "optimized_query": optimized_query,
                "model": self.model_name,
                "status": "success"
            }

        except asyncio.CancelledError:
            logger.info("[vLLM] Query optimization cancelled")
            raise
        except Exception as e:
            logger.error(f"[vLLM] Error optimizing query: {str(e)}")
            return {
                "original_query": user_query,
                "optimized_query": user_query,
                "model": self.model_name,
                "status": "error",
                "error": str(e)
            }

    def _optimize_sync_query(
        self,
        optimization_prompt: str,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> str:
        """
        Synchronous method to optimize query using LLM.

        Args:
            optimization_prompt: Formatted prompt for query optimization
            cancellation_event: Optional event to check for cancellation

        Returns:
            Optimized query string
        """
        try:
            # Check for cancellation
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled")

            # Build messages
            messages = [HumanMessage(content=optimization_prompt)]

            # Count tokens and calculate dynamic max_tokens
            input_token_count = self._count_message_tokens(messages)
            dynamic_max_tokens = self._calculate_dynamic_max_tokens(input_token_count)

            logger.info(f"[vLLM Career Optimization] Input tokens: ~{input_token_count}, Dynamic max_tokens: {dynamic_max_tokens}")

            # Create request-specific LLM instance for query optimization (thread-safe)
            # Query optimization should be short (~200 tokens max)
            optimization_max_tokens = min(dynamic_max_tokens, 200)
            llm = self._create_llm_with_max_tokens(optimization_max_tokens)

            # Use LLM with adjusted max_tokens
            response = llm.invoke(messages)

            # Check for cancellation after generation
            if cancellation_event and cancellation_event.is_set():
                raise asyncio.CancelledError("Request was cancelled")

            # Extract content
            response_text = response.content if hasattr(response, 'content') else str(response)
            optimized_query = response_text.strip()

            # Remove common prefixes
            prefixes_to_remove = [
                "Optimized Query:",
                "Optimized:",
                "Here's the optimized query:",
                "The optimized query is:"
            ]

            for prefix in prefixes_to_remove:
                if optimized_query.startswith(prefix):
                    optimized_query = optimized_query[len(prefix):].strip()
                    break

            # Remove wrapping quotation marks
            optimized_query = optimized_query.strip()
            optimized_query = re.sub(r'^[\""\'`]+', '', optimized_query)
            optimized_query = re.sub(r'[\""\'`]+$', '', optimized_query)

            return optimized_query

        except Exception as e:
            logger.error(f"[vLLM] Error in sync query optimization: {str(e)}")
            raise

    async def health_check(self) -> Dict[str, str]:
        """
        Check if vLLM service is healthy and responsive.

        Returns:
            Dictionary containing health status information
        """
        try:
            logger.info("[vLLM] Health check: Testing vLLM connection...")

            # Test with a simple prompt
            test_response = await self.generate_response("Hello")

            if test_response["status"] == "success":
                result = {
                    "status": "healthy",
                    "model": self.model_name,
                    "base_url": self.api_base
                }
                logger.info(f"[vLLM] Health check: Returning healthy status: {result}")
                return result
            else:
                result = {
                    "status": "unhealthy",
                    "model": self.model_name,
                    "base_url": self.api_base,
                    "error": test_response.get("error", "Unknown error")
                }
                logger.warning(f"[vLLM] Health check: Returning unhealthy status: {result}")
                return result

        except Exception as e:
            result = {
                "status": "unhealthy",
                "model": self.model_name,
                "base_url": self.api_base,
                "error": str(e)
            }
            logger.error(f"[vLLM] Health check: Exception occurred: {e}")
            return result

    async def clear_memory(self, session_id: str = "default") -> bool:
        """
        Clear conversation memory for a specific session.

        Args:
            session_id: Session identifier to clear

        Returns:
            True if memory was cleared successfully
        """
        try:
            if session_id in self.store:
                self.store[session_id].clear()
                logger.info(f"[vLLM] Conversation memory cleared for session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"[vLLM] Error clearing memory: {str(e)}")
            return False

    async def get_conversation_history(
        self,
        session_id: str = "default"
    ) -> List[Dict[str, str]]:
        """
        Get current conversation history for a specific session.

        Args:
            session_id: Session identifier

        Returns:
            List of conversation messages
        """
        try:
            # Ensure in-memory history exists; hydrate from DB if necessary
            if session_id not in self.store:
                self.get_session_history(session_id)

            messages = self.store[session_id].messages
            history = []

            for message in messages:
                if isinstance(message, HumanMessage):
                    history.append({"role": "user", "content": message.content})
                elif isinstance(message, AIMessage):
                    history.append({"role": "assistant", "content": message.content})

            return history

        except Exception as e:
            logger.error(f"[vLLM] Error getting conversation history: {str(e)}")
            return []

    async def remove_messages_after_index(
        self,
        session_id: str = "default",
        message_index: int = 0
    ) -> bool:
        """
        Remove all messages after a specific index.

        Args:
            session_id: Session identifier
            message_index: Index after which to remove messages (0-based)

        Returns:
            True if messages were removed successfully
        """
        try:
            # Ensure history is loaded
            if session_id not in self.store:
                try:
                    self.get_session_history(session_id)
                except Exception as e:
                    logger.error(f"[vLLM] Failed to hydrate history for session {session_id}: {str(e)}")
                    return True

            if session_id not in self.store:
                return True

            messages = self.store[session_id].messages
            if message_index < len(messages):
                self.store[session_id].messages = messages[:message_index + 1]
                logger.info(f"[vLLM] Removed messages after index {message_index} for session: {session_id}")
            return True
        except Exception as e:
            logger.error(f"[vLLM] Error removing messages: {str(e)}")
            return False

    async def update_message_at_index(
        self,
        session_id: str = "default",
        message_index: int = 0,
        new_content: str = ""
    ) -> bool:
        """
        Update a specific message in conversation history.

        Args:
            session_id: Session identifier
            message_index: Index of the message to update (0-based)
            new_content: New content for the message

        Returns:
            True if message was updated successfully
        """
        try:
            if session_id not in self.store:
                try:
                    self.get_session_history(session_id)
                except Exception as e:
                    logger.error(f"[vLLM] Failed to hydrate history for session {session_id}: {str(e)}")
                    return True

            if session_id not in self.store:
                return True

            messages = self.store[session_id].messages
            if 0 <= message_index < len(messages):
                # Update message while preserving type
                if isinstance(messages[message_index], HumanMessage):
                    messages[message_index] = HumanMessage(content=new_content)
                elif isinstance(messages[message_index], AIMessage):
                    messages[message_index] = AIMessage(content=new_content)
                logger.info(f"[vLLM] Updated message at index {message_index} for session: {session_id}")
                return True
            return False
        except Exception as e:
            logger.error(f"[vLLM] Error updating message: {str(e)}")
            return False

    async def get_user_profile(
        self,
        user_id: int,
        db: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get user profile data from database for personalized context.

        Args:
            user_id: User ID to fetch profile for
            db: Optional database session to use

        Returns:
            Dictionary containing user profile data or None if not found
        """
        try:
            # Use provided db session or create new one
            should_close_db = False
            if db is None:
                db = SessionLocal()
                should_close_db = True

            try:
                profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
                if not profile:
                    logger.info(f"[vLLM] No profile found for user_id: {user_id}")
                    return None

                # Convert profile to dictionary
                profile_data = {
                    "current_job": profile.current_job,
                    "company": profile.company,
                    "industry": profile.industry,
                    "experience": profile.experience,
                    "work_style": profile.work_style,
                    "leadership_experience": profile.leadership_experience,
                    "skills": profile.skills,
                    "soft_skills": profile.soft_skills,
                    "certifications": profile.certifications,
                    "skill_gaps": profile.skill_gaps,
                    "short_term_goals": profile.short_term_goals,
                    "career_goals": profile.career_goals,
                    "career_path_preference": profile.career_path_preference,
                    "target_industries": profile.target_industries,
                    "work_life_balance_priority": profile.work_life_balance_priority,
                    "company_size_preference": profile.company_size_preference,
                    "career_risk_tolerance": profile.career_risk_tolerance,
                    "geographic_flexibility": profile.geographic_flexibility,
                    "work_values": profile.work_values,
                    "career_challenges": profile.career_challenges,
                    "professional_strengths": profile.professional_strengths,
                    "growth_areas": profile.growth_areas,
                    "learning_preferences": profile.learning_preferences,
                    "income_range": profile.income_range,
                    "financial_goals": profile.financial_goals,
                    "investment_experience": profile.investment_experience,
                    "risk_tolerance": profile.risk_tolerance,
                    "fitness_level": profile.fitness_level,
                    "health_goals": profile.health_goals,
                    "dietary_preferences": profile.dietary_preferences,
                    "exercise_preferences": profile.exercise_preferences,
                    "travel_style": profile.travel_style,
                    "preferred_destinations": profile.preferred_destinations,
                    "travel_budget": profile.travel_budget,
                    "travel_frequency": profile.travel_frequency,
                    "learning_style": profile.learning_style,
                    "personality_type": profile.personality_type,
                    "strengths": profile.strengths,
                    "areas_for_improvement": profile.areas_for_improvement,
                    "family_status": profile.family_status,
                    "relationship_goals": profile.relationship_goals,
                    "work_life_balance": profile.work_life_balance,
                    "hobbies": profile.hobbies,
                    "interests": profile.interests,
                    "creative_pursuits": profile.creative_pursuits,
                    "education_level": profile.education_level,
                    "learning_goals": profile.learning_goals,
                    "preferred_learning_methods": profile.preferred_learning_methods,
                    "spiritual_practices": profile.spiritual_practices,
                    "mindfulness_level": profile.mindfulness_level,
                    "stress_management": profile.stress_management
                }

                # Filter out None values
                profile_data = {k: v for k, v in profile_data.items() if v is not None}

                logger.info(f"[vLLM] Retrieved profile data for user_id: {user_id}")
                return profile_data

            finally:
                if should_close_db:
                    try:
                        db.close()
                    except Exception as close_error:
                        logger.warning(f"[vLLM] Error closing database session: {close_error}")

        except Exception as e:
            logger.error(f"[vLLM] Error getting user profile: {str(e)}")
            return None

    async def get_latest_career_insights(
        self,
        user_id: int,
        db: Optional[Session] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get the latest career insights from database (Career Agent specific).

        Args:
            user_id: User ID to fetch career insights for
            db: Optional database session to use

        Returns:
            Dictionary containing latest career insights data or None if not found
        """
        try:
            # Use provided db session or create new one
            should_close_db = False
            if db is None:
                db = SessionLocal()
                should_close_db = True

            try:
                # Get the most recent career insight for the user
                latest_insight = (
                    db.query(CareerInsight)
                    .filter(CareerInsight.user_id == user_id)
                    .order_by(CareerInsight.created_at.desc())
                    .first()
                )

                if not latest_insight:
                    logger.info(f"[vLLM Career] No career insights found for user_id: {user_id}")
                    return None

                # Get the professional data from the career insight
                professional_data = latest_insight.get_professional_data()

                if professional_data:
                    logger.info(f"[vLLM Career] Retrieved latest career insights for user_id: {user_id}")
                    return professional_data
                else:
                    logger.info(f"[vLLM Career] Career insight found but no professional data for user_id: {user_id}")
                    return None

            finally:
                if should_close_db:
                    try:
                        db.close()
                    except Exception as close_error:
                        logger.warning(f"[vLLM Career] Error closing database session: {close_error}")

        except Exception as e:
            logger.error(f"[vLLM Career] Error getting latest career insights: {str(e)}")
            return None

    def cleanup(self):
        """
        Explicitly cleanup resources (ThreadPoolExecutor).

        This method ensures proper cleanup of the thread pool to prevent
        resource leaks. Should be called when the service is no longer needed.
        """
        if not self._shutdown:
            logger.info("[vLLM Career] Cleaning up ChatServiceVLLM resources...")
            if self.executor:
                self.executor.shutdown(wait=True, cancel_futures=True)
                logger.info("[vLLM Career] ThreadPoolExecutor shut down successfully")
            self._shutdown = True

    def __del__(self):
        """
        Destructor - fallback cleanup for ThreadPoolExecutor.

        Automatically called when the object is garbage collected.
        Ensures resources are freed even if cleanup() wasn't called explicitly.
        """
        try:
            self.cleanup()
        except Exception as e:
            # Log errors to stderr since logging might be shutdown during destruction
            # Suppress re-raising to avoid issues with garbage collection
            import sys
            print(f"[vLLM Career] Warning: Error during ChatServiceVLLM cleanup in destructor: {e}", file=sys.stderr)
