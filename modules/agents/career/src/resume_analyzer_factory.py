"""
Resume Analyzer Factory

This module implements the Factory Pattern for creating resume analyzer instances.
It automatically selects the appropriate implementation (Ollama or vLLM) based on
the LLM_PROVIDER environment variable.

Design Pattern: Factory Pattern
- Abstracts the creation of resume analyzer objects
- Enables runtime switching between Ollama and vLLM
- Centralizes configuration management
- Simplifies dependency injection

Usage:
    # Get the appropriate analyzer based on environment
    analyzer = get_resume_analyzer()

    # Use the analyzer (implementation is transparent)
    result = await analyzer.analyze_resume(content)
"""

import os
import logging
from typing import Optional, Dict, Any

from base_resume_analyzer import BaseResumeAnalyzer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def get_resume_analyzer(llm_provider: Optional[str] = None) -> BaseResumeAnalyzer:
    """
    Create and return the appropriate resume analyzer based on LLM provider.

    This is the main factory function that creates resume analyzer instances.
    It reads the LLM_PROVIDER environment variable (or accepts it as a parameter)
    and returns the corresponding implementation.

    Args:
        llm_provider: Optional LLM provider override. If None, reads from environment.
                     Valid values: "ollama", "vllm"

    Returns:
        BaseResumeAnalyzer: An instance of the appropriate resume analyzer implementation

    Raises:
        ValueError: If LLM provider is unknown or configuration is invalid
        ImportError: If required dependencies are missing

    Environment Variables:
        LLM_PROVIDER: "ollama" or "vllm" (default: "ollama")

        For Ollama:
        - CAREER_LLM_MODEL: Model name (default: gemma3:latest)
        - CAREER_LLM_BASE_URL: Ollama base URL (default: http://localhost:12435)
        - CAREER_LLM_TEMPERATURE: Sampling temperature (default: 0.7)
        - CAREER_LLM_MAX_TOKENS: Max tokens to generate (default: 2048)

        For vLLM:
        - VLLM_MODEL: HuggingFace model name (default: Qwen/Qwen2.5-3B-Instruct)
        - VLLM_API_BASE: vLLM API base URL (default: http://localhost:8888/v1)
        - VLLM_TEMPERATURE: Sampling temperature (default: 0.7)
        - VLLM_MAX_TOKENS: Max tokens to generate (default: 2048)
        - VLLM_TOP_P: Nucleus sampling parameter (default: 0.9)
        - VLLM_FREQUENCY_PENALTY: Frequency penalty (default: 0.0)
        - VLLM_PRESENCE_PENALTY: Presence penalty (default: 0.0)

    Example:
        >>> # Use environment variable
        >>> os.environ['LLM_PROVIDER'] = 'vllm'
        >>> analyzer = get_resume_analyzer()
        >>> isinstance(analyzer, ResumeAnalyzerVLLM)
        True

        >>> # Override with parameter
        >>> analyzer = get_resume_analyzer(llm_provider='ollama')
        >>> isinstance(analyzer, ResumeAnalyzer)
        True
    """
    # Determine LLM provider
    provider = llm_provider or os.getenv('LLM_PROVIDER', 'ollama').lower()

    logger.info(f"[Resume Analyzer Factory] Creating analyzer with provider: {provider}")

    if provider == 'ollama':
        return _create_ollama_analyzer()
    elif provider == 'vllm':
        return _create_vllm_analyzer()
    else:
        logger.error(f"[Resume Analyzer Factory] Unknown LLM provider: {provider}")
        raise ValueError(
            f"Unknown LLM provider: {provider}. "
            f"Valid options are: 'ollama', 'vllm'. "
            f"Please set LLM_PROVIDER environment variable correctly."
        )


