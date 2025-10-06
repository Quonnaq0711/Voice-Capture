import pytest
import asyncio
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport
import sys
import os

# Add the backend directory to the Python path to allow for absolute imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from main import app
from chat_service import get_chat_service, ChatService
from db.database import get_db

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
