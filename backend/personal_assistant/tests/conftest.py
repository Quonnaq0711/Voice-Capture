import pytest
import asyncio
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
import sys
import os

# Add the project root directory to the Python path to allow for absolute imports
# This matches the path setup in main.py
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
sys.path.insert(0, project_root)

from backend.personal_assistant.main import app
from backend.personal_assistant.chat_service import get_chat_service, ChatService
from backend.db.database import get_db

# Import vLLM implementation
try:
    from backend.personal_assistant.chat_service_vllm import ChatServiceVLLM
except ImportError:
    ChatServiceVLLM = None

# Mock ChatService for testing
class MockChatService(ChatService):
    async def generate_response(self, user_message, session_id, user_id, db, cancellation_event):
        return {
            "response": f"Mock response to: {user_message}",
            "model": "mock_model",
            "session_id": session_id,
            "status": "success"
        }

    async def health_check(self):
        return {
            "status": "healthy",
            "model": "mock_model",
            "base_url": "http://mock-ollama"
        }

    async def clear_memory(self, session_id):
        return True

    async def get_conversation_history(self, session_id):
        return [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"}
        ]

    async def remove_messages_after_index(self, session_id, message_index):
        return True

    async def update_message_at_index(self, session_id, message_index, new_content):
        return True

    async def get_available_models(self):
        return {
            "current_model": "gemma3:latest",
            "base_url": "http://mock-ollama",
            "description": "Mock Ollama instance",
            "capabilities": ["text_generation"]
        }

    async def generate_streaming_response(self, message, session_id, user_id, db):
        chunks = [
            {"type": "content", "content": "Mock stream response part 1"},
            {"type": "content", "content": "Mock stream response part 2"},
            {"type": "complete", "content": "Stream finished"}
        ]
        for chunk in chunks:
            yield chunk
            await asyncio.sleep(0.01)
        # Add a final delay to ensure the client receives the last message
        await asyncio.sleep(0.1)

# Fixture for the mock chat service
@pytest.fixture
def mock_chat_service():
    return MockChatService()

# Fixture for the FastAPI test client
@pytest.fixture
def client(mock_chat_service):
    # Dependency override for get_chat_service
    app.dependency_overrides[get_chat_service] = lambda: mock_chat_service
    
    # Mock get_db dependency
    def get_db_mock():
        return None  # We don't need a real DB session for these tests
    app.dependency_overrides[get_db] = get_db_mock

    with TestClient(app) as test_client:
        yield test_client
    
    # Clear dependency overrides after tests
    app.dependency_overrides.clear()

# Fixture for the async test client
@pytest_asyncio.fixture
async def async_client(mock_chat_service):
    """Provides an asynchronous test client."""
    app.dependency_overrides[get_chat_service] = lambda: mock_chat_service
    
    def get_db_mock():
        return None
    app.dependency_overrides[get_db] = get_db_mock

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()

# Fixture for vLLM ChatService mock
@pytest.fixture
def mock_chat_service_vllm():
    """Mock ChatServiceVLLM for testing."""
    if ChatServiceVLLM is None:
        pytest.skip("ChatServiceVLLM not available")

    from unittest.mock import Mock, AsyncMock

    service = Mock(spec=ChatServiceVLLM)
    service.generate_response = AsyncMock()
    # Note: generate_streaming_response is an async generator, use Mock not AsyncMock
    service.generate_streaming_response = Mock()
    service.generate_follow_up_questions = AsyncMock()
    service.optimize_query = AsyncMock()
    service.get_session_history = Mock()
    service.get_conversation_history = AsyncMock()
    service.get_user_profile = AsyncMock(return_value=None)
    service.health_check = AsyncMock()
    service.clear_memory = AsyncMock()
    service.remove_messages_after_index = AsyncMock()
    service.update_message_at_index = AsyncMock()
    service._create_llm_with_max_tokens = Mock()
    service._count_message_tokens = Mock(return_value=100)
    service._calculate_dynamic_max_tokens = Mock(return_value=2048)
    service._apply_sliding_window = Mock()
    service._ensure_alternating_roles = Mock()
    service._generate_sync_response = Mock()
    service._generate_follow_up_sync = Mock(return_value="Question 1?")
    service._optimize_sync_query = Mock(return_value="optimized query")
    service._format_profile_for_context = Mock(return_value="User profile context")
    service._parse_follow_up_questions = Mock(return_value=["Q1?", "Q2?", "Q3?"])
    service._add_to_history = Mock()
    service.cleanup = Mock()

    # Set attributes
    service.model_name = "test-model"
    service.api_base = "http://test:8888/v1"
    service.base_url = "http://test:8888/v1"
    service.temperature = 0.7
    service.max_tokens = 2048
    service.top_p = 0.9
    service.frequency_penalty = 0.0
    service.presence_penalty = 0.0
    service.max_history_turns = 10
    service.max_model_len = 4096
    service.safety_margin = 512
    service.store = {}

    return service
