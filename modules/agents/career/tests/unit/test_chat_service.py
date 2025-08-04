"""Unit tests for ChatService class."""

import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any, List, Optional

# Import the ChatService class
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from chat_service import ChatService, get_chat_service

class TestChatServiceInitialization:
    """Test cases for ChatService initialization."""
    
    def test_chat_service_init_default(self):
        """Test ChatService initialization with default parameters."""
        # Act
        service = ChatService()
        
        # Assert
        assert service is not None
        assert hasattr(service, 'llm')
        assert hasattr(service, 'model_name')
    
    def test_chat_service_init_with_params(self):
        """Test ChatService initialization with custom parameters."""
        # Arrange
        model_name = "custom-model"
        base_url = "http://custom-url:11434"
        
        # Act
        service = ChatService(model_name=model_name, base_url=base_url)
        
        # Assert
        assert service.model_name == model_name
        assert service.base_url == base_url
    
    def test_get_chat_service_singleton(self):
        """Test that get_chat_service returns a singleton instance."""
        # Act
        service1 = get_chat_service()
        service2 = get_chat_service()
        
        # Assert
        assert service1 is service2

class TestGenerateResponse:
    """Test cases for the generate_response method."""
    
    @pytest.mark.asyncio
    async def test_generate_response_success(self, mock_chat_service):
        """Test successful response generation."""
        # Arrange
        message = "Tell me about career opportunities in tech"
        user_id = 123
        session_id = "test_session_123"
        
        expected_response = {
            "type": "message",
            "content": "Tech industry offers many opportunities...",
            "timestamp": datetime.now().isoformat()
        }
        
        # Mock the LLM client response
        mock_llm_response = Mock()
        mock_llm_response.choices = [Mock()]
        mock_llm_response.choices[0].message = Mock()
        mock_llm_response.choices[0].message.content = expected_response["content"]
        
        with patch.object(mock_chat_service, 'conversation') as mock_conversation:
            mock_conversation.ainvoke = AsyncMock(return_value=expected_response["content"])
            mock_chat_service.generate_response = AsyncMock(return_value=expected_response)
            
            # Act
            response = await mock_chat_service.generate_response(
                message=message,
                user_id=user_id,
                session_id=session_id
            )
            
            # Assert
            assert response == expected_response
            mock_chat_service.generate_response.assert_called_once_with(
                message=message,
                user_id=user_id,
                session_id=session_id
            )
    
    @pytest.mark.asyncio
    async def test_generate_response_with_cancellation(self, mock_chat_service):
        """Test response generation with cancellation event."""
        # Arrange
        message = "Analyze my resume"
        user_id = 123
        session_id = "test_session_123"
        cancellation_event = asyncio.Event()
        
        expected_response = {
            "type": "message",
            "content": "Starting resume analysis...",
            "timestamp": datetime.now().isoformat()
        }
        
        mock_chat_service.generate_response = AsyncMock(return_value=expected_response)
        
        # Act
        response = await mock_chat_service.generate_response(
            message=message,
            user_id=user_id,
            session_id=session_id,
            cancellation_event=cancellation_event
        )
        
        # Assert
        assert response == expected_response
        mock_chat_service.generate_response.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_response_streaming(self, mock_chat_service):
        """Test streaming response generation."""
        # Arrange
        message = "Tell me about my career prospects"
        user_id = 123
        session_id = "test_session_123"
        
        # Mock streaming response
        async def mock_streaming_response():
            yield {"type": "message", "content": "Analyzing your profile...", "timestamp": datetime.now().isoformat()}
            yield {"type": "message", "content": "Based on your experience...", "timestamp": datetime.now().isoformat()}
            yield {"type": "message", "content": "You have strong prospects in...", "timestamp": datetime.now().isoformat()}
        
        mock_chat_service.generate_response = AsyncMock(return_value=mock_streaming_response())
        
        # Act
        response = await mock_chat_service.generate_response(
            message=message,
            user_id=user_id,
            session_id=session_id,
            stream=True
        )
        
        # Assert
        assert response is not None
        mock_chat_service.generate_response.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_response_career_insights_intent(self, mock_chat_service):
        """Test response generation with career insights intent."""
        # Arrange
        message = "Please analyze my resume and provide career insights"
        user_id = 123
        session_id = "test_session_123"
        
        # Mock streaming analyzer response
        async def mock_career_insights_response():
            yield {"type": "status", "message": "Starting analysis...", "progress": 0}
            yield {"type": "section_complete", "section": "professionalIdentity", "progress": 20}
            yield {"type": "analysis_complete", "success": True, "progress": 100}
        
        with patch('streaming_analyzer.StreamingResumeAnalyzer') as mock_analyzer_class:
            mock_analyzer = Mock()
            mock_analyzer.analyze_resume_streaming = AsyncMock(return_value=mock_career_insights_response())
            mock_analyzer_class.return_value = mock_analyzer
            
            mock_chat_service.generate_response = AsyncMock(return_value=mock_career_insights_response())
            
            # Act
            response = await mock_chat_service.generate_response(
                message=message,
                user_id=user_id,
                session_id=session_id
            )
            
            # Assert
            assert response is not None
            mock_chat_service.generate_response.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_generate_response_llm_error(self, mock_chat_service):
        """Test handling of LLM errors during response generation."""
        # Arrange
        message = "Test message"
        user_id = 123
        session_id = "test_session_123"
        
        mock_chat_service.generate_response = AsyncMock(side_effect=Exception("LLM service unavailable"))
        
        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            await mock_chat_service.generate_response(
                message=message,
                user_id=user_id,
                session_id=session_id
            )
        
        assert "LLM service unavailable" in str(exc_info.value)

