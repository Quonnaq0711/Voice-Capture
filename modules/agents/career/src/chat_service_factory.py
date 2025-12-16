"""
Chat Service Factory for Career Agent

This module implements the Factory Pattern to create chat service instances
based on environment configuration. It allows seamless switching between
different LLM providers (Ollama, vLLM) without code changes.

Design Pattern: Factory Pattern + Singleton Pattern
SOLID Principles: Dependency Inversion, Open/Closed

Usage:
    from chat_service_factory import get_chat_service

    # Get chat service (automatically selects based on LLM_PROVIDER env var)
    chat_service = get_chat_service()

    # Use the service
    response = await chat_service.generate_response("Hello!")

Configuration (via environment variables):
    LLM_PROVIDER=ollama  # Use Ollama (default)
    LLM_PROVIDER=vllm    # Use vLLM (shared with Personal Assistant)
"""

import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

import logging
import threading
from typing import Optional
from base_chat_service import BaseChatService

logger = logging.getLogger(__name__)

# Global singleton instance and thread lock for thread-safe initialization
_chat_service_instance: Optional[BaseChatService] = None
_instance_lock = threading.Lock()


def get_chat_service() -> BaseChatService:
    """
    Factory method to get or create chat service instance.

    This function acts as a factory that creates the appropriate chat service
    implementation based on the LLM_PROVIDER environment variable.

    Supported Providers:
    - ollama: Ollama local LLM deployment (default)
    - vllm: vLLM high-performance inference engine (shared with Personal Assistant)

    Returns:
        BaseChatService: Chat service instance (Ollama or vLLM implementation)

    Raises:
        ValueError: If unsupported LLM provider is specified
        ImportError: If required dependencies are not installed

    Environment Variables:
        LLM_PROVIDER: Provider selection (ollama|vllm)

        Ollama Configuration:
        - CAREER_LLM_MODEL: Model name (default: gemma3:latest)
        - CAREER_LLM_BASE_URL: Ollama server URL (default: http://localhost:12435)
        - CAREER_OLLAMA_URL: Alternative Ollama URL (fallback)

        vLLM Configuration (Shared with Personal Assistant):
        - VLLM_MODEL: HuggingFace model name (default: Qwen/Qwen2.5-3B-Instruct)
        - VLLM_API_BASE: vLLM server URL (default: http://localhost:8888/v1)
        - VLLM_TEMPERATURE: Sampling temperature (default: 0.7)
        - VLLM_MAX_TOKENS: Max generation tokens (default: 2048)
        - VLLM_TOP_P: Nucleus sampling parameter (default: 0.9)
        - VLLM_FREQUENCY_PENALTY: Frequency penalty (default: 0.0)
        - VLLM_PRESENCE_PENALTY: Presence penalty (default: 0.0)
        - VLLM_MAX_HISTORY_TURNS: Sliding window size in turns (default: 10)
        - VLLM_MAX_MODEL_LEN: Model max context length (default: 4096)
        - VLLM_SAFETY_MARGIN: Reserved tokens for response (default: 512)

    Example:
        >>> # Using Ollama (default)
        >>> os.environ["LLM_PROVIDER"] = "ollama"
        >>> service = get_chat_service()
        >>> # ChatService instance created

        >>> # Using vLLM (shared with Personal Assistant on port 8888)
        >>> os.environ["LLM_PROVIDER"] = "vllm"
        >>> os.environ["VLLM_MODEL"] = "Qwen/Qwen2.5-3B-Instruct"
        >>> service = get_chat_service()
        >>> # ChatServiceVLLM instance created
    """
    global _chat_service_instance

    # First check (without lock) - fast path for already initialized instance
    if _chat_service_instance is not None:
        return _chat_service_instance

    # Thread-safe initialization using double-checked locking pattern
    with _instance_lock:
        # Second check (with lock) - ensure no other thread created instance while waiting
        if _chat_service_instance is not None:
            return _chat_service_instance

        # Get provider from environment
        provider = os.getenv("LLM_PROVIDER", "ollama").lower().strip()

        logger.info("="*60)
        logger.info(f"[Career Agent] Initializing Chat Service Factory (thread-safe)")
        logger.info(f"Provider: {provider}")
        logger.info("="*60)

        # Create service based on provider
        if provider == "vllm":
            _chat_service_instance = _create_vllm_service()
        elif provider == "ollama":
            _chat_service_instance = _create_ollama_service()
        else:
            raise ValueError(
                f"Unsupported LLM provider: {provider}. "
                f"Supported providers: ollama, vllm"
            )

        logger.info("="*60)
        logger.info(f"[Career Agent] Chat Service Initialized Successfully")
        logger.info(f"Provider: {provider}")
        logger.info("="*60)

        return _chat_service_instance


