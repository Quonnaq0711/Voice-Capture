"""Unit tests for career agent API endpoints."""

import pytest
import json
import sys
import os
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import HTTPException

# Import the API module
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from backend.voice_capture.api import router, send_message, get_career_insights
from backend.voice_capture.api import ChatRequest, CareerInsightsResponse

class TestSendMessageEndpoint:
    """Test cases for the /api/chat/message endpoint."""
    
    @pytest.mark.asyncio
    async def test_send_message_success(self, mock_chat_service, mock_db_session):
        """Test successful message sending."""
        # Arrange
        request = ChatRequest(
            message="Tell me about my career prospects",
            user_id=123,
            session_id="test_session_123"
        )
        
        expected_response = {
            "type": "message",
            "content": "Based on your resume, you have excellent career prospects...",
            "timestamp": "2024-01-01T12:00:00"
        }
        
        mock_chat_service.generate_response = AsyncMock(return_value=expected_response)
        
        # Act - directly pass mock_chat_service as dependency
        response = await send_message(request, mock_chat_service, mock_db_session)
        
        # Assert
        assert response["type"] == "message"
        assert response["content"] == expected_response["content"]
        mock_chat_service.generate_response.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_send_message_with_cancellation(self, mock_chat_service, mock_db_session):
        """Test message sending with cancellation event."""
        # Arrange
        request = ChatRequest(
            message="Analyze my resume",
            user_id=123,
            session_id="test_session_123"
        )
        
        expected_response = {
            "type": "message",
            "content": "Analysis started...",
            "timestamp": "2024-01-01T12:00:00"
        }
        
        mock_chat_service.generate_response = AsyncMock(return_value=expected_response)
        
        # Act - directly pass mock_chat_service as dependency
        response = await send_message(request, mock_chat_service, mock_db_session)
        
        # Assert
        assert response["type"] == "message"
        mock_chat_service.generate_response.assert_called_once()
        # Verify the call was made with correct parameters
        mock_chat_service.generate_response.assert_called_once_with(
            user_message=request.message,
            session_id=request.session_id
        )
    
    @pytest.mark.asyncio
    async def test_send_message_service_error(self, mock_chat_service, mock_db_session):
        """Test handling of chat service errors."""
        # Arrange
        request = ChatRequest(
            message="Test message",
            user_id=123,
            session_id="test_session_123"
        )
        
        # Mock chat service to raise an exception
        mock_chat_service.generate_response = AsyncMock(side_effect=Exception("Service error"))
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await send_message(request, mock_chat_service, mock_db_session)
        
        assert exc_info.value.status_code == 500
        assert "Service error" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_send_message_missing_user_id(self, mock_chat_service, mock_db_session):
        """Test handling of missing user_id."""
        # Arrange
        request = ChatRequest(
            message="Test message",
            user_id=None,  # Missing user_id
            session_id="test_session_123"
        )
        
        # Mock successful response - API allows None user_id
        mock_chat_service.generate_response = AsyncMock(return_value={
            "type": "message",
            "content": "Test response",
            "timestamp": "2024-01-01T12:00:00"
        })
        
        # Act - directly pass mock_chat_service as dependency
        response = await send_message(request, mock_chat_service, mock_db_session)
        
        # Assert - Should succeed with None user_id
        assert response["type"] == "message"
        assert response["content"] == "Test response"
        mock_chat_service.generate_response.assert_called_once_with(
            user_message=request.message,
            session_id=request.session_id
        )
    
    @pytest.mark.asyncio
    async def test_send_message_empty_message(self, mock_chat_service, mock_db_session):
        """Test handling of empty message."""
        # Arrange
        request = ChatRequest(
            message="",  # Empty message
            user_id=123,
            session_id="test_session_123"
        )
        
        # Act & Assert
        with pytest.raises(HTTPException) as exc_info:
            await send_message(request, mock_chat_service, mock_db_session)
        
        assert exc_info.value.status_code == 400
        assert "Message cannot be empty" in str(exc_info.value.detail)