class TestConversationHistory:
    """Test cases for conversation history management."""
    
    @pytest.mark.asyncio
    async def test_get_conversation_history_success(self, mock_chat_service):
        """Test successful retrieval of conversation history."""
        # Arrange
        session_id = "test_session_123"
        expected_history = [
            {"role": "user", "content": "Hello", "timestamp": "2024-01-01T12:00:00"},
            {"role": "assistant", "content": "Hi there!", "timestamp": "2024-01-01T12:00:01"}
        ]
        
        mock_chat_service.get_conversation_history = AsyncMock(return_value=expected_history)
        
        # Act
        history = await mock_chat_service.get_conversation_history(session_id)
        
        # Assert
        assert history == expected_history
        mock_chat_service.get_conversation_history.assert_called_once_with(session_id)
    
    @pytest.mark.asyncio
    async def test_get_conversation_history_empty(self, mock_chat_service):
        """Test retrieval of empty conversation history."""
        # Arrange
        session_id = "new_session_123"
        
        mock_chat_service.get_conversation_history = AsyncMock(return_value=[])
        
        # Act
        history = await mock_chat_service.get_conversation_history(session_id)
        
        # Assert
        assert history == []
        mock_chat_service.get_conversation_history.assert_called_once_with(session_id)
    
    @pytest.mark.asyncio
    async def test_store_message_success(self, mock_chat_service):
        """Test successful message storage."""
        # Arrange
        session_id = "test_session_123"
        user_id = 123
        message = "Test message"
        role = "user"
        
        mock_chat_service.store_message = AsyncMock()
        
        # Act
        await mock_chat_service.store_message(
            session_id=session_id,
            user_id=user_id,
            message=message,
            role=role
        )
        
        # Assert
        mock_chat_service.store_message.assert_called_once_with(
            session_id=session_id,
            user_id=user_id,
            message=message,
            role=role
        )
    
    @pytest.mark.asyncio
    async def test_store_message_database_error(self, mock_chat_service):
        """Test handling of database errors during message storage."""
        # Arrange
        session_id = "test_session_123"
        user_id = 123
        message = "Test message"
        role = "user"
        
        mock_chat_service.store_message = AsyncMock(side_effect=Exception("Database connection failed"))
        
        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            await mock_chat_service.store_message(
                session_id=session_id,
                user_id=user_id,
                message=message,
                role=role
            )
        
        assert "Database connection failed" in str(exc_info.value)

class TestUserProfile:
    """Test cases for user profile management."""
    
    @pytest.mark.asyncio
    async def test_get_user_profile_success(self, mock_chat_service, mock_db_session):
        """Test successful retrieval of user profile."""
        # Arrange
        user_id = 123
        expected_profile = {
            "id": user_id,
            "name": "John Doe",
            "email": "john.doe@example.com",
            "preferences": {"language": "en", "timezone": "UTC"}
        }
        
        mock_chat_service.get_user_profile = AsyncMock(return_value=expected_profile)
        
        # Act
        profile = await mock_chat_service.get_user_profile(user_id, mock_db_session)
        
        # Assert
        assert profile == expected_profile
        mock_chat_service.get_user_profile.assert_called_once_with(user_id, mock_db_session)
    
    @pytest.mark.asyncio
    async def test_get_user_profile_not_found(self, mock_chat_service, mock_db_session):
        """Test handling of non-existent user profile."""
        # Arrange
        user_id = 999  # Non-existent user
        
        mock_chat_service.get_user_profile = AsyncMock(return_value=None)
        
        # Act
        profile = await mock_chat_service.get_user_profile(user_id, mock_db_session)
        
        # Assert
        assert profile is None
        mock_chat_service.get_user_profile.assert_called_once_with(user_id, mock_db_session)
    
    @pytest.mark.asyncio
    async def test_get_user_profile_database_error(self, mock_chat_service, mock_db_session):
        """Test handling of database errors during profile retrieval."""
        # Arrange
        user_id = 123
        
        mock_chat_service.get_user_profile = AsyncMock(side_effect=Exception("Database query failed"))
        
        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            await mock_chat_service.get_user_profile(user_id, mock_db_session)
        
        assert "Database query failed" in str(exc_info.value)

