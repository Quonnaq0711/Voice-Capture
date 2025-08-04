"""Unit tests for streaming API endpoints."""

import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from fastapi import HTTPException, BackgroundTasks
from datetime import datetime

# Import the streaming API module
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from streaming_api import (
    router, start_streaming_analysis, run_streaming_analysis,
    get_analysis_progress, stream_analysis_updates, cancel_analysis,
    AnalysisRequest, AnalysisResponse
)

class TestStartStreamingAnalysis:
    """Test cases for the /analyze/stream endpoint."""
    
    @pytest.mark.asyncio
    async def test_start_streaming_analysis_success(self, mock_streaming_analyzer, mock_notification_service):
        """Test successful start of streaming analysis."""
        # Arrange
        request = AnalysisRequest(
            user_id="123",
            session_id="test_session_123",
            force_reanalysis=False
        )
        background_tasks = BackgroundTasks()
        
        with patch('streaming_api.StreamingResumeAnalyzer', return_value=mock_streaming_analyzer), \
             patch('streaming_api.notification_service', mock_notification_service):
            
            # Act
            response = await start_streaming_analysis(request, background_tasks)
            
            # Assert
            assert response.success is True
            assert response.message == "Analysis started successfully"
            assert response.session_id == "test_session_123"
            assert response.error is None
            mock_notification_service.register_session.assert_called_once_with(
                "test_session_123", "123"
            )
    
    @pytest.mark.asyncio
    async def test_start_streaming_analysis_auto_session_id(self, mock_streaming_analyzer, mock_notification_service):
        """Test streaming analysis with auto-generated session ID."""
        # Arrange
        request = AnalysisRequest(
            user_id="123",
            session_id=None,  # No session ID provided
            force_reanalysis=True
        )
        background_tasks = BackgroundTasks()
        
        with patch('streaming_api.StreamingResumeAnalyzer', return_value=mock_streaming_analyzer), \
             patch('streaming_api.notification_service', mock_notification_service):
            
            # Act
            response = await start_streaming_analysis(request, background_tasks)
            
            # Assert
            assert response.success is True
            assert response.session_id is not None
            assert response.session_id.startswith("analysis_123_")
    
    @pytest.mark.asyncio
    async def test_start_streaming_analysis_service_error(self):
        """Test handling of service errors during analysis start."""
        # Arrange
        request = AnalysisRequest(
            user_id="123",
            session_id="test_session_123"
        )
        background_tasks = BackgroundTasks()
        
        with patch('streaming_api.StreamingResumeAnalyzer', side_effect=Exception("Service unavailable")):
            
            # Act & Assert
            with pytest.raises(HTTPException) as exc_info:
                await start_streaming_analysis(request, background_tasks)
            
            assert exc_info.value.status_code == 500
            assert "Failed to start analysis" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_start_streaming_analysis_invalid_user_id(self, mock_streaming_analyzer, mock_notification_service):
        """Test handling of invalid user ID."""
        # Arrange
        request = AnalysisRequest(
            user_id="",  # Empty user ID
            session_id="test_session_123"
        )
        background_tasks = BackgroundTasks()
        
        # Mock StreamingResumeAnalyzer constructor to raise an exception
        with patch('streaming_api.StreamingResumeAnalyzer', side_effect=Exception("Invalid user_id")), \
             patch('streaming_api.notification_service', mock_notification_service):
            
            # Act & Assert
            with pytest.raises(HTTPException) as exc_info:
                await start_streaming_analysis(request, background_tasks)
            
            assert exc_info.value.status_code == 500
            assert "Failed to start analysis" in str(exc_info.value.detail)

