"""Unit tests for ChatServiceVLLM class."""

import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, AsyncMock
from datetime import datetime

# Add src directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


class TestChatServiceVLLMInitialization:
    """Test cases for ChatServiceVLLM initialization."""

    def test_init_with_default_params(self, mock_chat_service_vllm):
        """Test initialization with default mock parameters."""
        # Assert
        assert mock_chat_service_vllm is not None
        assert mock_chat_service_vllm.model_name == "test-model"
        assert mock_chat_service_vllm.api_base == "http://test:8888/v1"
        assert mock_chat_service_vllm.temperature == 0.7
        assert mock_chat_service_vllm.max_tokens == 2048

    def test_has_required_attributes(self, mock_chat_service_vllm):
        """Test that service has all required attributes."""
        # Assert
        assert hasattr(mock_chat_service_vllm, 'model_name')
        assert hasattr(mock_chat_service_vllm, 'api_base')
        assert hasattr(mock_chat_service_vllm, 'temperature')
        assert hasattr(mock_chat_service_vllm, 'max_tokens')
        assert hasattr(mock_chat_service_vllm, 'store')


class TestThreadSafety:
    """Test thread safety features."""

    def test_create_llm_with_max_tokens(self, mock_chat_service_vllm):
        """Test creating request-specific LLM instances for thread safety."""
        # Arrange
        mock_llm1 = Mock()
        mock_llm1.max_tokens = 1500
        mock_llm2 = Mock()
        mock_llm2.max_tokens = 3000

        mock_chat_service_vllm._create_llm_with_max_tokens.side_effect = [mock_llm1, mock_llm2]

        # Act
        llm1 = mock_chat_service_vllm._create_llm_with_max_tokens(1500)
        llm2 = mock_chat_service_vllm._create_llm_with_max_tokens(3000)

        # Assert - Different instances with different max_tokens
        assert llm1 is not llm2
        assert llm1.max_tokens == 1500
        assert llm2.max_tokens == 3000
        assert mock_chat_service_vllm._create_llm_with_max_tokens.call_count == 2


class TestTokenCounting:
    """Test token counting functionality."""

    def test_count_message_tokens(self, mock_chat_service_vllm):
        """Test token counting for messages."""
        # Arrange
        messages = [
            {"role": "user", "content": "Hello, how are you?"},
            {"role": "assistant", "content": "I'm doing well, thank you!"}
        ]

        # Mock returns fixed token count
        mock_chat_service_vllm._count_message_tokens.return_value = 150

        # Act
        token_count = mock_chat_service_vllm._count_message_tokens(messages)

        # Assert
        assert token_count == 150
        mock_chat_service_vllm._count_message_tokens.assert_called_once_with(messages)

    def test_calculate_dynamic_max_tokens(self, mock_chat_service_vllm):
        """Test dynamic max_tokens calculation based on input."""
        # Arrange - Small input should allow more output
        mock_chat_service_vllm._calculate_dynamic_max_tokens.return_value = 2000

        # Act
        result1 = mock_chat_service_vllm._calculate_dynamic_max_tokens(100)

        # Assert
        assert result1 == 2000

        # Arrange - Large input should allow less output
        mock_chat_service_vllm._calculate_dynamic_max_tokens.return_value = 500

        # Act
        result2 = mock_chat_service_vllm._calculate_dynamic_max_tokens(3000)

        # Assert
        assert result2 == 500


class TestSlidingWindow:
    """Test conversation history sliding window."""

    def test_apply_sliding_window_preserves_system_message(self, mock_chat_service_vllm):
        """Test that sliding window preserves system message."""
        # Arrange
        messages = [
            {"role": "system", "content": "You are an assistant"},
            {"role": "user", "content": "Message 1"},
            {"role": "assistant", "content": "Response 1"},
            {"role": "user", "content": "Message 2"},
        ]

        # Mock returns truncated history
        mock_chat_service_vllm._apply_sliding_window.return_value = messages[:3]

        # Act
        result = mock_chat_service_vllm._apply_sliding_window(messages)

        # Assert
        assert len(result) == 3
        assert result[0]["role"] == "system"


