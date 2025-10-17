"""
Base Chat Service Abstract Class

This module defines the abstract base class for chat services, providing
a unified interface for different LLM implementations (Ollama, vLLM, OpenAI, etc.).

Design Pattern: Abstract Factory Pattern
SOLID Principles: Dependency Inversion Principle
"""

import asyncio
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, AsyncIterator, Any
from sqlalchemy.orm import Session
import logging

logger = logging.getLogger(__name__)


class BaseChatService(ABC):
    """
    Abstract base class for chat services.

    This class defines the interface that all chat service implementations must follow.
    It ensures consistency across different LLM providers (Ollama, vLLM, OpenAI, etc.)
    and enables easy switching between implementations at runtime.

    Key Methods:
    - generate_response: Generate a standard AI response
    - generate_streaming_response: Generate streaming AI response (SSE)
    - generate_follow_up_questions: Generate contextual follow-up questions
    - optimize_query: Improve user query clarity and structure
    - health_check: Check service health status
    - clear_memory: Clear conversation history
    - get_conversation_history: Retrieve conversation history
    - remove_messages_after_index: Remove messages after specific index
    - update_message_at_index: Update a specific message
    - get_user_profile: Retrieve user profile data
    """

    @abstractmethod
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
            db: Optional database session for profile queries
            cancellation_event: Optional event to signal cancellation

        Returns:
            Dictionary containing:
            - response: AI-generated response text
            - follow_up_questions: List of suggested follow-up questions
            - model: Model name used for generation
            - session_id: Session identifier
            - status: "success" or "error"
            - error: Optional error message

        Raises:
            asyncio.CancelledError: If request is cancelled
            Exception: For other errors
        """
        pass

    @abstractmethod
    async def generate_streaming_response(
        self,
        user_message: str,
        session_id: Optional[str] = None,
        user_id: Optional[int] = None,
        db: Optional[Session] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        Generate streaming AI response for user message using Server-Sent Events.

        Args:
            user_message: User's input message
            session_id: Optional session ID for conversation context
            user_id: Optional user ID for profile context
            db: Optional database session for profile queries

        Yields:
            Dictionary chunks with:
            - type: "token", "complete", or "error"
            - content: Token text or full response
            - follow_up_questions: List of questions (only in "complete" type)

        Raises:
            Exception: For streaming errors
        """
        pass

    @abstractmethod
    async def generate_follow_up_questions(
        self,
        user_message: str,
        ai_response: str,
        session_id: str = "default",
        profile_data: Optional[Dict[str, Any]] = None,
        cancellation_event: Optional[asyncio.Event] = None
    ) -> List[str]:
        """
        Generate contextual follow-up questions based on conversation.

        Args:
            user_message: Original user message
            ai_response: AI's response to the user message
            session_id: Session identifier
            profile_data: Optional user profile data for personalization
            cancellation_event: Optional event to check for cancellation

        Returns:
            List of 3 follow-up questions

        Raises:
            Exception: For generation errors
        """
        pass

    @abstractmethod
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
            Dictionary containing:
            - original_query: Original user query
            - optimized_query: Improved query
            - model: Model name used
            - status: "success" or "error"
            - error: Optional error message

        Raises:
            asyncio.CancelledError: If request is cancelled
            Exception: For other errors
        """
        pass

    @abstractmethod
    async def health_check(self) -> Dict[str, str]:
        """
        Check if the LLM service is healthy and responsive.

        Returns:
            Dictionary containing:
            - status: "healthy" or "unhealthy"
            - model: Model name
            - base_url: Service base URL
            - error: Optional error message (if unhealthy)

        Raises:
            Exception: For health check errors
        """
        pass

    @abstractmethod
    async def clear_memory(self, session_id: str = "default") -> bool:
        """
        Clear the conversation memory for a specific session.

        Args:
            session_id: Session identifier to clear

        Returns:
            True if memory was cleared successfully

        Raises:
            Exception: For clearing errors
        """
        pass

    @abstractmethod
    async def get_conversation_history(
        self,
        session_id: str = "default"
    ) -> List[Dict[str, str]]:
        """
        Get the current conversation history for a specific session.

        Args:
            session_id: Session identifier

        Returns:
            List of conversation messages with:
            - role: "user" or "assistant"
            - content: Message content

        Raises:
            Exception: For history retrieval errors
        """
        pass

    @abstractmethod
    async def remove_messages_after_index(
        self,
        session_id: str = "default",
        message_index: int = 0
    ) -> bool:
        """
        Remove all messages after a specific index in conversation history.

        Args:
            session_id: Session identifier
            message_index: Index after which to remove messages (0-based)

        Returns:
            True if messages were removed successfully

        Raises:
            Exception: For removal errors
        """
        pass

    @abstractmethod
    async def update_message_at_index(
        self,
        session_id: str = "default",
        message_index: int = 0,
        new_content: str = ""
    ) -> bool:
        """
        Update a specific message in the conversation history.

        Args:
            session_id: Session identifier
            message_index: Index of the message to update (0-based)
            new_content: New content for the message

        Returns:
            True if message was updated successfully

        Raises:
            Exception: For update errors
        """
        pass

    @abstractmethod
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

        Raises:
            Exception: For profile retrieval errors
        """
        pass

    # Common utility method (can be overridden but has default implementation)
    def _format_profile_for_context(self, profile_data: Dict[str, Any]) -> str:
        """
        Format user profile data into a readable context string for the LLM.

        This method can be overridden by subclasses but provides a sensible default.

        Args:
            profile_data: Dictionary containing user profile information

        Returns:
            Formatted string containing user profile context
        """
        context_parts = []
        covered_keys = set()

        # Career Information
        career_info = []
        for key, label in [
            ("current_job", "Current Job"),
            ("company", "Company"),
            ("industry", "Industry"),
            ("experience", "Experience Level")
        ]:
            if profile_data.get(key):
                career_info.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        if career_info:
            context_parts.append("Career: " + ", ".join(career_info))

        # Skills and Competencies
        for key, label in [
            ("skills", "Technical Skills"),
            ("soft_skills", "Soft Skills"),
            ("certifications", "Certifications"),
            ("skill_gaps", "Skill Gaps"),
            ("professional_strengths", "Professional Strengths"),
            ("growth_areas", "Growth Areas")
        ]:
            if profile_data.get(key):
                value = profile_data[key]
                value_str = ", ".join(value) if isinstance(value, list) else value
                context_parts.append(f"{label}: {value_str}")
                covered_keys.add(key)

        # Goals and Aspirations
        for key, label in [
            ("career_goals", "Career Goals"),
            ("short_term_goals", "Short-term Goals"),
            ("career_path_preference", "Career Path Preference"),
            ("career_challenges", "Career Challenges")
        ]:
            if profile_data.get(key):
                context_parts.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)

        # Personal Information
        personal_info = []
        for key, label in [
            ("personality_type", "Personality Type"),
            ("learning_style", "Learning Style"),
            ("education_level", "Education")
        ]:
            if profile_data.get(key):
                personal_info.append(f"{label}: {profile_data[key]}")
                covered_keys.add(key)
        if personal_info:
            context_parts.append("Personal: " + ", ".join(personal_info))

        # Interests and Hobbies
        for key, label in [
            ("hobbies", "Hobbies"),
            ("interests", "Interests"),
            ("creative_pursuits", "Creative Pursuits")
        ]:
            if profile_data.get(key):
                value = profile_data[key]
                value_str = ", ".join(value) if isinstance(value, list) else str(value)
                context_parts.append(f"{label}: {value_str}")
                covered_keys.add(key)

        # Append any remaining keys
        for key, value in profile_data.items():
            if key not in covered_keys and value:
                value_str = ", ".join(value) if isinstance(value, list) else str(value)
                context_parts.append(f"{key.replace('_', ' ').title()}: {value_str}")

        return "\n".join(context_parts) if context_parts else "No detailed profile information available."

    def _parse_follow_up_questions(self, questions_text: str) -> List[str]:
        """
        Parse generated follow-up questions text into a list.

        This method can be overridden by subclasses but provides a sensible default
        for parsing follow-up questions from LLM output.

        Args:
            questions_text: Raw text containing generated questions

        Returns:
            List of parsed follow-up questions (exactly 3)
        """
        try:
            import re
            questions = []
            lines = questions_text.strip().split('\n')

            for line in lines:
                line = line.strip()
                # Look for numbered questions (1., 2., 3. or 1), 2), 3))
                if line and (line.startswith(('1.', '2.', '3.', '1)', '2)', '3)')) or
                           any(line.startswith(f'{i}.') or line.startswith(f'{i})') for i in range(1, 4))):
                    # Remove number and clean up
                    question = line
                    for prefix in ['1.', '2.', '3.', '1)', '2)', '3)']:
                        if question.startswith(prefix):
                            question = question[len(prefix):].strip()
                            break

                    if question and len(question) > 5:
                        questions.append(question)

            # If parsing failed, try regex approach
            if len(questions) != 3:
                all_text = questions_text.replace('\n', ' ').strip()
                question_patterns = re.findall(r'[1-3][.)][^1-3]*(?=[1-3][.)]|$)', all_text)

                if question_patterns:
                    questions = []
                    for pattern in question_patterns[:3]:
                        question = re.sub(r'^[1-3][.)]\s*', '', pattern).strip()
                        if question and len(question) > 5:
                            questions.append(question)

            # If still not 3 questions, try finding questions with '?'
            if len(questions) != 3:
                questions = []
                for line in lines:
                    line = line.strip()
                    if line and ('?' in line or line.endswith('?')):
                        # Clean up common prefixes
                        for prefix in ['1.', '2.', '3.', '1)', '2)', '3)', '-', '*']:
                            if line.startswith(prefix):
                                line = line[len(prefix):].strip()
                                break
                        if line and len(line) > 5:
                            questions.append(line)
                            if len(questions) >= 3:
                                break

            # Ensure exactly 3 questions with defaults if needed
            while len(questions) < 3:
                default_questions = [
                    "Can you explain this in more detail?",
                    "What should I do next?",
                    "Are there other options to consider?"
                ]
                questions.append(default_questions[len(questions)])

            return questions[:3]

        except Exception as e:
            logger.error(f"Error parsing follow-up questions: {str(e)}")
            return [
                "Can you provide more details about this?",
                "What are the next steps I should take?",
                "Are there any alternatives I should consider?"
            ]