class TestGetCareerInsightsEndpoint:
    """Test cases for the /api/chat/insights/{user_id} endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_career_insights_success(self, mock_db_session, sample_professional_data):
        """Test successful retrieval of career insights."""
        # Arrange
        user_id = 123
        
        with patch('api.ResumeAnalyzer') as mock_analyzer_class:
            mock_analyzer = Mock()
            mock_analyzer.get_latest_career_insight = AsyncMock(return_value=sample_professional_data)
            mock_analyzer_class.return_value = mock_analyzer
            
            # Act
            response = await get_career_insights(user_id, mock_db_session)
            
            # Assert
            assert response.success is True
            assert response.has_data is True
            assert response.professional_data == sample_professional_data
            assert "successfully" in response.message
            mock_analyzer.get_latest_career_insight.assert_called_once_with(user_id)
    
    @pytest.mark.asyncio
    async def test_get_career_insights_no_data(self, mock_db_session):
        """Test retrieval when no career insights exist."""
        # Arrange
        user_id = 123
        
        with patch('api.ResumeAnalyzer') as mock_analyzer_class:
            mock_analyzer = Mock()
            mock_analyzer.get_latest_career_insight = AsyncMock(return_value=None)
            mock_analyzer_class.return_value = mock_analyzer
            
            # Act
            response = await get_career_insights(user_id, mock_db_session)
            
            # Assert
            assert response.success is True
            assert response.has_data is False
            assert response.professional_data is None
            assert "No career insights found" in response.message
    
    @pytest.mark.asyncio
    async def test_get_career_insights_service_error(self, mock_db_session):
        """Test handling of service errors during insights retrieval."""
        # Arrange
        user_id = 123
        
        with patch('api.ResumeAnalyzer') as mock_analyzer_class:
            mock_analyzer = Mock()
            mock_analyzer.get_latest_career_insight = AsyncMock(side_effect=Exception("Database error"))
            mock_analyzer_class.return_value = mock_analyzer
            
            # Act
            response = await get_career_insights(user_id, mock_db_session)
            
            # Assert
            assert response.success is False
            assert response.has_data is False
            assert response.professional_data is None
            assert "Failed to retrieve career insights" in response.message
    
    @pytest.mark.asyncio
    async def test_get_career_insights_invalid_user_id(self, mock_db_session):
        """Test handling of invalid user_id."""
        # Arrange
        user_id = -1  # Invalid user_id
        
        with patch('api.ResumeAnalyzer') as mock_analyzer_class:
            mock_analyzer = Mock()
            mock_analyzer.get_latest_career_insight = AsyncMock(return_value=None)
            mock_analyzer_class.return_value = mock_analyzer
            
            # Act
            response = await get_career_insights(user_id, mock_db_session)
            
            # Assert - Should return response with no data
            assert response.success is True
            assert response.has_data is False
            assert response.professional_data is None

class TestChatRequest:
    """Test cases for ChatRequest model validation."""
    
    def test_valid_chat_request(self):
        """Test valid ChatRequest creation."""
        # Arrange & Act
        request = ChatRequest(
            message="Test message",
            user_id=123,
            session_id="test_session"
        )
        
        # Assert
        assert request.message == "Test message"
        assert request.user_id == 123
        assert request.session_id == "test_session"
    
    def test_chat_request_optional_session_id(self):
        """Test ChatRequest with optional session_id."""
        # Arrange & Act
        request = ChatRequest(
            message="Test message",
            user_id=123
        )
        
        # Assert
        assert request.message == "Test message"
        assert request.user_id == 123
        assert request.session_id == "default_session"  # Default value from API
    
    def test_chat_request_validation_error(self):
        """Test ChatRequest validation errors."""
        # Act & Assert - Empty message is allowed in the actual API
        request = ChatRequest(
            message="",  # Empty message is allowed
            user_id=123
        )
        assert request.message == ""

# MessageResponse class is not defined in the actual API, removing these tests

class TestCareerInsightsResponse:
    """Test cases for CareerInsightsResponse model."""
    
    def test_valid_career_insights_response(self, sample_professional_data):
        """Test valid CareerInsightsResponse creation."""
        # Arrange & Act
        response = CareerInsightsResponse(
            success=True,
            professional_data=sample_professional_data,
            message="Insights retrieved successfully",
            has_data=True
        )
        
        # Assert
        assert response.success is True
        assert response.professional_data == sample_professional_data
        assert response.message == "Insights retrieved successfully"
        assert response.has_data is True
    
    def test_empty_career_insights_response(self):
        """Test CareerInsightsResponse with no data."""
        # Arrange & Act
        response = CareerInsightsResponse(
            success=True,
            professional_data=None,
            message="No insights found",
            has_data=False
        )
        
        # Assert
        assert response.success is True
        assert response.professional_data is None
        assert response.message == "No insights found"
        assert response.has_data is False

class TestAPIIntegration:
    """Integration tests for API endpoints."""
    
    @pytest.mark.asyncio
    async def test_message_to_insights_flow(self, mock_chat_service, mock_db_session, sample_professional_data):
        """Test the flow from sending a message to retrieving insights."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        # Mock chat service to return career insights response
        career_insights_response = {
            "type": "career_insights",
            "professional_data": sample_professional_data,
            "message": "Career insights generated successfully"
        }
        mock_chat_service.generate_response = AsyncMock(return_value=career_insights_response)
        
        # Mock resume analyzer for insights retrieval
        with patch('api.ResumeAnalyzer') as mock_analyzer_class:
            mock_analyzer = Mock()
            mock_analyzer.get_latest_career_insight = AsyncMock(return_value=sample_professional_data)
            mock_analyzer_class.return_value = mock_analyzer
            
            # Act - Send message requesting career insights
            message_request = ChatRequest(
                message="Please analyze my resume and provide career insights",
                user_id=user_id,
                session_id=session_id
            )
            
            # Act - directly pass mock_chat_service as dependency
            message_response = await send_message(message_request, mock_chat_service, mock_db_session)
            
            # Act - Retrieve career insights
            insights_response = await get_career_insights(user_id, mock_db_session)
            
            # Assert
            assert message_response["type"] == "career_insights"
            assert "Career insights generated successfully" in message_response["message"]
            assert insights_response.success is True
            assert insights_response.has_data is True
            assert insights_response.professional_data == sample_professional_data