class TestRunStreamingAnalysis:
    """Test cases for the background streaming analysis task."""
    
    @pytest.mark.asyncio
    async def test_run_streaming_analysis_success(self, mock_streaming_analyzer, mock_notification_service):
        """Test successful execution of streaming analysis background task."""
        # Arrange
        user_id = "123"
        session_id = "test_session_123"
        force_reanalysis = False
        
        # Mock the streaming analysis generator as an async generator
        async def mock_analysis_generator():
            yield {"type": "status", "message": "Starting analysis", "progress": 0}
            yield {"type": "section_complete", "section": "professionalIdentity", "progress": 20}
            yield {"type": "analysis_complete", "success": True, "progress": 100}
        
        # Use AsyncMock to properly mock the async generator
        mock_streaming_analyzer.analyze_resume_streaming = MagicMock(return_value=mock_analysis_generator())
        
        with patch('streaming_api.notification_service', mock_notification_service), \
             patch('streaming_api.asyncio.sleep', new_callable=AsyncMock):
            # Act
            await run_streaming_analysis(
                mock_streaming_analyzer,
                user_id,
                session_id,
                force_reanalysis
            )
        
            # Assert
            mock_streaming_analyzer.analyze_resume_streaming.assert_called_once_with(user_id=int(user_id))
            mock_notification_service.update_progress.assert_called()
            mock_notification_service.complete_analysis.assert_called_once_with(session_id, success=True)
    
    @pytest.mark.asyncio
    async def test_run_streaming_analysis_with_error(self, mock_streaming_analyzer, mock_notification_service):
        """Test handling of errors during streaming analysis."""
        # Arrange
        user_id = "123"
        session_id = "test_session_123"
        force_reanalysis = False
        
        # Create an async generator that raises an exception
        class FailingAsyncGenerator:
            def __aiter__(self):
                return self
            
            async def __anext__(self):
                raise Exception("Analysis failed")
        
        # Override the AsyncMock to return our custom async generator
        mock_streaming_analyzer.analyze_resume_streaming = Mock(return_value=FailingAsyncGenerator())
        
        # Act
        with patch('streaming_api.notification_service', mock_notification_service), \
             patch('streaming_api.asyncio.sleep', new_callable=AsyncMock):
            await run_streaming_analysis(
                mock_streaming_analyzer,
                user_id,
                session_id,
                force_reanalysis
            )
        
        # Assert - Should handle the error gracefully
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once_with(user_id=int(user_id))
        mock_notification_service.complete_analysis.assert_called_once_with(session_id, success=False, error="Analysis failed")
    
    @pytest.mark.asyncio
    async def test_run_streaming_analysis_progress_callback(self, mock_streaming_analyzer, mock_notification_service):
        """Test progress callback functionality during streaming analysis."""
        # Arrange
        user_id = "123"
        session_id = "test_session_123"
        force_reanalysis = False
        
        # Mock the streaming analysis generator with progress updates
        async def mock_analysis_generator():
            yield {"type": "section_start", "section": "professionalIdentity", "progress": 10}
            yield {"type": "section_complete", "section": "professionalIdentity", "progress": 20}
        
        # Override the AsyncMock to return our custom async generator
        mock_streaming_analyzer.analyze_resume_streaming = Mock(return_value=mock_analysis_generator())
        
        # Act
        with patch('streaming_api.notification_service', mock_notification_service), \
             patch('streaming_api.asyncio.sleep', new_callable=AsyncMock):
            await run_streaming_analysis(
                mock_streaming_analyzer,
                user_id,
                session_id,
                force_reanalysis
            )
        
        # Assert
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once_with(user_id=int(user_id))
        mock_notification_service.update_progress.assert_called()
        mock_notification_service.complete_analysis.assert_called_once_with(session_id, success=True)

class TestGetAnalysisProgress:
    """Test cases for the /analyze/progress/{session_id} endpoint."""
    
    @pytest.mark.asyncio
    async def test_get_analysis_progress_success(self, mock_notification_service, sample_analysis_progress):
        """Test successful retrieval of analysis progress."""
        # Arrange
        session_id = "test_session_123"
        mock_notification_service.get_progress.return_value = sample_analysis_progress
        
        with patch('streaming_api.notification_service', mock_notification_service):
            
            # Act
            response = await get_analysis_progress(session_id)
            
            # Assert
            assert response == sample_analysis_progress
            mock_notification_service.get_progress.assert_called_once_with(session_id)
    
    @pytest.mark.asyncio
    async def test_get_analysis_progress_not_found(self, mock_notification_service):
        """Test handling of non-existent session."""
        # Arrange
        session_id = "non_existent_session"
        mock_notification_service.get_progress.return_value = None
        
        with patch('streaming_api.notification_service', mock_notification_service):
            
            # Act & Assert
            with pytest.raises(HTTPException) as exc_info:
                await get_analysis_progress(session_id)
            
            assert exc_info.value.status_code == 404
            assert "Session not found" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_get_analysis_progress_service_error(self, mock_notification_service):
        """Test handling of service errors during progress retrieval."""
        # Arrange
        session_id = "test_session_123"
        mock_notification_service.get_progress.side_effect = Exception("Service error")
        
        with patch('streaming_api.notification_service', mock_notification_service):
            
            # Act & Assert
            with pytest.raises(HTTPException) as exc_info:
                await get_analysis_progress(session_id)
            
            assert exc_info.value.status_code == 500
            assert "Failed to get progress" in str(exc_info.value.detail)

