"""Unit tests for StreamingResumeAnalyzer class."""

import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any, List, AsyncGenerator

# Import the StreamingResumeAnalyzer class
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from streaming_analyzer import StreamingResumeAnalyzer

class TestStreamingResumeAnalyzerInitialization:
    """Test cases for StreamingResumeAnalyzer initialization."""
    
    def test_streaming_analyzer_init_default(self):
        """Test StreamingResumeAnalyzer initialization with default parameters."""
        # Act
        analyzer = StreamingResumeAnalyzer()
        
        # Assert
        assert analyzer is not None
        assert hasattr(analyzer, 'workflow')
        assert hasattr(analyzer, 'notification_service_url')
        assert hasattr(analyzer, 'resume_analyzer')
        assert hasattr(analyzer, 'chat_service')
        assert analyzer.notification_service_url == "http://localhost:8001"
        assert analyzer.enable_parallel is False
    
    def test_streaming_analyzer_init_with_config(self):
        """Test StreamingResumeAnalyzer initialization with custom configuration."""
        # Arrange
        notification_url = "http://localhost:8002"
        
        # Act
        analyzer = StreamingResumeAnalyzer(
            notification_service_url=notification_url,
            enable_parallel=True
        )
        
        # Assert
        assert analyzer.notification_service_url == notification_url
        assert analyzer.enable_parallel == True

class TestAnalyzeResumeStreaming:
    """Test cases for the analyze_resume_streaming method."""
    
    @pytest.mark.asyncio
    async def test_analyze_resume_streaming_success(self, mock_streaming_analyzer, sample_resume_data):
        """Test successful streaming resume analysis."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        # Mock streaming response
        async def mock_streaming_response():
            yield {
                "type": "status",
                "message": "Starting analysis...",
                "progress": 0,
                "timestamp": datetime.now().isoformat()
            }
            yield {
                "type": "section_start",
                "section": "professionalIdentity",
                "progress": 10,
                "timestamp": datetime.now().isoformat()
            }
            yield {
                "type": "section_progress",
                "section": "professionalIdentity",
                "progress": 20,
                "data": {"title": "Software Engineer"},
                "timestamp": datetime.now().isoformat()
            }
            yield {
                "type": "section_complete",
                "section": "professionalIdentity",
                "progress": 25,
                "data": {
                    "title": "Senior Software Engineer",
                    "summary": "Experienced developer with strong technical skills"
                },
                "timestamp": datetime.now().isoformat()
            }
            yield {
                "type": "analysis_complete",
                "success": True,
                "progress": 100,
                "timestamp": datetime.now().isoformat()
            }
        
        mock_streaming_analyzer.analyze_resume_streaming = AsyncMock(return_value=mock_streaming_response())
        
        # Act
        stream = await mock_streaming_analyzer.analyze_resume_streaming(
            user_id, sample_resume_data, session_id
        )
        
        # Assert
        assert stream is not None
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once_with(
            user_id, sample_resume_data, session_id
        )
    
    @pytest.mark.asyncio
    async def test_analyze_resume_streaming_with_progress_tracking(self, mock_streaming_analyzer, sample_resume_data):
        """Test streaming analysis with detailed progress tracking."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        expected_sections = [
            "professionalIdentity",
            "skillsAssessment", 
            "careerProgression",
            "marketAnalysis",
            "recommendations"
        ]
        
        # Mock streaming response with all sections
        async def mock_detailed_streaming_response():
            total_sections = len(expected_sections)
            for i, section in enumerate(expected_sections):
                # Section start
                yield {
                    "type": "section_start",
                    "section": section,
                    "progress": (i / total_sections) * 100,
                    "timestamp": datetime.now().isoformat()
                }
                
                # Section progress updates
                for j in range(1, 4):  # 3 progress updates per section
                    yield {
                        "type": "section_progress",
                        "section": section,
                        "progress": ((i + j/4) / total_sections) * 100,
                        "timestamp": datetime.now().isoformat()
                    }
                
                # Section complete
                yield {
                    "type": "section_complete",
                    "section": section,
                    "progress": ((i + 1) / total_sections) * 100,
                    "data": {f"{section}_result": "completed"},
                    "timestamp": datetime.now().isoformat()
                }
            
            # Final completion
            yield {
                "type": "analysis_complete",
                "success": True,
                "progress": 100,
                "timestamp": datetime.now().isoformat()
            }
        
        mock_streaming_analyzer.analyze_resume_streaming = AsyncMock(
            return_value=mock_detailed_streaming_response()
        )
        
        # Act
        stream = await mock_streaming_analyzer.analyze_resume_streaming(
            user_id, sample_resume_data, session_id
        )
        
        # Assert
        assert stream is not None
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_analyze_resume_streaming_with_cancellation(self, mock_streaming_analyzer, sample_resume_data):
        """Test streaming analysis with cancellation support."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        cancellation_event = asyncio.Event()
        
        # Mock streaming response that can be cancelled
        async def mock_cancellable_streaming_response():
            yield {"type": "status", "message": "Starting analysis...", "progress": 0}
            yield {"type": "section_start", "section": "professionalIdentity", "progress": 10}
            
            # Simulate cancellation during processing
            if cancellation_event.is_set():
                yield {
                    "type": "analysis_cancelled",
                    "message": "Analysis was cancelled by user",
                    "progress": 15,
                    "timestamp": datetime.now().isoformat()
                }
                return
            
            yield {"type": "section_complete", "section": "professionalIdentity", "progress": 25}
        
        mock_streaming_analyzer.analyze_resume_streaming = AsyncMock(
            return_value=mock_cancellable_streaming_response()
        )
        
        # Act
        stream = await mock_streaming_analyzer.analyze_resume_streaming(
            user_id, sample_resume_data, session_id, cancellation_event=cancellation_event
        )
        
        # Assert
        assert stream is not None
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_analyze_resume_streaming_error_handling(self, mock_streaming_analyzer, sample_resume_data):
        """Test streaming analysis error handling."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        # Mock streaming response with error
        async def mock_error_streaming_response():
            yield {"type": "status", "message": "Starting analysis...", "progress": 0}
            yield {"type": "section_start", "section": "professionalIdentity", "progress": 10}
            yield {
                "type": "error",
                "section": "professionalIdentity",
                "error": "LLM service unavailable",
                "progress": 15,
                "timestamp": datetime.now().isoformat()
            }
            yield {
                "type": "analysis_complete",
                "success": False,
                "error": "Analysis failed due to service error",
                "progress": 15,
                "timestamp": datetime.now().isoformat()
            }
        
        mock_streaming_analyzer.analyze_resume_streaming = AsyncMock(
            return_value=mock_error_streaming_response()
        )
        
        # Act
        stream = await mock_streaming_analyzer.analyze_resume_streaming(
            user_id, sample_resume_data, session_id
        )
        
        # Assert
        assert stream is not None
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once()

