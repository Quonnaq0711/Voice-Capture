import pytest
from fastapi import status
from datetime import datetime
from unittest.mock import patch

from models.chat import ChatMessage

class TestChatAPI:
    """Test cases for Chat API endpoints"""
    
    def test_create_chat_message_with_active_session(self, client, test_user, test_session, auth_headers, db_session):
        """Test creating chat message when user has active session"""
        # Create an active session for the user
        test_session.is_active = True
        db_session.commit()
        
        message_data = {
            "message_text": "Hello, this is a test message",
            "sender": "user"
        }
        
        response = client.post("/api/v1/chat/messages", json=message_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message_text"] == "Hello, this is a test message"
        assert data["sender"] == "user"
        assert data["user_id"] == test_user.id
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
    
    def test_create_chat_message_no_active_session(self, client, test_user, auth_headers, db_session):
        """Test creating chat message when user has no active session"""
        # No active session setup needed - test_session is not active by default
        
        message_data = {
            "message_text": "Hello without session",
            "sender": "assistant"
        }
        
        response = client.post("/api/v1/chat/messages", json=message_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message_text"] == "Hello without session"
        assert data["sender"] == "assistant"
        assert data["user_id"] == test_user.id
    
    def test_create_chat_message_unauthorized(self, client):
        """Test creating chat message without authentication"""
        message_data = {
            "message_text": "Unauthorized message",
            "sender": "user"
        }
        
        response = client.post("/api/v1/chat/messages", json=message_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_chat_message_invalid_sender(self, client, test_user, auth_headers):
        """Test creating chat message with invalid sender"""
        message_data = {
            "message_text": "Test message",
            "sender": "invalid_sender"  # Should be 'user' or 'assistant'
        }
        
        response = client.post("/api/v1/chat/messages", json=message_data, headers=auth_headers)
        
        # This should still work as the API doesn't validate sender values
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["sender"] == "invalid_sender"
    
    def test_create_chat_message_empty_text(self, client, test_user, auth_headers):
        """Test creating chat message with empty text"""
        message_data = {
            "message_text": "",
            "sender": "user"
        }
        
        response = client.post("/api/v1/chat/messages", json=message_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message_text"] == ""
    
    def test_get_chat_history_with_session_id(self, client, test_user, test_session, auth_headers, db_session):
        """Test getting chat history with specific session ID"""
        # Create test messages
        message1 = ChatMessage(
            user_id=test_user.id,
            message_text="First message",
            sender="user",
            session_id=test_session.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        message2 = ChatMessage(
            user_id=test_user.id,
            message_text="Second message",
            sender="assistant",
            session_id=test_session.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(message1)
        db_session.add(message2)
        db_session.commit()
        
        response = client.get(f"/api/v1/chat/messages?session_id={test_session.id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "messages" in data
        assert "total_count" in data
        assert data["total_count"] == 2
        assert len(data["messages"]) == 2
        assert data["messages"][0]["message_text"] == "First message"
        assert data["messages"][1]["message_text"] == "Second message"
    
    def test_get_chat_history_no_session_id_with_active_session(self, client, test_user, test_session, auth_headers, db_session):
        """Test getting chat history without session ID when user has active session"""
        # Set up active session
        test_session.is_active = True
        db_session.commit()
        
        # Create test messages for the active session
        message1 = ChatMessage(
            user_id=test_user.id,
            message_text="Active session message 1",
            sender="user",
            session_id=test_session.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        message2 = ChatMessage(
            user_id=test_user.id,
            message_text="Active session message 2",
            sender="assistant",
            session_id=test_session.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(message1)
        db_session.add(message2)
        db_session.commit()
        
        response = client.get("/api/v1/chat/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 2
        assert len(data["messages"]) == 2
    
    def test_get_chat_history_no_session_id_no_active_session(self, client, test_user, auth_headers, db_session):
        """Test getting chat history without session ID when user has no active session"""
        # No active session setup needed - test_session is not active by default
        
        # Create test messages without session_id (legacy messages)
        message1 = ChatMessage(
            user_id=test_user.id,
            message_text="Legacy message 1",
            sender="user",
            session_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        message2 = ChatMessage(
            user_id=test_user.id,
            message_text="Legacy message 2",
            sender="assistant",
            session_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(message1)
        db_session.add(message2)
        db_session.commit()
        
        response = client.get("/api/v1/chat/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 2
        assert len(data["messages"]) == 2
    
    def test_get_chat_history_with_pagination(self, client, test_user, auth_headers, db_session):
        """Test getting chat history with pagination"""
        # Create multiple test messages
        for i in range(10):
            message = ChatMessage(
                user_id=test_user.id,
                message_text=f"Message {i+1}",
                sender="user" if i % 2 == 0 else "assistant",
                session_id=None,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db_session.add(message)
        db_session.commit()
        
        # Test first page
        response = client.get("/api/v1/chat/messages?limit=5&offset=0", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 10
        assert len(data["messages"]) == 5
        
        # Test second page
        response = client.get("/api/v1/chat/messages?limit=5&offset=5", headers=auth_headers)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 10
        assert len(data["messages"]) == 5
    
    def test_get_chat_history_empty(self, client, test_user, auth_headers):
        """Test getting chat history when user has no messages"""
        response = client.get("/api/v1/chat/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 0
        assert data["messages"] == []
    
    def test_get_chat_history_unauthorized(self, client):
        """Test getting chat history without authentication"""
        response = client.get("/api/v1/chat/messages")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_chat_history_other_user_messages_not_visible(self, client, test_user, auth_headers, db_session):
        """Test that user can only see their own messages"""
        # Create another user and their messages
        from models.user import User
        from utils.auth import get_password_hash
        
        other_user = User(
            first_name="otheruser",
            last_name="tester",
            email="other@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
        
        # Create messages for both users
        user_message = ChatMessage(
            user_id=test_user.id,
            message_text="My message",
            sender="user",
            session_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        other_message = ChatMessage(
            user_id=other_user.id,
            message_text="Other user message",
            sender="user",
            session_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(user_message)
        db_session.add(other_message)
        db_session.commit()
        
        response = client.get("/api/v1/chat/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total_count"] == 1
        assert len(data["messages"]) == 1
        assert data["messages"][0]["message_text"] == "My message"
        assert data["messages"][0]["user_id"] == test_user.id
    
    def test_clear_chat_history_success(self, client, test_user, auth_headers, db_session):
        """Test clearing chat history successfully"""
        # Create test messages
        message1 = ChatMessage(
            user_id=test_user.id,
            message_text="Message to be deleted 1",
            sender="user",
            session_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        message2 = ChatMessage(
            user_id=test_user.id,
            message_text="Message to be deleted 2",
            sender="assistant",
            session_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(message1)
        db_session.add(message2)
        db_session.commit()
        
        # Verify messages exist
        messages_before = db_session.query(ChatMessage).filter(ChatMessage.user_id == test_user.id).all()
        assert len(messages_before) == 2
        
        response = client.delete("/api/v1/chat/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Chat history cleared successfully"
        
        # Verify messages are deleted
        messages_after = db_session.query(ChatMessage).filter(ChatMessage.user_id == test_user.id).all()
        assert len(messages_after) == 0
    
    def test_clear_chat_history_no_messages(self, client, test_user, auth_headers):
        """Test clearing chat history when user has no messages"""
        response = client.delete("/api/v1/chat/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Chat history cleared successfully"
    
    def test_clear_chat_history_unauthorized(self, client):
        """Test clearing chat history without authentication"""
        response = client.delete("/api/v1/chat/messages")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_clear_chat_history_only_user_messages(self, client, test_user, auth_headers, db_session):
        """Test that clearing chat history only deletes current user's messages"""
        # Create another user and their messages
        from models.user import User
        from utils.auth import get_password_hash
        
        other_user = User(
            first_name="otheruser",
            last_name="tester",
            email="other@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
        
        # Create messages for both users
        user_message = ChatMessage(
            user_id=test_user.id,
            message_text="My message to delete",
            sender="user",
            session_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        other_message = ChatMessage(
            user_id=other_user.id,
            message_text="Other user message to keep",
            sender="user",
            session_id=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(user_message)
        db_session.add(other_message)
        db_session.commit()
        
        response = client.delete("/api/v1/chat/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        
        # Verify only current user's messages are deleted
        user_messages = db_session.query(ChatMessage).filter(ChatMessage.user_id == test_user.id).all()
        other_messages = db_session.query(ChatMessage).filter(ChatMessage.user_id == other_user.id).all()
        
        assert len(user_messages) == 0
        assert len(other_messages) == 1
        assert other_messages[0].message_text == "Other user message to keep"