def _create_ollama_analyzer() -> BaseResumeAnalyzer:
    """
    Create Ollama-based resume analyzer.

    This function creates a ResumeAnalyzer instance configured for Ollama.
    It wraps the existing ChatService to maintain backward compatibility.

    Returns:
        ResumeAnalyzer: Ollama-based analyzer instance

    Raises:
        ImportError: If ChatService or ResumeAnalyzer cannot be imported
    """
    try:
        from chat_service import ChatService
        from resume_analyzer import ResumeAnalyzer

        # Read Ollama configuration from environment
        model = os.getenv('CAREER_LLM_MODEL', 'gemma3:latest')
        base_url = os.getenv('CAREER_LLM_BASE_URL', 'http://localhost:12435')
        temperature = float(os.getenv('CAREER_LLM_TEMPERATURE', '0.7'))
        max_tokens = int(os.getenv('CAREER_LLM_MAX_TOKENS', '2048'))

        logger.info(f"[Resume Analyzer Factory] Initializing Ollama analyzer:")
        logger.info(f"  Model: {model}")
        logger.info(f"  Base URL: {base_url}")
        logger.info(f"  Temperature: {temperature}")
        logger.info(f"  Max Tokens: {max_tokens}")

        # Create ChatService instance with Ollama configuration
        chat_service = ChatService(
            model_name=model,
            base_url=base_url,
            temperature=temperature,
            max_tokens=max_tokens
        )

        # Create ResumeAnalyzer with ChatService
        analyzer = ResumeAnalyzer(chat_service=chat_service)

        logger.info("[Resume Analyzer Factory] Ollama analyzer created successfully")
        return analyzer

    except ImportError as e:
        logger.error(f"[Resume Analyzer Factory] Failed to import Ollama dependencies: {e}")
        raise ImportError(
            f"Failed to import Ollama dependencies: {e}. "
            f"Ensure chat_service.py and resume_analyzer.py are available."
        )
    except Exception as e:
        logger.error(f"[Resume Analyzer Factory] Failed to create Ollama analyzer: {e}")
        raise


def _create_vllm_analyzer() -> BaseResumeAnalyzer:
    """
    Create vLLM-based resume analyzer.

    This function creates a ResumeAnalyzerVLLM instance configured for vLLM.
    It uses LangChain's ChatOpenAI with vLLM's OpenAI-compatible endpoint.

    Returns:
        ResumeAnalyzerVLLM: vLLM-based analyzer instance

    Raises:
        ImportError: If ResumeAnalyzerVLLM or dependencies cannot be imported
        ValueError: If vLLM configuration is invalid
    """
    try:
        from resume_analyzer_vllm import ResumeAnalyzerVLLM

        # Read vLLM configuration from environment
        model = os.getenv('VLLM_MODEL', 'Qwen/Qwen2.5-3B-Instruct')
        api_base = os.getenv('VLLM_API_BASE', 'http://localhost:8888/v1')
        temperature = float(os.getenv('VLLM_TEMPERATURE', '0.7'))
        max_tokens = int(os.getenv('VLLM_MAX_TOKENS', '2048'))
        top_p = float(os.getenv('VLLM_TOP_P', '0.9'))
        frequency_penalty = float(os.getenv('VLLM_FREQUENCY_PENALTY', '0.0'))
        presence_penalty = float(os.getenv('VLLM_PRESENCE_PENALTY', '0.0'))

        logger.info(f"[Resume Analyzer Factory] Initializing vLLM analyzer:")
        logger.info(f"  Model: {model}")
        logger.info(f"  API Base: {api_base}")
        logger.info(f"  Temperature: {temperature}")
        logger.info(f"  Max Tokens: {max_tokens}")
        logger.info(f"  Top P: {top_p}")
        logger.info(f"  Frequency Penalty: {frequency_penalty}")
        logger.info(f"  Presence Penalty: {presence_penalty}")

        # Validate vLLM server availability (optional - can be removed if too slow)
        # This is a quick check to fail fast if vLLM is not running
        try:
            import httpx
            import asyncio

            async def check_vllm_health():
                async with httpx.AsyncClient(timeout=5.0) as client:
                    try:
                        # Try to reach the models endpoint
                        response = await client.get(f"{api_base}/models")
                        if response.status_code == 200:
                            logger.info("[Resume Analyzer Factory] vLLM server is reachable")
                            return True
                        else:
                            logger.warning(f"[Resume Analyzer Factory] vLLM server returned status {response.status_code}")
                            return False
                    except Exception as e:
                        logger.warning(f"[Resume Analyzer Factory] vLLM health check failed: {e}")
                        return False

            # Run health check (non-blocking)
            # Note: This is optional and can be removed for faster initialization
            # asyncio.run(check_vllm_health())

        except Exception as health_error:
            logger.debug(f"[Resume Analyzer Factory] Skipped vLLM health check: {health_error}")

        # Create ResumeAnalyzerVLLM instance
        analyzer = ResumeAnalyzerVLLM(
            model_name=model,
            api_base=api_base,
            temperature=temperature,
            max_tokens=max_tokens,
            top_p=top_p,
            frequency_penalty=frequency_penalty,
            presence_penalty=presence_penalty,
            request_timeout=300.0  # 5 minutes timeout for resume analysis
        )

        logger.info("[Resume Analyzer Factory] vLLM analyzer created successfully")
        return analyzer

    except ImportError as e:
        logger.error(f"[Resume Analyzer Factory] Failed to import vLLM dependencies: {e}")
        raise ImportError(
            f"Failed to import vLLM dependencies: {e}. "
            f"Ensure resume_analyzer_vllm.py and LangChain dependencies are installed. "
            f"Run: pip install langchain-openai"
        )
    except ValueError as e:
        logger.error(f"[Resume Analyzer Factory] Invalid vLLM configuration: {e}")
        raise ValueError(
            f"Invalid vLLM configuration: {e}. "
            f"Check your environment variables (VLLM_MODEL, VLLM_API_BASE, etc.)"
        )
    except Exception as e:
        logger.error(f"[Resume Analyzer Factory] Failed to create vLLM analyzer: {e}")
        raise