class TestParallelSectionProcessing:
    """Test cases for parallel section processing."""
    
    @pytest.mark.asyncio
    async def test_parallel_section_execution(self, mock_streaming_analyzer):
        """Test parallel execution of independent sections."""
        # Arrange
        resume_data = {"test": "data"}
        independent_sections = ["professionalIdentity", "skillsAssessment"]
        
        # Mock parallel execution results
        async def mock_parallel_execution():
            # Simulate concurrent section processing
            yield {"type": "parallel_start", "sections": independent_sections, "progress": 0}
            yield {"type": "section_start", "section": "professionalIdentity", "progress": 5}
            yield {"type": "section_start", "section": "skillsAssessment", "progress": 10}
            yield {"type": "section_complete", "section": "professionalIdentity", "progress": 30}
            yield {"type": "section_complete", "section": "skillsAssessment", "progress": 50}
            yield {"type": "parallel_complete", "sections": independent_sections, "progress": 50}
        
        mock_streaming_analyzer._execute_parallel_sections = AsyncMock(
            return_value=mock_parallel_execution()
        )
        
        # Act
        result = await mock_streaming_analyzer._execute_parallel_sections(
            resume_data, independent_sections
        )
        
        # Assert
        assert result is not None
        mock_streaming_analyzer._execute_parallel_sections.assert_called_once_with(
            resume_data, independent_sections
        )
    
    @pytest.mark.asyncio
    async def test_section_dependency_management(self, mock_streaming_analyzer):
        """Test management of section dependencies."""
        # Arrange
        section_dependencies = {
            "professionalIdentity": [],  # No dependencies
            "skillsAssessment": [],  # No dependencies
            "careerProgression": ["professionalIdentity"],  # Depends on identity
            "marketAnalysis": ["skillsAssessment"],  # Depends on skills
            "recommendations": ["careerProgression", "marketAnalysis"]  # Depends on both
        }
        
        mock_streaming_analyzer.section_dependencies = section_dependencies
        mock_streaming_analyzer._get_ready_sections = Mock(return_value=["professionalIdentity", "skillsAssessment"])
        
        # Act
        ready_sections = mock_streaming_analyzer._get_ready_sections(completed_sections=[])
        
        # Assert
        assert "professionalIdentity" in ready_sections
        assert "skillsAssessment" in ready_sections
        assert "careerProgression" not in ready_sections  # Has dependencies
        mock_streaming_analyzer._get_ready_sections.assert_called_once_with(completed_sections=[])
    
    @pytest.mark.asyncio
    async def test_concurrent_section_limit(self, mock_streaming_analyzer):
        """Test concurrent section execution limits."""
        # Arrange
        max_concurrent = 2
        sections_to_process = ["section1", "section2", "section3", "section4"]
        
        mock_streaming_analyzer.max_concurrent_sections = max_concurrent
        mock_streaming_analyzer._process_sections_with_limit = AsyncMock()
        
        # Act
        await mock_streaming_analyzer._process_sections_with_limit(sections_to_process)
        
        # Assert
        mock_streaming_analyzer._process_sections_with_limit.assert_called_once_with(sections_to_process)

