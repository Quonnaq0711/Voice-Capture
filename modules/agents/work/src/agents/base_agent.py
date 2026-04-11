"""
Base Agent class for Work Agent using LangGraph and vLLM.

This is the foundation class for all specialized agents (Todo, Calendar, Email, etc.)
Uses vLLM's OpenAI-compatible API through LangChain.
"""
import os
import logging
from typing import List, Optional, Any, Dict

from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage

logger = logging.getLogger(__name__)


class Agent:
    """
    Base agent class using LangGraph's ReAct pattern.

    Each agent has:
    - A unique name and description
    - A system prompt defining its role and SOP
    - A list of tools it can use
    - Optional sub-agents it can delegate to
    - Optional memory for conversation persistence
    """

    def __init__(
        self,
        name: str,
        description: str,
        system_prompt: str,
        tools: List[Any],
        sub_agents: Optional[List['Agent']] = None,
        temperature: float = 0.1,
        memory: Any = None,
        max_tokens: int = 2048
    ):
        """
        Initialize an agent.

        Args:
            name: Unique identifier for the agent
            description: Brief description of the agent's purpose (used for routing)
            system_prompt: Detailed instructions for the agent's behavior
            tools: List of LangChain tools the agent can use
            sub_agents: List of agents this agent can delegate to
            temperature: LLM temperature (lower = more precise)
            memory: Optional checkpointer for conversation memory
            max_tokens: Maximum tokens for LLM response
        """
        self.name = name
        self.description = description
        self.system_prompt = system_prompt
        self.tools = list(tools)  # Make a copy to avoid mutation
        self.sub_agents = sub_agents or []
        self.temperature = temperature
        self.memory = memory
        self.max_tokens = max_tokens
        self.agent = None

    def _get_llm(self) -> ChatOpenAI:
        """
        Create vLLM instance via OpenAI-compatible API.

        Uses environment variables for configuration:
        - VLLM_MODEL: Model name (default: Qwen/Qwen2.5-3B-Instruct)
        - VLLM_API_BASE: API endpoint (default: http://localhost:8888/v1)
        - VLLM_MAX_TOKENS: Max tokens (default: 2048)
        """
        model = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-3B-Instruct")
        api_base = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
        max_tokens = int(os.getenv("VLLM_MAX_TOKENS", str(self.max_tokens)))

        logger.info(f"Agent '{self.name}' using vLLM model: {model} at {api_base}")

        return ChatOpenAI(
            model=model,
            base_url=api_base,
            api_key=os.getenv("VLLM_API_KEY", "not-needed"),
            temperature=self.temperature,
            max_tokens=max_tokens
        )

    def _create_prompt_callable(self):
        """
        Create a prompt callable that:
        1. Prepends the system prompt
        2. Ensures roles strictly alternate user/assistant

        This is required for vLLM with hermes tool calling parser.
        The callable receives the full graph state and returns messages for the LLM.
        """
        system_prompt = self.system_prompt

        def prompt_callable(state: dict) -> List:
            """Process state messages to ensure proper format for vLLM."""
            # Get messages from state
            messages = state.get("messages", [])

            # Start with system message
            modified = [SystemMessage(content=system_prompt)]

            # Process conversation messages, ensuring alternation
            last_role = "system"

            for msg in messages:
                if isinstance(msg, HumanMessage):
                    current_role = "user"
                elif isinstance(msg, AIMessage):
                    current_role = "assistant"
                elif isinstance(msg, SystemMessage):
                    # Skip additional system messages
                    continue
                else:
                    # Handle tuple format from LangGraph
                    if isinstance(msg, tuple) and len(msg) == 2:
                        role, content = msg
                        if role in ("human", "user"):
                            msg = HumanMessage(content=content)
                            current_role = "user"
                        elif role in ("ai", "assistant"):
                            msg = AIMessage(content=content)
                            current_role = "assistant"
                        else:
                            continue
                    else:
                        # Unknown message type, try to extract content
                        if hasattr(msg, 'content'):
                            # Treat as user message by default
                            msg = HumanMessage(content=str(msg.content))
                            current_role = "user"
                        else:
                            continue

                # Skip consecutive messages with same role
                if current_role == last_role:
                    # Replace last message with current one
                    if modified and not isinstance(modified[-1], SystemMessage):
                        modified[-1] = msg
                    continue

                modified.append(msg)
                last_role = current_role

            # Ensure conversation ends with user message for vLLM
            if modified and isinstance(modified[-1], AIMessage):
                modified.pop()

            return modified

        return prompt_callable

    def initiate_agent(self) -> None:
        """
        Initialize the LangGraph agent with ReAct pattern.

        Creates a ReAct agent that can reason and act using the provided tools.
        If memory is provided, enables conversation persistence.
        """
        llm = self._get_llm()

        # Create ReAct agent with prompt callable for vLLM compatibility
        checkpointer_config = {"checkpointer": self.memory} if self.memory else {"checkpointer": False}

        self.agent = create_react_agent(
            llm,
            tools=self.tools,
            prompt=self._create_prompt_callable(),
            **checkpointer_config
        )

        logger.info(f"Agent '{self.name}' initialized with {len(self.tools)} tools")

    def invoke(self, messages: Dict, config: Optional[Dict] = None) -> Dict:
        """
        Invoke the agent with a message.

        Args:
            messages: Dict with 'messages' key containing list of (role, content) tuples
            config: Optional configuration dict (e.g., thread_id for memory)

        Returns:
            Dict containing the agent's response
        """
        if not self.agent:
            self.initiate_agent()

        logger.info(f"--- Invoking {self.name} ---")

        try:
            response = self.agent.invoke(messages, config=config or {})
            return response
        except Exception as e:
            logger.error(f"Error in agent {self.name}: {str(e)}")
            raise

    async def ainvoke(self, messages: Dict, config: Optional[Dict] = None) -> Dict:
        """Async version of invoke."""
        if not self.agent:
            self.initiate_agent()

        logger.info(f"--- Async invoking {self.name} ---")

        try:
            response = await self.agent.ainvoke(messages, config=config or {})
            return response
        except Exception as e:
            logger.error(f"Error in agent {self.name}: {str(e)}")
            raise

    def stream(self, messages: Dict, config: Optional[Dict] = None):
        """
        Stream responses from the agent.

        Yields chunks of the response as they are generated.
        """
        if not self.agent:
            self.initiate_agent()

        logger.info(f"--- Streaming from {self.name} ---")

        try:
            for chunk in self.agent.stream(messages, config=config or {}):
                yield chunk
        except Exception as e:
            logger.error(f"Error streaming from agent {self.name}: {str(e)}")
            raise

    def __repr__(self) -> str:
        return f"<Agent(name='{self.name}', tools={len(self.tools)})>"