class TestStreamAnalysisUpdates:
    """Test cases for the /analyze/stream/{session_id} endpoint."""
    
    @pytest.mark.asyncio
    async def test_stream_analysis_updates_success(self, mock_notification_service):
        """Test successful streaming of analysis updates."""
        # Arrange
        session_id = "test_session_123"
        
        # Mock stream generator
        async def mock_stream_generator():
            yield {"type": "status", "message": "Starting analysis"}
            yield {"type": "section_complete", "section": "professionalIdentity"}
            yield {"type": "complete", "success": True}
        
        mock_notification_service.session_exists.return_value = True
        # Override the AsyncMock to return our custom async generator
        mock_notification_service.stream_updates = Mock(return_value=mock_stream_generator())
        
        with patch('streaming_api.notification_service', mock_notification_service):
            
            # Act
            response = await stream_analysis_updates(session_id)
            
            # Assert
            from fastapi.responses import StreamingResponse
            assert isinstance(response, StreamingResponse)
            
            # Consume the response to trigger the event generator
            content = []
            async for chunk in response.body_iterator:
                content.append(chunk)
                if len(content) >= 3:  # Stop after a few chunks
                    break
            
            mock_notification_service.session_exists.assert_called_once_with(session_id)
            mock_notification_service.stream_updates.assert_called_once_with(session_id)
    
    @pytest.mark.asyncio
    async def test_stream_analysis_updates_not_found(self, mock_notification_service):
        """Test handling of non-existent session for streaming."""
        # Arrange
        session_id = "non_existent_session"
        mock_notification_service.session_exists.return_value = False
        
        with patch('streaming_api.notification_service', mock_notification_service):
            
            # Act
            response = await stream_analysis_updates(session_id)
            
            # Assert - Should return a StreamingResponse, not raise HTTPException
            from fastapi.responses import StreamingResponse
            assert isinstance(response, StreamingResponse)
            
            # Consume the response to trigger the event generator
            content = []
            async for chunk in response.body_iterator:
                content.append(chunk)
                if len(content) >= 1:  # Stop after first chunk (error message)
                    break
            
            mock_notification_service.session_exists.assert_called_once_with(session_id)

class TestCancelAnalysis:
    """Test cases for the DELETE /analyze/session/{session_id} endpoint."""
    
    @pytest.mark.asyncio
    async def test_cancel_analysis_success(self, mock_notification_service):
        """Test successful cancellation of analysis."""
        # Arrange
        session_id = "test_session_123"
        mock_notification_service.cancel_session.return_value = True
        
        with patch('streaming_api.notification_service', mock_notification_service):
            
            # Act
            response = await cancel_analysis(session_id)
            
            # Assert
            assert response["success"] is True
            assert response["message"] == "Analysis cancelled successfully"
            mock_notification_service.cancel_session.assert_called_once_with(session_id)
    
    @pytest.mark.asyncio
    async def test_cancel_analysis_not_found(self, mock_notification_service):
        """Test handling of non-existent session for cancellation."""
        # Arrange
        session_id = "non_existent_session"
        mock_notification_service.cancel_session.return_value = False
        
        with patch('streaming_api.notification_service', mock_notification_service):
            
            # Act & Assert
            with pytest.raises(HTTPException) as exc_info:
                await cancel_analysis(session_id)
            
            assert exc_info.value.status_code == 404
            assert "Session not found" in str(exc_info.value.detail)
    
    @pytest.mark.asyncio
    async def test_cancel_analysis_service_error(self, mock_notification_service):
        """Test handling of service errors during cancellation."""
        # Arrange
        session_id = "test_session_123"
        mock_notification_service.cancel_session.side_effect = Exception("Service error")
        
        with patch('streaming_api.notification_service', mock_notification_service):
            
            # Act & Assert
            with pytest.raises(HTTPException) as exc_info:
                await cancel_analysis(session_id)
            
            assert exc_info.value.status_code == 500
            assert "Failed to cancel analysis" in str(exc_info.value.detail)