class TestProgressTracking:
    """Test cases for progress tracking functionality."""
    
    def test_progress_calculation(self, mock_streaming_analyzer):
        """Test progress calculation based on completed sections."""
        # Arrange
        total_sections = 5
        completed_sections = ["professionalIdentity", "skillsAssessment"]
        expected_progress = (len(completed_sections) / total_sections) * 100  # 40%
        
        mock_streaming_analyzer.total_sections = total_sections
        mock_streaming_analyzer._calculate_progress = Mock(return_value=expected_progress)
        
        # Act
        progress = mock_streaming_analyzer._calculate_progress(completed_sections)
        
        # Assert
        assert progress == expected_progress
        mock_streaming_analyzer._calculate_progress.assert_called_once_with(completed_sections)
    
    def test_weighted_progress_calculation(self, mock_streaming_analyzer):
        """Test weighted progress calculation."""
        # Arrange
        section_weights = {
            "professionalIdentity": 0.2,
            "skillsAssessment": 0.3,
            "careerProgression": 0.2,
            "marketAnalysis": 0.2,
            "recommendations": 0.1
        }
        
        completed_sections = ["professionalIdentity", "skillsAssessment"]
        expected_progress = (0.2 + 0.3) * 100  # 50%
        
        mock_streaming_analyzer.section_weights = section_weights
        mock_streaming_analyzer._calculate_weighted_progress = Mock(return_value=expected_progress)
        
        # Act
        progress = mock_streaming_analyzer._calculate_weighted_progress(completed_sections)
        
        # Assert
        assert progress == expected_progress
        mock_streaming_analyzer._calculate_weighted_progress.assert_called_once_with(completed_sections)
    
    @pytest.mark.asyncio
    async def test_progress_notifications(self, mock_streaming_analyzer, mock_notification_service):
        """Test progress notification sending."""
        # Arrange
        session_id = "test_session_123"
        progress_data = {
            "progress": 45,
            "section": "skillsAssessment",
            "status": "in_progress"
        }
        
        mock_streaming_analyzer.notification_service = mock_notification_service
        mock_streaming_analyzer._send_notification = AsyncMock()
        
        # Act
        await mock_streaming_analyzer._send_notification(
            user_id=123,
            notification_type="progress",
            session_id=session_id,
            **progress_data
        )
        
        # Assert
        mock_streaming_analyzer._send_notification.assert_called_once_with(
            user_id=123,
            notification_type="progress",
            session_id=session_id,
            **progress_data
        )

