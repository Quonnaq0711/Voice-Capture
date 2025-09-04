"""Pytest configuration and fixtures for career agent unit tests."""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, MagicMock
from typing import Dict, Any, Optional
from datetime import datetime
import sys
import os

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))

# Import modules after path setup
from chat_service import ChatService
from resume_analyzer import ResumeAnalyzer
from workflow_engine import ResumeAnalysisWorkflow
from streaming_analyzer import StreamingResumeAnalyzer
from error_handler import RetryConfig

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture
def mock_chat_service():
    """Mock ChatService for testing."""
    service = Mock(spec=ChatService)
    service.generate_response = AsyncMock()
    service.get_conversation_history = AsyncMock(return_value=[])
    service.get_user_profile = AsyncMock(return_value=None)
    service.store_message = AsyncMock()
    service.conversation = Mock()
    service.conversation.ainvoke = AsyncMock()
    return service

@pytest.fixture
def mock_resume_analyzer():
    """Mock ResumeAnalyzer for testing."""
    analyzer = Mock(spec=ResumeAnalyzer)
    analyzer.get_latest_resume = AsyncMock()
    analyzer.read_resume_content = AsyncMock()
    analyzer.analyze_resume = AsyncMock()
    analyzer.store_career_insight = AsyncMock()
    analyzer.get_latest_career_insight = AsyncMock()
    analyzer.process_user_message = AsyncMock()
    return analyzer

@pytest.fixture
def mock_workflow_engine():
    """Mock ResumeAnalysisWorkflow for testing."""
    workflow = Mock(spec=ResumeAnalysisWorkflow)
    workflow.analyze_resume_sequential = AsyncMock()
    workflow.set_progress_callback = Mock()
    workflow.get_performance_metrics = Mock(return_value={})
    return workflow

@pytest.fixture
def mock_streaming_analyzer():
    """Mock StreamingResumeAnalyzer for testing."""
    analyzer = Mock(spec=StreamingResumeAnalyzer)
    analyzer.analyze_resume_streaming = AsyncMock()
    return analyzer

@pytest.fixture
def mock_workflow():
    """Mock workflow for testing workflow nodes and state management."""
    workflow = Mock()
    workflow.state = Mock()
    workflow.nodes = {}
    workflow.execute = AsyncMock()
    workflow.get_state = Mock()
    workflow.get_progress = Mock()
    workflow.transition_to = Mock()
    workflow.is_valid_transition = Mock()
    workflow.set_progress_callback = Mock()
    workflow.cancel = AsyncMock()
    workflow.is_cancelled = Mock()
    workflow.has_errors = Mock()
    workflow.get_errors = Mock()
    workflow._notify_progress = AsyncMock()
    workflow.get_weighted_progress = Mock()
    
    # Mock individual node execution methods
    workflow._execute_professional_identity_node = AsyncMock()
    workflow._execute_skills_assessment_node = AsyncMock()
    workflow._execute_career_progression_node = AsyncMock()
    workflow._execute_market_analysis_node = AsyncMock()
    workflow._execute_recommendations_node = AsyncMock()
    
    return workflow

@pytest.fixture
def sample_resume_data():
    """Sample resume data for testing."""
    return {
        "id": 1,
        "user_id": 123,
        "filename": "test_resume.pdf",
        "file_path": "/path/to/test_resume.pdf",
        "upload_date": datetime.now(),
        "file_size": 1024
    }

@pytest.fixture
def sample_resume_content():
    """Sample resume content for testing."""
    return """
    John Doe
    Software Engineer
    
    Experience:
    - Senior Software Engineer at Tech Corp (2020-2023)
    - Software Engineer at StartupXYZ (2018-2020)
    
    Skills:
    - Python, JavaScript, React, Node.js
    - AWS, Docker, Kubernetes
    
    Education:
    - BS Computer Science, University of Technology (2018)
    """

@pytest.fixture
def sample_professional_data():
    """Sample professional data for testing."""
    return {
        "professionalIdentity": {
            "title": "Senior Software Engineer",
            "summary": "Experienced software engineer with 5+ years",
            "keyHighlights": ["Full-stack development", "Cloud architecture"]
        },
        "workExperience": {
            "timeline": [
                {
                    "company": "Tech Corp",
                    "position": "Senior Software Engineer",
                    "startDate": "2020-01",
                    "endDate": "2023-12",
                    "duration": "3 years 11 months"
                }
            ],
            "totalExperience": "5 years 2 months"
        },
        "skillsAnalysis": {
            "technicalSkills": ["Python", "JavaScript", "React"],
            "softSkills": ["Leadership", "Communication"],
            "skillGaps": ["Machine Learning", "DevOps"]
        },
        "salaryAnalysis": {
            "currentSalary": 95000,
            "marketRange": {"min": 85000, "max": 120000},
            "projectedGrowth": [
                {"year": 2025, "salary": 105000},
                {"year": 2026, "salary": 115000}
            ]
        },
        "marketPosition": {
            "competitiveness": "High",
            "industryDemand": "Very High",
            "recommendations": ["Consider leadership roles"]
        }
    }

@pytest.fixture
def sample_analysis_progress():
    """Sample analysis progress data for testing."""
    return {
        "current_section": "professionalIdentity",
        "completed_sections": [],
        "total_sections": 5,
        "progress_percentage": 20.0,
        "status": "in_progress",
        "message": "Analyzing professional identity..."
    }

@pytest.fixture
def mock_db_session():
    """Mock database session for testing."""
    session = Mock()
    session.query = Mock()
    session.add = Mock()
    session.commit = Mock()
    session.rollback = Mock()
    session.close = Mock()
    return session

@pytest.fixture
def retry_config():
    """Default retry configuration for testing."""
    return RetryConfig(
        max_retries=2,
        base_delay=0.1,
        max_delay=1.0,
        exponential_backoff=True,
        jitter=False,
        timeout=30.0
    )

@pytest.fixture
def mock_httpx_client():
    """Mock httpx client for testing HTTP requests."""
    client = Mock()
    client.post = AsyncMock()
    client.get = AsyncMock()
    client.delete = AsyncMock()
    return client

@pytest.fixture
def mock_notification_service():
    """Mock notification service for testing."""
    service = Mock()
    service.send_notification = AsyncMock()
    service.register_session = Mock()
    service.update_progress = Mock()
    service.complete_analysis = Mock()
    service.cleanup_session = Mock()
    service.get_progress = Mock()
    service.session_exists = Mock(return_value=True)
    service.stream_updates = AsyncMock()
    service.cancel_session = Mock(return_value=True)
    service.get_active_sessions = Mock(return_value=[])
    return service

# Async test utilities
@pytest.fixture
def async_mock():
    """Helper to create async mocks."""
    def _async_mock(*args, **kwargs):
        return AsyncMock(*args, **kwargs)
    return _async_mock

# Test data generators
@pytest.fixture
def generate_test_user_id():
    """Generate test user IDs."""
    def _generate(base_id: int = 123) -> int:
        return base_id
    return _generate

@pytest.fixture
def generate_test_session_id():
    """Generate test session IDs."""
    def _generate(user_id: int = 123) -> str:
        return f"test_session_{user_id}_{int(datetime.now().timestamp())}"
    return _generate