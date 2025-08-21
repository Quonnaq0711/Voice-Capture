import pytest
from fastapi import status

class TestChatApi:
    """Test suite for the Personal Assistant Chat API"""

    def test_send_message_success(self, client):
        """Test successful message sending"""
        payload = {"message": "Hello", "session_id": "test_session"}
        response = client.post("/api/chat/message", json=payload)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "success"
        assert data["response"] == "Mock response to: Hello"
        assert data["model"] == "mock_model"

    def test_send_message_empty(self, client):
        """Test sending an empty message"""
        payload = {"message": " ", "session_id": "test_session"}
        response = client.post("/api/chat/message", json=payload)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_health_check(self, client):
        """Test the health check endpoint"""
        response = client.get("/api/chat/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "healthy"
        assert data["model"] == "mock_model"

    def test_clear_memory(self, client):
        """Test clearing conversation memory"""
        response = client.delete("/api/chat/memory?session_id=test_session")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"message": "Conversation memory cleared successfully for session: test_session"}

    def test_get_history(self, client):
        """Test retrieving conversation history"""
        response = client.get("/api/chat/history?session_id=test_session")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_messages"] == 2
        assert len(data["history"]) == 2
        assert data["history"][0]["role"] == "user"

    def test_remove_messages_after(self, client):
        """Test removing messages after a specific index"""
        response = client.delete("/api/chat/history/after/0?session_id=test_session")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"message": "Messages after index 0 removed successfully for session: test_session"}

    def test_update_message_at(self, client):
        """Test updating a message at a specific index"""
        response = client.put("/api/chat/history/0?session_id=test_session&new_content=Updated%20message")
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {"message": "Message at index 0 updated successfully for session: test_session"}

    def test_get_models(self, client):
        """Test retrieving available models"""
        response = client.get("/api/chat/models")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["current_model"] == "gemma3:latest"
        assert "text_generation" in data["capabilities"]

    def test_root_endpoint(self, client):
        """Test the root endpoint"""
        response = client.get("/")
        assert response.status_code == status.HTTP_200_OK
        assert "Personal Assistant Chat API" in response.json()["message"]

    def test_api_health_endpoint(self, client):
        """Test the /health endpoint"""
        response = client.get("/health")
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["status"] == "healthy"