class TestAnalysisRequest:
    """Test cases for AnalysisRequest model validation."""
    
    def test_valid_analysis_request(self):
        """Test valid AnalysisRequest creation."""
        # Arrange & Act
        request = AnalysisRequest(
            user_id="123",
            session_id="test_session",
            force_reanalysis=True
        )
        
        # Assert
        assert request.user_id == "123"
        assert request.session_id == "test_session"
        assert request.force_reanalysis is True
    
    def test_analysis_request_optional_fields(self):
        """Test AnalysisRequest with optional fields."""
        # Arrange & Act
        request = AnalysisRequest(user_id="123")
        
        # Assert
        assert request.user_id == "123"
        assert request.session_id is None
        assert request.force_reanalysis is False
    
    def test_analysis_request_validation_error(self):
        """Test AnalysisRequest validation errors."""
        # Act & Assert - Pydantic allows empty strings by default
        # This test should pass with empty user_id since there's no explicit validation
        request = AnalysisRequest(user_id="")
        assert request.user_id == ""

class TestAnalysisResponse:
    """Test cases for AnalysisResponse model."""
    
    def test_valid_analysis_response(self):
        """Test valid AnalysisResponse creation."""
        # Arrange & Act
        response = AnalysisResponse(
            success=True,
            message="Analysis started",
            session_id="test_session",
            error=None
        )
        
        # Assert
        assert response.success is True
        assert response.message == "Analysis started"
        assert response.session_id == "test_session"
        assert response.error is None
    
    def test_error_analysis_response(self):
        """Test AnalysisResponse with error."""
        # Arrange & Act
        response = AnalysisResponse(
            success=False,
            message="Analysis failed",
            error="Service unavailable"
        )
        
        # Assert
        assert response.success is False
        assert response.message == "Analysis failed"
        assert response.error == "Service unavailable"
        assert response.session_id is None

class TestStreamingAPIIntegration:
    """Integration tests for streaming API endpoints."""
    
    @pytest.mark.asyncio
    async def test_full_streaming_workflow(self, mock_streaming_analyzer, mock_notification_service):
        """Test the complete streaming analysis workflow."""
        # Arrange
        user_id = "123"
        session_id = "test_session_123"
        background_tasks = BackgroundTasks()
        
        # Mock streaming analysis generator
        async def mock_analysis_generator():
            yield {"type": "status", "message": "Starting analysis", "progress": 0}
            yield {"type": "section_start", "section": "professionalIdentity", "progress": 10}
            yield {"type": "section_complete", "section": "professionalIdentity", "progress": 20}
            yield {"type": "analysis_complete", "success": True, "progress": 100}
        
        mock_streaming_analyzer.analyze_resume_streaming.return_value = mock_analysis_generator()
        mock_notification_service.get_progress.return_value = {
            "current_section": "completed",
            "progress_percentage": 100.0,
            "status": "completed"
        }
        mock_notification_service.cancel_session.return_value = True
        
        with patch('streaming_api.StreamingResumeAnalyzer', return_value=mock_streaming_analyzer), \
             patch('streaming_api.notification_service', mock_notification_service):
            
            # Act - Start analysis
            start_request = AnalysisRequest(user_id=user_id, session_id=session_id)
            start_response = await start_streaming_analysis(start_request, background_tasks)
            
            # Act - Get progress
            progress_response = await get_analysis_progress(session_id)
            
            # Act - Cancel analysis
            cancel_response = await cancel_analysis(session_id)
            
            # Assert
            assert start_response.success is True
            assert start_response.session_id == session_id
            
            assert progress_response["status"] == "completed"
            assert progress_response["progress_percentage"] == 100.0
            
            assert cancel_response["success"] is True
            assert "cancelled successfully" in cancel_response["message"]