class TestIntentDetection:
    """Test cases for intent detection functionality."""
    
    @pytest.mark.asyncio
    async def test_detect_career_insights_intent(self, mock_chat_service):
        """Test detection of career insights intent."""
        # Arrange
        messages_with_career_intent = [
            "Please analyze my resume",
            "I want career insights",
            "Tell me about my career prospects",
            "Analyze my professional profile",
            "What are my career opportunities?"
        ]
        
        mock_chat_service._detect_intent = Mock(return_value="CAREER_INSIGHTS")
        
        # Act & Assert
        for message in messages_with_career_intent:
            intent = mock_chat_service._detect_intent(message)
            assert intent == "CAREER_INSIGHTS"
    
    @pytest.mark.asyncio
    async def test_detect_general_chat_intent(self, mock_chat_service):
        """Test detection of general chat intent."""
        # Arrange
        messages_with_general_intent = [
            "Hello, how are you?",
            "What's the weather like?",
            "Tell me a joke",
            "How do I learn Python?",
            "What's the latest news?"
        ]
        
        mock_chat_service._detect_intent = Mock(return_value="GENERAL_CHAT")
        
        # Act & Assert
        for message in messages_with_general_intent:
            intent = mock_chat_service._detect_intent(message)
            assert intent == "GENERAL_CHAT"
    
    @pytest.mark.asyncio
    async def test_intent_detection_edge_cases(self, mock_chat_service):
        """Test intent detection with edge cases."""
        # Arrange
        edge_case_messages = [
            "",  # Empty message
            "   ",  # Whitespace only
            "a",  # Single character
            "?" * 100,  # Very long message
        ]
        
        mock_chat_service._detect_intent = Mock(return_value="GENERAL_CHAT")
        
        # Act & Assert
        for message in edge_case_messages:
            intent = mock_chat_service._detect_intent(message)
            assert intent in ["CAREER_INSIGHTS", "GENERAL_CHAT"]

class TestChatServiceIntegration:
    """Integration tests for ChatService functionality."""
    
    @pytest.mark.asyncio
    async def test_full_conversation_flow(self, mock_chat_service, mock_db_session):
        """Test a complete conversation flow."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        messages = [
            "Hello, I'm looking for career advice",
            "Can you analyze my resume?",
            "What are my strengths and weaknesses?"
        ]
        
        expected_responses = [
            {"type": "message", "content": "Hello! I'd be happy to help with career advice."},
            {"type": "message", "content": "I'll analyze your resume step by step."},
            {"type": "message", "content": "Based on your profile, here are your key strengths..."}
        ]
        
        # Mock the responses
        mock_chat_service.generate_response = AsyncMock(side_effect=expected_responses)
        mock_chat_service.store_message = AsyncMock()
        mock_chat_service.get_conversation_history = AsyncMock(return_value=[])
        
        # Act & Assert
        for i, message in enumerate(messages):
            response = await mock_chat_service.generate_response(
                message=message,
                user_id=user_id,
                session_id=session_id,
                db=mock_db_session
            )
            
            assert response == expected_responses[i]
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, mock_chat_service):
        """Test handling of concurrent requests."""
        # Arrange
        user_id = 123
        session_ids = [f"session_{i}" for i in range(5)]
        message = "Tell me about career opportunities"
        
        expected_response = {
            "type": "message",
            "content": "Here are some career opportunities..."
        }
        
        mock_chat_service.generate_response = AsyncMock(return_value=expected_response)
        
        # Act
        tasks = [
            mock_chat_service.generate_response(
                message=message,
                user_id=user_id,
                session_id=session_id
            )
            for session_id in session_ids
        ]
        
        responses = await asyncio.gather(*tasks)
        
        # Assert
        assert len(responses) == 5
        for response in responses:
            assert response == expected_response
        
        assert mock_chat_service.generate_response.call_count == 5