def validate_configuration(llm_provider: Optional[str] = None) -> Dict[str, Any]:
    """
    Validate resume analyzer configuration for the specified provider.

    This is a utility function for debugging and configuration verification.
    It checks that all required environment variables are set and valid.

    Args:
        llm_provider: Optional LLM provider to validate. If None, uses LLM_PROVIDER env var.

    Returns:
        Dictionary containing configuration status and details

    Example:
        >>> config = validate_configuration('vllm')
        >>> print(config['status'])
        'valid'
        >>> print(config['provider'])
        'vllm'
        >>> print(config['config']['model'])
        'Qwen/Qwen2.5-3B-Instruct'
    """
    provider = llm_provider or os.getenv('LLM_PROVIDER', 'ollama').lower()

    result = {
        'status': 'unknown',
        'provider': provider,
        'config': {},
        'errors': [],
        'warnings': []
    }

    try:
        if provider == 'ollama':
            config = {
                'model': os.getenv('CAREER_LLM_MODEL', 'gemma3:latest'),
                'base_url': os.getenv('CAREER_LLM_BASE_URL', 'http://localhost:12435'),
                'temperature': os.getenv('CAREER_LLM_TEMPERATURE', '0.7'),
                'max_tokens': os.getenv('CAREER_LLM_MAX_TOKENS', '2048')
            }

            # Validate temperature and max_tokens
            try:
                temp = float(config['temperature'])
                if not 0 <= temp <= 2:
                    result['warnings'].append(f"Temperature {temp} is outside recommended range [0, 2]")
            except ValueError:
                result['errors'].append(f"Invalid temperature value: {config['temperature']}")

            try:
                max_tok = int(config['max_tokens'])
                if max_tok <= 0:
                    result['errors'].append(f"Max tokens must be positive: {max_tok}")
            except ValueError:
                result['errors'].append(f"Invalid max_tokens value: {config['max_tokens']}")

        elif provider == 'vllm':
            config = {
                'model': os.getenv('VLLM_MODEL', 'Qwen/Qwen2.5-3B-Instruct'),
                'api_base': os.getenv('VLLM_API_BASE', 'http://localhost:8888/v1'),
                'temperature': os.getenv('VLLM_TEMPERATURE', '0.7'),
                'max_tokens': os.getenv('VLLM_MAX_TOKENS', '2048'),
                'top_p': os.getenv('VLLM_TOP_P', '0.9'),
                'frequency_penalty': os.getenv('VLLM_FREQUENCY_PENALTY', '0.0'),
                'presence_penalty': os.getenv('VLLM_PRESENCE_PENALTY', '0.0')
            }

            # Validate numeric parameters
            try:
                temp = float(config['temperature'])
                if not 0 <= temp <= 2:
                    result['warnings'].append(f"Temperature {temp} is outside recommended range [0, 2]")
            except ValueError:
                result['errors'].append(f"Invalid temperature value: {config['temperature']}")

            try:
                max_tok = int(config['max_tokens'])
                if max_tok <= 0:
                    result['errors'].append(f"Max tokens must be positive: {max_tok}")
            except ValueError:
                result['errors'].append(f"Invalid max_tokens value: {config['max_tokens']}")

            try:
                top_p = float(config['top_p'])
                if not 0 <= top_p <= 1:
                    result['warnings'].append(f"Top P {top_p} is outside recommended range [0, 1]")
            except ValueError:
                result['errors'].append(f"Invalid top_p value: {config['top_p']}")

        else:
            result['errors'].append(f"Unknown provider: {provider}")
            result['status'] = 'invalid'
            return result

        result['config'] = config
        result['status'] = 'valid' if not result['errors'] else 'invalid'

    except Exception as e:
        result['status'] = 'error'
        result['errors'].append(f"Configuration validation failed: {str(e)}")

    return result
