"""
Ollama Resume Analyzer Implementation

This module implements resume analysis using Ollama's local LLM service.
It extends BaseResumeAnalyzer and uses the Career Agent's ChatService for LLM interactions.

This is the original implementation, refactored to use the Factory Pattern.
For better performance, consider using ResumeAnalyzerVLLM instead (2-5x faster).

Supported Models:
- gemma3:latest (default)
- llama2, llama3, mistral, etc. (any Ollama-compatible model)
"""

import os
import sys
import logging
from typing import Dict, Any, Optional, List
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

from base_resume_analyzer import BaseResumeAnalyzer
from chat_service import ChatService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ResumeAnalyzer(BaseResumeAnalyzer):
    """
    Ollama-based resume analyzer implementation.

    Uses Ollama's local LLM service through the Career Agent's ChatService.
    This is the original implementation, now refactored to extend BaseResumeAnalyzer.

    Key Features:
    - Local LLM inference (no cloud API required)
    - Conversation-based analysis
    - Chat history support via ChatService
    - Compatible with any Ollama model
    - Inherits all database operations from BaseResumeAnalyzer

    Note:
        For production deployments or better performance, consider using
        ResumeAnalyzerVLLM instead (2-5x faster with better concurrency).
    """

    def __init__(self, chat_service: Optional[ChatService] = None):
        """
        Initialize Ollama resume analyzer.

        Args:
            chat_service: Optional ChatService instance to use for LLM interactions.
                         If None, creates a new ChatService with default settings.
        """
        super().__init__()

        # Use provided ChatService or create new one
        self.chat_service = chat_service or ChatService()

        logger.info("ResumeAnalyzer initialized successfully (Ollama-based)")
        logger.info(f"  Model: {self.chat_service.model_name}")
        logger.info(f"  Base URL: {self.chat_service.base_url}")

    async def _generate_llm_response(
        self,
        messages: List[Dict[str, str]],
        session_id: str = "default"
    ) -> str:
        """
        Generate LLM response using Ollama's ChatService.

        This method implements the abstract method from BaseResumeAnalyzer.
        It uses the ChatService's conversation chain for Ollama interactions.

        Args:
            messages: List of message dictionaries with 'role' and 'content'
            session_id: Session identifier for conversation tracking

        Returns:
            LLM-generated response text

        Raises:
            Exception: If LLM invocation fails

        Note:
            Ollama uses a conversation-based approach where messages are formatted
            into a single prompt string. The ChatService handles this formatting
            via _format_messages_for_ollama().
        """
        try:
            logger.debug(f"[Ollama Resume Analyzer] Sending {len(messages)} messages to Ollama")

            # Format messages for Ollama using ChatService's formatter
            formatted_prompt = self.chat_service._format_messages_for_ollama(messages)

            logger.debug(f"[Ollama Resume Analyzer] Formatted prompt length: {len(formatted_prompt)} characters")

            # Generate response using ChatService
            response = await self.chat_service.generate_response(formatted_prompt, session_id)

            # Extract response text
            response_text = response.get("response", "")

            logger.debug(f"[Ollama Resume Analyzer] Response length: {len(response_text)} characters")

            return response_text.strip()

        except Exception as e:
            logger.error(f"[Ollama Resume Analyzer] Error generating LLM response: {str(e)}")
            raise

    async def _extract_json_from_response(self, response_text: str) -> Dict[str, Any]:
        """
        Extract and parse JSON from Ollama response.

        Ollama responses typically include the JSON directly, but may sometimes
        include explanatory text or markdown formatting around it.

        Args:
            response_text: Raw LLM response containing JSON

        Returns:
            Parsed JSON dictionary

        Raises:
            ValueError: If no valid JSON found in response
            json.JSONDecodeError: If JSON parsing fails

        Note:
            This implementation is identical to vLLM's JSON extraction, as both
            providers may wrap JSON in similar ways (code blocks, extra text, etc.).
        """
        try:
            # Find JSON content (it might be wrapped in ```json ... ``` or other markers)
            json_start = response_text.find('{')
            json_end = response_text.rfind('}')

            if json_start >= 0 and json_end >= 0:
                json_str = response_text[json_start:json_end+1]

                try:
                    # Attempt direct parsing
                    professional_data = json.loads(json_str)
                    logger.debug("[Ollama Resume Analyzer] Successfully parsed JSON on first attempt")
                    return professional_data

                except json.JSONDecodeError as e:
                    logger.warning(f"[Ollama Resume Analyzer] Initial JSON parsing failed: {e}. Attempting cleanup...")

                    # Try to clean up the JSON string
                    cleaned_json = self._clean_json_string(json_str)
                    professional_data = json.loads(cleaned_json)

                    logger.info("[Ollama Resume Analyzer] Successfully parsed JSON after cleanup")
                    return professional_data

            else:
                raise ValueError("[Ollama Resume Analyzer] No JSON object found in LLM response")

        except json.JSONDecodeError as e:
            logger.error(f"[Ollama Resume Analyzer] Failed to parse JSON even after cleanup: {str(e)}")
            logger.debug(f"Problematic JSON string (first 500 chars): {json_str[:500] if 'json_str' in locals() else 'N/A'}")
            raise
        except Exception as e:
            logger.error(f"[Ollama Resume Analyzer] Error extracting JSON from response: {str(e)}")
            raise

    # Note: _clean_json_string is inherited from BaseResumeAnalyzer
    # If Ollama-specific JSON cleaning is needed, override the method here
