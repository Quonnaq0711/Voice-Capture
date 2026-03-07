"""
Work Assistant - Main orchestrator for the Work Agent.

Combines all specialized agents into a unified assistant that can handle
various work-related tasks through natural language.
"""
import os
import sys
import logging
from datetime import datetime
from typing import Optional, Dict, Any

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..')))

from langgraph.checkpoint.memory import MemorySaver

from modules.agents.work.src.agents.base_agent import Agent
from modules.agents.work.src.prompts import WORK_MANAGER_PROMPT
from modules.tools.todo import create_todo, get_todos, update_todo, delete_todo, complete_todo

logger = logging.getLogger(__name__)


def get_current_datetime() -> str:
    """Get current datetime formatted for prompts."""
    return datetime.now().strftime("%Y-%m-%d %H:%M (%A)")


class WorkAssistant:
    """
    Main Work Assistant that orchestrates all sub-agents.

    Usage:
        assistant = WorkAssistant(user_id=1)
        response = assistant.chat("What tasks do I have today?")
    """

    def __init__(
        self,
        user_id: int,
        thread_id: Optional[str] = None
    ):
        """
        Initialize the Work Assistant.

        Args:
            user_id: ID of the user this assistant is for
            thread_id: Thread ID for conversation continuity
        """
        self.user_id = user_id
        self.thread_id = thread_id or f"work_user_{user_id}"

        # Set up memory (in-memory checkpointer)
        self.checkpointer = MemorySaver()

        # Initialize agents
        self._setup_agents()

        logger.info(f"WorkAssistant initialized for user {user_id}")

    def _setup_agents(self) -> None:
        """Set up the main agent with direct tool access.

        Note: Simplified architecture - the manager agent directly uses todo tools
        instead of delegating to a sub-agent. This works better with models that
        don't have strong function calling support (like gemma-3-4b-it).
        """
        current_datetime = get_current_datetime()

        # Create Manager Agent with direct tool access
        # (Bypassing orchestrator pattern since gemma doesn't support tool calling well)
        self.manager_agent = Agent(
            name="work_manager",
            description="Main work assistant with direct access to todo tools",
            system_prompt=WORK_MANAGER_PROMPT.format(
                date_time=current_datetime,
                user_id=self.user_id
            ),
            tools=[create_todo, get_todos, update_todo, delete_todo, complete_todo],
            sub_agents=[],  # No sub-agents - direct tool access
            temperature=0.1,
            memory=self.checkpointer
        )

        # Initialize the agent
        self.manager_agent.initiate_agent()

        logger.info(f"Manager agent initialized with {len(self.manager_agent.tools)} direct tools")

    def chat(self, message: str) -> str:
        """
        Send a message to the assistant and get a response.

        Args:
            message: User's message or request

        Returns:
            Assistant's response as a string
        """
        config = {"configurable": {"thread_id": self.thread_id}}
        messages = {"messages": [("human", message)]}

        try:
            response = self.manager_agent.invoke(messages, config=config)

            # Extract final response content
            if "messages" in response and len(response["messages"]) > 0:
                final_message = response["messages"][-1]
                if hasattr(final_message, 'content'):
                    return final_message.content
                return str(final_message)

            return str(response)

        except Exception as e:
            logger.error(f"Error in chat: {str(e)}")
            return f"I encountered an error: {str(e)}"

    async def achat(self, message: str) -> str:
        """Async version of chat."""
        config = {"configurable": {"thread_id": self.thread_id}}
        messages = {"messages": [("human", message)]}

        try:
            response = await self.manager_agent.ainvoke(messages, config=config)

            if "messages" in response and len(response["messages"]) > 0:
                final_message = response["messages"][-1]
                if hasattr(final_message, 'content'):
                    return final_message.content
                return str(final_message)

            return str(response)

        except Exception as e:
            logger.error(f"Error in async chat: {str(e)}")
            return f"I encountered an error: {str(e)}"

    def stream_chat(self, message: str):
        """
        Stream responses from the assistant.

        Yields chunks of the response as they are generated.
        """
        config = {"configurable": {"thread_id": self.thread_id}}
        messages = {"messages": [("human", message)]}

        try:
            for chunk in self.manager_agent.stream(messages, config=config):
                yield chunk
        except Exception as e:
            logger.error(f"Error streaming: {str(e)}")
            yield {"error": str(e)}

    def reset_memory(self) -> None:
        """Clear conversation memory for this thread."""
        # Note: SqliteSaver doesn't have a built-in clear method
        # For now, we just create a new thread
        import uuid
        self.thread_id = f"work_user_{self.user_id}_{uuid.uuid4().hex[:8]}"
        logger.info(f"Memory reset, new thread: {self.thread_id}")

    def close(self) -> None:
        """Clean up resources."""
        logger.info("WorkAssistant closed")


# Convenience function for quick usage
def create_work_assistant(user_id: int = 1) -> WorkAssistant:
    """Create a WorkAssistant instance."""
    return WorkAssistant(user_id=user_id)