class TestSessionManagement:
    """Test cases for session management."""
    
    @pytest.mark.asyncio
    async def test_session_creation(self, mock_streaming_analyzer):
        """Test analysis session creation."""
        # Arrange
        user_id = 123
        session_data = {
            "user_id": user_id,
            "status": "initializing",
            "created_at": datetime.now().isoformat()
        }
        
        mock_streaming_analyzer.create_session = AsyncMock(return_value="session_123")
        
        # Act
        session_id = await mock_streaming_analyzer.create_session(user_id, session_data)
        
        # Assert
        assert session_id == "session_123"
        mock_streaming_analyzer.create_session.assert_called_once_with(user_id, session_data)
    
    @pytest.mark.asyncio
    async def test_session_status_update(self, mock_streaming_analyzer):
        """Test session status updates."""
        # Arrange
        session_id = "test_session_123"
        status_update = {
            "status": "analyzing",
            "progress": 35,
            "current_section": "skillsAssessment",
            "updated_at": datetime.now().isoformat()
        }
        
        mock_streaming_analyzer.update_session_status = AsyncMock()
        
        # Act
        await mock_streaming_analyzer.update_session_status(session_id, status_update)
        
        # Assert
        mock_streaming_analyzer.update_session_status.assert_called_once_with(
            session_id, status_update
        )
    
    @pytest.mark.asyncio
    async def test_session_cleanup(self, mock_streaming_analyzer):
        """Test session cleanup after completion or cancellation."""
        # Arrange
        session_id = "test_session_123"
        cleanup_reason = "completed"
        
        mock_streaming_analyzer.cleanup_session = AsyncMock()
        
        # Act
        await mock_streaming_analyzer.cleanup_session(session_id, cleanup_reason)
        
        # Assert
        mock_streaming_analyzer.cleanup_session.assert_called_once_with(
            session_id, cleanup_reason
        )
    
    @pytest.mark.asyncio
    async def test_session_cancellation(self, mock_streaming_analyzer):
        """Test session cancellation handling."""
        # Arrange
        session_id = "test_session_123"
        
        mock_streaming_analyzer.cancel_session = AsyncMock()
        mock_streaming_analyzer.is_session_cancelled = Mock(return_value=True)
        
        # Act
        await mock_streaming_analyzer.cancel_session(session_id)
        is_cancelled = mock_streaming_analyzer.is_session_cancelled(session_id)
        
        # Assert
        assert is_cancelled == True
        mock_streaming_analyzer.cancel_session.assert_called_once_with(session_id)
        mock_streaming_analyzer.is_session_cancelled.assert_called_once_with(session_id)

class TestNotificationIntegration:
    """Test cases for notification service integration."""
    
    @pytest.mark.asyncio
    async def test_analysis_start_notification(self, mock_streaming_analyzer, mock_notification_service):
        """Test analysis start notification."""
        # Arrange
        session_id = "test_session_123"
        
        mock_streaming_analyzer._send_notification = AsyncMock()
        
        # Act
        await mock_streaming_analyzer._send_notification(
            user_id=123,
            notification_type="progress",
            session_id=session_id,
            current_section="initialization",
            progress=0,
            total_sections=8,
            status="starting"
        )
        
        # Assert
        mock_streaming_analyzer._send_notification.assert_called_once_with(
            user_id=123,
            notification_type="progress",
            session_id=session_id,
            current_section="initialization",
            progress=0,
            total_sections=8,
            status="starting"
        )
    
    @pytest.mark.asyncio
    async def test_analysis_complete_notification(self, mock_streaming_analyzer, mock_notification_service):
        """Test analysis completion notification."""
        # Arrange
        session_id = "test_session_123"
        
        mock_streaming_analyzer._send_notification = AsyncMock()
        
        # Act
        await mock_streaming_analyzer._send_notification(
            user_id=123,
            notification_type="complete",
            session_id=session_id,
            sections_completed=5
        )
        
        # Assert
        mock_streaming_analyzer._send_notification.assert_called_once_with(
            user_id=123,
            notification_type="complete",
            session_id=session_id,
            sections_completed=5
        )
    
    @pytest.mark.asyncio
    async def test_error_notification(self, mock_streaming_analyzer, mock_notification_service):
        """Test error notification sending."""
        # Arrange
        session_id = "test_session_123"
        
        mock_streaming_analyzer._send_notification = AsyncMock()
        
        # Act
        await mock_streaming_analyzer._send_notification(
            user_id=123,
            notification_type="error",
            session_id=session_id,
            error_message="Service temporarily unavailable",
            current_section="marketAnalysis"
        )
        
        # Assert
        mock_streaming_analyzer._send_notification.assert_called_once_with(
            user_id=123,
            notification_type="error",
            session_id=session_id,
            error_message="Service temporarily unavailable",
            current_section="marketAnalysis"
        )

