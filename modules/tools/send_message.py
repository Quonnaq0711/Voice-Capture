"""
SendMessage Tool for Inter-Agent Communication.

This tool enables the manager agent to delegate tasks to specialized sub-agents.
Each sub-agent can be invoked by name with a specific task message.
"""
import logging
from typing import Optional, Type, Dict, Any

from pydantic import BaseModel, Field
from langchain.tools import BaseTool
from langchain_core.callbacks import CallbackManagerForToolRun

logger = logging.getLogger(__name__)


class SendMessage(BaseTool):
    """
    Tool for sending messages between agents.

    The manager agent uses this tool to delegate tasks to specialized sub-agents.
    The tool dynamically generates available recipients based on registered agents.
    """

    name: str = "SendMessage"
    description: str = "Use this to send a task to one of your specialized sub-agents. Each sub-agent has specific expertise."
    args_schema: Type[BaseModel]
    agent_mapping: Dict[str, Any] = None

    def send_message(self, recipient: str, message: str) -> str:
        """
        Send a message to a sub-agent and get their response.

        Args:
            recipient: Name of the target agent
            message: Task or question to send to the agent

        Returns:
            The agent's response as a string
        """
        if not self.agent_mapping:
            return "Error: Agent mapping not configured"

        agent = self.agent_mapping.get(recipient)

        if not agent:
            available = ", ".join(self.agent_mapping.keys())
            return f"Error: Unknown agent '{recipient}'. Available agents: {available}"

        try:
            logger.info(f"Delegating to {recipient}: {message[:100]}...")
            response = agent.invoke({"messages": [("human", message)]})

            # Extract the final message content
            if "messages" in response and len(response["messages"]) > 0:
                final_message = response["messages"][-1]
                if hasattr(final_message, 'content'):
                    return final_message.content
                return str(final_message)

            return str(response)

        except Exception as e:
            logger.error(f"Error delegating to {recipient}: {str(e)}")
            return f"Error communicating with {recipient}: {str(e)}"

    def _run(
        self,
        recipient: str,
        message: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool synchronously."""
        return self.send_message(recipient, message)

    async def _arun(
        self,
        recipient: str,
        message: str,
        run_manager: Optional[CallbackManagerForToolRun] = None,
    ) -> str:
        """Execute the tool asynchronously."""
        # For now, use sync version
        return self.send_message(recipient, message)