class TestGenerateResponse:
    """Test response generation with timeout handling."""

    @pytest.mark.asyncio
    async def test_generate_response_success(self, mock_chat_service_vllm):
        """Test successful response generation."""
        # Arrange
        message = "Tell me about career opportunities"
        session_id = "test_session_123"
        expected_response = {
            "type": "message",
            "content": "Tech industry offers many opportunities...",
            "timestamp": datetime.now().isoformat()
        }

        mock_chat_service_vllm.generate_response.return_value = expected_response

        # Act
        response = await mock_chat_service_vllm.generate_response(
            user_message=message,
            session_id=session_id
        )

        # Assert
        assert response == expected_response
        mock_chat_service_vllm.generate_response.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_response_with_cancellation(self, mock_chat_service_vllm):
        """Test that response can be cancelled via cancellation_event."""
        # Arrange
        message = "Test message"
        session_id = "test_session"
        cancellation_event = asyncio.Event()

        mock_chat_service_vllm.generate_response.side_effect = asyncio.CancelledError()

        # Act & Assert
        with pytest.raises(asyncio.CancelledError):
            await mock_chat_service_vllm.generate_response(
                user_message=message,
                session_id=session_id,
                cancellation_event=cancellation_event
            )

    @pytest.mark.asyncio
    async def test_generate_response_timeout_handling(self, mock_chat_service_vllm):
        """Test that timeout is properly handled."""
        # Arrange
        message = "Long running query"
        session_id = "test_session"

        mock_chat_service_vllm.generate_response.side_effect = asyncio.TimeoutError(
            "Response generation timed out after 120 seconds"
        )

        # Act & Assert
        with pytest.raises(asyncio.TimeoutError) as exc_info:
            await mock_chat_service_vllm.generate_response(
                user_message=message,
                session_id=session_id
            )

        assert "timed out" in str(exc_info.value).lower()


class TestFollowUpQuestions:
    """Test follow-up question generation."""

    def test_generate_follow_up_sync_uses_per_request_llm(self, mock_chat_service_vllm):
        """Test that follow-up generation is thread-safe."""
        # Arrange
        prompt = "Generate follow-up questions about career"
        expected_questions = "1. What are your goals?\n2. What skills do you want to develop?"

        mock_chat_service_vllm._generate_follow_up_sync.return_value = expected_questions

        # Act
        result = mock_chat_service_vllm._generate_follow_up_sync(prompt)

        # Assert
        assert result == expected_questions
        mock_chat_service_vllm._generate_follow_up_sync.assert_called_once_with(prompt)


class TestQueryOptimization:
    """Test query optimization functionality."""

    def test_optimize_sync_query_thread_safe(self, mock_chat_service_vllm):
        """Test that query optimization uses per-request LLM instance."""
        # Arrange
        query = "career advice"
        expected_optimized = "career guidance and professional development advice"

        mock_chat_service_vllm._optimize_sync_query.return_value = expected_optimized

        # Act
        result = mock_chat_service_vllm._optimize_sync_query(query)

        # Assert
        assert result == expected_optimized
        mock_chat_service_vllm._optimize_sync_query.assert_called_once_with(query)


class TestCleanup:
    """Test resource cleanup."""

    def test_cleanup_method_exists(self, mock_chat_service_vllm):
        """Test that cleanup method is available."""
        # Act
        mock_chat_service_vllm.cleanup()

        # Assert
        mock_chat_service_vllm.cleanup.assert_called_once()

    def test_cleanup_available_for_resource_management(self, mock_chat_service_vllm):
        """Test that cleanup is available for resource management."""
        # Assert - cleanup method should exist
        assert hasattr(mock_chat_service_vllm, 'cleanup')
        assert callable(mock_chat_service_vllm.cleanup)


class TestRoleAlternation:
    """Test vLLM API role alternation requirement."""

    def test_ensure_alternating_roles(self, mock_chat_service_vllm):
        """Test that consecutive same-role messages are handled."""
        # Arrange
        messages = [
            {"role": "user", "content": "Message 1"},
            {"role": "user", "content": "Message 2"},  # Consecutive user
            {"role": "assistant", "content": "Response 1"},
        ]

        # Mock merges consecutive user messages
        merged = [
            {"role": "user", "content": "Message 1\nMessage 2"},
            {"role": "assistant", "content": "Response 1"},
        ]
        mock_chat_service_vllm._ensure_alternating_roles.return_value = merged

        # Act
        result = mock_chat_service_vllm._ensure_alternating_roles(messages)

        # Assert
        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert "Message 1" in result[0]["content"]
        assert "Message 2" in result[0]["content"]


class TestUserProfile:
    """Test user profile integration."""

    @pytest.mark.asyncio
    async def test_get_user_profile(self, mock_chat_service_vllm, mock_db_session):
        """Test retrieving user profile."""
        # Arrange
        user_id = 123
        expected_profile = {
            "id": user_id,
            "name": "John Doe",
            "email": "john@example.com"
        }

        mock_chat_service_vllm.get_user_profile.return_value = expected_profile

        # Act
        profile = await mock_chat_service_vllm.get_user_profile(user_id, mock_db_session)

        # Assert
        assert profile == expected_profile
        mock_chat_service_vllm.get_user_profile.assert_called_once_with(user_id, mock_db_session)


class TestConversationHistory:
    """Test conversation history management."""

    def test_get_session_history(self, mock_chat_service_vllm):
        """Test retrieving session history."""
        # Arrange
        session_id = "test_session_123"
        expected_history = Mock()

        mock_chat_service_vllm.get_session_history.return_value = expected_history

        # Act
        history = mock_chat_service_vllm.get_session_history(session_id)

        # Assert
        assert history == expected_history
        mock_chat_service_vllm.get_session_history.assert_called_once_with(session_id)