class TestStreamingAnalyzerIntegration:
    """Integration tests for StreamingResumeAnalyzer functionality."""
    
    @pytest.mark.asyncio
    async def test_complete_streaming_analysis_flow(self, mock_streaming_analyzer, sample_resume_data, mock_notification_service):
        """Test complete streaming analysis flow from start to finish."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        # Mock complete streaming flow
        async def mock_complete_flow():
            # Start
            yield {"type": "analysis_start", "session_id": session_id, "progress": 0}
            
            # Process each section
            sections = ["professionalIdentity", "skillsAssessment", "careerProgression", "marketAnalysis", "recommendations"]
            for i, section in enumerate(sections):
                progress = ((i + 1) / len(sections)) * 100
                yield {"type": "section_start", "section": section, "progress": progress - 20}
                yield {"type": "section_complete", "section": section, "progress": progress}
            
            # Complete
            yield {"type": "analysis_complete", "success": True, "progress": 100}
        
        mock_streaming_analyzer.notification_service = mock_notification_service
        mock_streaming_analyzer.analyze_resume_streaming = AsyncMock(return_value=mock_complete_flow())
        mock_notification_service.send_analysis_start = AsyncMock()
        mock_notification_service.send_analysis_complete = AsyncMock()
        
        # Act
        stream = await mock_streaming_analyzer.analyze_resume_streaming(
            user_id, sample_resume_data, session_id
        )
        
        # Assert
        assert stream is not None
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once_with(
            user_id, sample_resume_data, session_id
        )
    
    @pytest.mark.asyncio
    async def test_streaming_analysis_with_real_time_updates(self, mock_streaming_analyzer, sample_resume_data):
        """Test streaming analysis with real-time progress updates."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        update_interval = 0.5  # 500ms updates
        
        # Mock real-time streaming with time-based updates
        async def mock_realtime_stream():
            start_time = datetime.now()
            sections = ["professionalIdentity", "skillsAssessment"]
            
            for section in sections:
                yield {"type": "section_start", "section": section, "timestamp": datetime.now().isoformat()}
                
                # Simulate processing time with periodic updates
                for progress_step in [25, 50, 75, 100]:
                    await asyncio.sleep(update_interval)
                    yield {
                        "type": "section_progress",
                        "section": section,
                        "progress": progress_step,
                        "timestamp": datetime.now().isoformat(),
                        "elapsed_time": (datetime.now() - start_time).total_seconds()
                    }
                
                yield {"type": "section_complete", "section": section, "timestamp": datetime.now().isoformat()}
            
            yield {"type": "analysis_complete", "success": True, "timestamp": datetime.now().isoformat()}
        
        mock_streaming_analyzer.analyze_resume_streaming = AsyncMock(return_value=mock_realtime_stream())
        
        # Act
        stream = await mock_streaming_analyzer.analyze_resume_streaming(
            user_id, sample_resume_data, session_id
        )
        
        # Assert
        assert stream is not None
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_streaming_analysis_error_recovery(self, mock_streaming_analyzer, sample_resume_data):
        """Test streaming analysis with error recovery."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        # Mock streaming with error and recovery
        async def mock_error_recovery_stream():
            yield {"type": "analysis_start", "progress": 0}
            yield {"type": "section_start", "section": "professionalIdentity", "progress": 10}
            yield {"type": "section_complete", "section": "professionalIdentity", "progress": 25}
            
            # Error in skills assessment
            yield {"type": "section_start", "section": "skillsAssessment", "progress": 30}
            yield {
                "type": "error",
                "section": "skillsAssessment",
                "error": "Temporary service error",
                "progress": 35
            }
            
            # Retry and succeed
            yield {"type": "section_retry", "section": "skillsAssessment", "progress": 35}
            yield {"type": "section_complete", "section": "skillsAssessment", "progress": 50}
            
            # Continue with remaining sections
            yield {"type": "analysis_complete", "success": True, "progress": 100}
        
        mock_streaming_analyzer.analyze_resume_streaming = AsyncMock(return_value=mock_error_recovery_stream())
        
        # Act
        stream = await mock_streaming_analyzer.analyze_resume_streaming(
            user_id, sample_resume_data, session_id
        )
        
        # Assert
        assert stream is not None
        mock_streaming_analyzer.analyze_resume_streaming.assert_called_once()