def _create_vllm_service() -> BaseChatService:
    """
    Create vLLM chat service instance.

    This function creates a ChatServiceVLLM instance with configuration
    loaded from environment variables. The vLLM instance is SHARED with
    Personal Assistant (both use the same vLLM server on port 8888).

    Returns:
        ChatServiceVLLM instance

    Raises:
        ImportError: If vLLM dependencies are not installed
    """
    try:
        from chat_service_vllm import ChatServiceVLLM
    except ImportError as e:
        logger.error("[Career Agent] Failed to import ChatServiceVLLM. Make sure vLLM dependencies are installed.")
        logger.error("Run: pip install vllm langchain-openai")
        raise ImportError(
            "vLLM dependencies not installed. "
            "Run: pip install vllm==0.11.0 langchain-openai>=0.2.0"
        ) from e

    # Load configuration from environment (shared with Personal Assistant)
    model_name = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-3B-Instruct")
    api_base = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
    temperature = float(os.getenv("VLLM_TEMPERATURE", "0.7"))
    max_tokens = int(os.getenv("VLLM_MAX_TOKENS", "2048"))
    top_p = float(os.getenv("VLLM_TOP_P", "0.9"))
    frequency_penalty = float(os.getenv("VLLM_FREQUENCY_PENALTY", "0.0"))
    presence_penalty = float(os.getenv("VLLM_PRESENCE_PENALTY", "0.0"))
    max_history_turns = int(os.getenv("VLLM_MAX_HISTORY_TURNS", "10"))
    max_model_len = int(os.getenv("VLLM_MAX_MODEL_LEN", "4096"))
    safety_margin = int(os.getenv("VLLM_SAFETY_MARGIN", "512"))

    logger.info("🚀 [Career Agent] Creating vLLM Chat Service (SHARED with Personal Assistant)")
    logger.info(f"  Model: {model_name}")
    logger.info(f"  API Base: {api_base}")
    logger.info(f"  Temperature: {temperature}")
    logger.info(f"  Max Tokens: {max_tokens}")
    logger.info(f"  Top P: {top_p}")
    logger.info(f"  Max History Turns: {max_history_turns}")
    logger.info(f"  Max Model Length: {max_model_len}")
    logger.info(f"  Safety Margin: {safety_margin}")

    return ChatServiceVLLM(
        model_name=model_name,
        api_base=api_base,
        temperature=temperature,
        max_tokens=max_tokens,
        top_p=top_p,
        frequency_penalty=frequency_penalty,
        presence_penalty=presence_penalty,
        max_history_turns=max_history_turns,
        max_model_len=max_model_len,
        safety_margin=safety_margin
    )


def _create_ollama_service() -> BaseChatService:
    """
    Create Ollama chat service instance.

    This function creates a ChatService instance with configuration
    loaded from environment variables.

    Returns:
        ChatService instance

    Raises:
        ImportError: If Ollama dependencies are not installed
    """
    try:
        from chat_service import ChatService
    except ImportError as e:
        logger.error("[Career Agent] Failed to import ChatService. Make sure Ollama dependencies are installed.")
        logger.error("Run: pip install langchain-ollama")
        raise ImportError(
            "Ollama dependencies not installed. "
            "Run: pip install langchain-ollama"
        ) from e

    # Load configuration from environment
    model_name = os.getenv("CAREER_LLM_MODEL", "gemma3:latest")

    # Try CAREER_LLM_BASE_URL first, then fall back to CAREER_OLLAMA_URL
    base_url = os.getenv(
        "CAREER_LLM_BASE_URL",
        os.getenv("CAREER_OLLAMA_URL", "http://ollama2-staging:11434")
    )

    logger.info("🦙 [Career Agent] Creating Ollama Chat Service")
    logger.info(f"  Model: {model_name}")
    logger.info(f"  Base URL: {base_url}")

    return ChatService(
        model_name=model_name,
        base_url=base_url
    )


def reset_chat_service():
    """
    Reset the global chat service instance.

    This function clears the cached singleton instance, forcing a new
    instance to be created on the next get_chat_service() call.

    Useful for:
    - Testing: Reset state between test cases
    - Configuration changes: Force reload with new environment variables
    - Error recovery: Recreate service after failures

    Warning:
        This will discard all in-memory conversation history.
        Use with caution in production environments.

    Example:
        >>> # Change provider
        >>> os.environ["LLM_PROVIDER"] = "vllm"
        >>> reset_chat_service()
        >>> service = get_chat_service()  # Creates new vLLM instance
    """
    global _chat_service_instance

    # Cleanup existing instance before resetting to prevent resource leaks
    if _chat_service_instance is not None:
        try:
            if hasattr(_chat_service_instance, 'cleanup'):
                _chat_service_instance.cleanup()
                logger.info("[Career Agent] Chat service cleanup completed")
        except Exception as e:
            logger.error(f"[Career Agent] Error during chat service cleanup: {e}")

    _chat_service_instance = None
    logger.info("[Career Agent] Chat service instance reset")


def get_current_provider() -> str:
    """
    Get the currently configured LLM provider.

    Returns:
        str: Current provider name ("ollama" or "vllm")

    Example:
        >>> provider = get_current_provider()
        >>> print(f"Using {provider} provider")
    """
    return os.getenv("LLM_PROVIDER", "ollama").lower().strip()


def is_vllm_provider() -> bool:
    """
    Check if current provider is vLLM.

    Returns:
        bool: True if using vLLM, False otherwise

    Example:
        >>> if is_vllm_provider():
        ...     print("Using high-performance vLLM!")
    """
    return get_current_provider() == "vllm"


def is_ollama_provider() -> bool:
    """
    Check if current provider is Ollama.

    Returns:
        bool: True if using Ollama, False otherwise

    Example:
        >>> if is_ollama_provider():
        ...     print("Using Ollama for local development")
    """
    return get_current_provider() == "ollama"


# Convenience function for backwards compatibility
def get_chat_service_instance() -> BaseChatService:
    """
    Alias for get_chat_service().

    This function exists for backwards compatibility with code that
    might use the longer function name.

    Returns:
        BaseChatService: Chat service instance

    Example:
        >>> service = get_chat_service_instance()
    """
    return get_chat_service()
