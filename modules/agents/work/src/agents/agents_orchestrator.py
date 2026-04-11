"""
Agents Orchestrator for Work Agent.

Manages multi-agent communication by:
1. Creating a mapping of agent names to agent instances
2. Dynamically generating SendMessage tools for agents with sub-agents
3. Routing messages through the manager agent
"""
import logging
from typing import List, Dict, Any, Optional

from pydantic import Field, create_model

from modules.agents.work.src.agents.base_agent import Agent
from modules.tools.send_message import SendMessage

logger = logging.getLogger(__name__)


class AgentsOrchestrator:
    """
    Orchestrates communication between multiple agents.

    The orchestrator:
    - Maintains a mapping of agent names to instances
    - Creates SendMessage tools for agents that have sub-agents
    - Routes user messages through the main (manager) agent
    """

    def __init__(self, main_agent: Agent, agents: List[Agent]):
        """
        Initialize the orchestrator.

        Args:
            main_agent: The primary agent that receives user messages
            agents: List of all agents (including main_agent and sub-agents)
        """
        self.main_agent = main_agent
        self.agents = agents
        self.agent_mapping: Dict[str, Agent] = {}

        # Set up the communication framework
        self._populate_agent_mapping()
        self._add_send_message_tools()

        logger.info(f"Orchestrator initialized with {len(agents)} agents")

    def _populate_agent_mapping(self) -> None:
        """Create a mapping of agent names to agent instances."""
        for agent in self.agents:
            self.agent_mapping[agent.name] = agent
            logger.debug(f"Registered agent: {agent.name}")

    def _create_send_message_tool(self, agent: Agent) -> SendMessage:
        """
        Create a SendMessage tool for an agent with sub-agents.

        Dynamically generates a Pydantic model with the available recipients
        listed in the field description.
        """
        # Generate description of available recipients
        recipients_description = "\n".join(
            f"- {sub_agent.name}: {sub_agent.description}"
            for sub_agent in agent.sub_agents
            if sub_agent.description
        )

        # Create dynamic input schema with recipient options
        DynamicSendMessageInput = create_model(
            f"{agent.name}SendMessageInput",
            recipient=(
                str,
                Field(
                    ...,
                    description=f"Name of the agent to send the message to. Available agents:\n{recipients_description}"
                )
            ),
            message=(
                str,
                Field(..., description="The task or question to send to the agent")
            ),
        )

        # Create and configure the tool
        send_message_tool = SendMessage(args_schema=DynamicSendMessageInput)
        send_message_tool.agent_mapping = self.agent_mapping

        return send_message_tool

    def _add_send_message_tools(self) -> None:
        """Add SendMessage tools to agents that have sub-agents."""
        for agent in self.agents:
            if agent.sub_agents:
                send_message_tool = self._create_send_message_tool(agent)
                agent.tools.append(send_message_tool)

                # Reinitialize the agent with the new tool
                agent.initiate_agent()

                logger.info(f"Added SendMessage tool to {agent.name} with {len(agent.sub_agents)} sub-agents")

    def invoke(self, message: str, config: Optional[Dict] = None) -> str:
        """
        Process a user message through the main agent.

        Args:
            message: User's message/request
            config: Optional configuration (e.g., thread_id for memory)

        Returns:
            The agent's response as a string
        """
        messages = {"messages": [("human", message)]}

        try:
            response = self.main_agent.invoke(messages, config=config)

            # Extract final response content
            if "messages" in response and len(response["messages"]) > 0:
                final_message = response["messages"][-1]
                if hasattr(final_message, 'content'):
                    return final_message.content
                return str(final_message)

            return str(response)

        except Exception as e:
            logger.error(f"Error in orchestrator: {str(e)}")
            return f"I encountered an error processing your request: {str(e)}"

    async def ainvoke(self, message: str, config: Optional[Dict] = None) -> str:
        """Async version of invoke."""
        messages = {"messages": [("human", message)]}

        try:
            response = await self.main_agent.ainvoke(messages, config=config)

            if "messages" in response and len(response["messages"]) > 0:
                final_message = response["messages"][-1]
                if hasattr(final_message, 'content'):
                    return final_message.content
                return str(final_message)

            return str(response)

        except Exception as e:
            logger.error(f"Error in orchestrator: {str(e)}")
            return f"I encountered an error processing your request: {str(e)}"

    def stream(self, message: str, config: Optional[Dict] = None):
        """Stream responses from the main agent."""
        messages = {"messages": [("human", message)]}

        try:
            for chunk in self.main_agent.stream(messages, config=config):
                yield chunk
        except Exception as e:
            logger.error(f"Error streaming: {str(e)}")
            yield {"error": str(e)}

    def get_agent(self, name: str) -> Optional[Agent]:
        """Get an agent by name."""
        return self.agent_mapping.get(name)
