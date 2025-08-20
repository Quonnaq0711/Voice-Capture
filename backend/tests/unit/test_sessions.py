import pytest
from fastapi import status
from datetime import datetime
from unittest.mock import MagicMock

class TestSessionsAPI:
    """Test cases for Sessions API endpoints"""
    
    def test_create_session_success(self, client, test_user, auth_headers, db_session):
        """Test creating a new session successfully"""
        session_data = {
            "session_name": "Test Session",
            "first_message_time": "2024-01-01T10:00:00"
        }
        
        response = client.post("/api/v1/chat/sessions", json=session_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "session_id" in data
        assert data["message"] == "Session created successfully"
    
    def test_create_session_unauthorized(self, client):
        """Test creating session without authentication"""
        session_data = {
            "session_name": "Test Session",
            "first_message_time": "2024-01-01T10:00:00"
        }
        
        response = client.post("/api/v1/chat/sessions", json=session_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_session_invalid_data(self, client, test_user, auth_headers):
        """Test creating session with invalid data"""
        session_data = {
            "session_name": "",  # Empty name
            "first_message_time": "invalid-date"
        }
        
        response = client.post("/api/v1/chat/sessions", json=session_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_create_session_database_error(self, client, test_user, auth_headers):
        """Test creating session with database error"""
        from backend.main import app
        from backend.db.database import get_db
        
        # Mock database error
        mock_db = MagicMock()
        mock_db.execute.side_effect = Exception("Database connection failed")
        mock_db.commit.return_value = None
        mock_db.rollback.return_value = None
        
        # Override the dependency to use mock database
        def override_get_db():
            yield mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        session_data = {
            "session_name": "Test Session",
            "first_message_time": "2024-01-01T10:00:00"
        }
        
        try:
            response = client.post("/api/v1/chat/sessions", json=session_data, headers=auth_headers)

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert "Failed to create session" in data["detail"]
        finally:
            # Clean up the override
            if get_db in app.dependency_overrides:
                del app.dependency_overrides[get_db]
    
    def test_get_user_sessions_success(self, client, test_user, auth_headers, db_session):
        """Test getting user sessions successfully"""
        # Create test sessions in database
        from sqlalchemy import text
        now = datetime.utcnow()
        db_session.execute(
            text("INSERT INTO chat_sessions (user_id, session_name, first_message_time, is_active, created_at, updated_at) VALUES (:user_id, :name1, :time1, 1, :created1, :updated1)"),
            {"user_id": test_user.id, "name1": "Session 1", "time1": datetime(2024, 1, 1, 10, 0), "created1": now, "updated1": now}
        )
        db_session.execute(
            text("INSERT INTO chat_sessions (user_id, session_name, first_message_time, is_active, created_at, updated_at) VALUES (:user_id, :name2, :time2, 0, :created2, :updated2)"),
            {"user_id": test_user.id, "name2": "Session 2", "time2": datetime(2024, 1, 2, 11, 0), "created2": now, "updated2": now}
        )
        db_session.commit()
        
        response = client.get("/api/v1/chat/sessions", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        # Since both sessions have the same created_at time, order may vary
        # Check that both sessions are present
        session_names = [session["session_name"] for session in data]
        assert "Session 1" in session_names
        assert "Session 2" in session_names
        
        # Find each session and verify their properties
        session1 = next(s for s in data if s["session_name"] == "Session 1")
        session2 = next(s for s in data if s["session_name"] == "Session 2")
        
        assert session1["is_active"] is True
        assert session1["message_count"] == 0
        assert session2["is_active"] is False
        assert session2["message_count"] == 0
    
    def test_get_user_sessions_empty(self, client, test_user, auth_headers, db_session):
        """Test getting user sessions when user has no sessions"""
        # No sessions created, so result should be empty
        
        response = client.get("/api/v1/chat/sessions", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == []
    
    def test_get_user_sessions_unauthorized(self, client):
        """Test getting user sessions without authentication"""
        response = client.get("/api/v1/chat/sessions")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_user_sessions_database_error(self, client, test_user, auth_headers):
        """Test getting user sessions with database error"""
        from backend.main import app
        from backend.db.database import get_db
        
        mock_db = MagicMock()
        mock_db.execute.side_effect = Exception("Database error")
        mock_db.commit.return_value = None
        mock_db.rollback.return_value = None
        
        # Override the dependency to use mock database
        def override_get_db():
            yield mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.get("/api/v1/chat/sessions", headers=auth_headers)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert "Failed to get sessions" in data["detail"]
        finally:
            # Clean up the override
            if get_db in app.dependency_overrides:
                del app.dependency_overrides[get_db]
    
    def test_get_session_messages_success(self, client, test_user, auth_headers, db_session):
        """Test getting session messages successfully"""
        # Create test session and messages
        from sqlalchemy import text
        now = datetime.utcnow()
        session_result = db_session.execute(
            text("INSERT INTO chat_sessions (user_id, session_name, first_message_time, is_active, created_at, updated_at) VALUES (:user_id, :name, :time, 1, :created, :updated)"),
            {"user_id": test_user.id, "name": "Test Session", "time": datetime(2024, 1, 1, 10, 0), "created": now, "updated": now}
        )
        session_id = session_result.lastrowid
        
        db_session.execute(
            text("INSERT INTO chat_messages (session_id, user_id, message_text, sender, created_at, updated_at) VALUES (:session_id, :user_id, :text1, :sender1, :time1, :time1)"),
            {"session_id": session_id, "user_id": test_user.id, "text1": "Hello", "sender1": "user", "time1": datetime(2024, 1, 1, 10, 0)}
        )
        db_session.execute(
            text("INSERT INTO chat_messages (session_id, user_id, message_text, sender, created_at, updated_at) VALUES (:session_id, :user_id, :text2, :sender2, :time2, :time2)"),
            {"session_id": session_id, "user_id": test_user.id, "text2": "Hi there!", "sender2": "assistant", "time2": datetime(2024, 1, 1, 10, 1)}
        )
        db_session.commit()
        
        response = client.get(f"/api/v1/chat/sessions/{session_id}/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["session_id"] == session_id
        assert len(data["messages"]) == 2
        assert data["messages"][0]["id"] == 1
        assert data["messages"][0]["message_text"] == "Hello"
        assert data["messages"][0]["sender"] == "user"
        assert data["messages"][1]["id"] == 2
        assert data["messages"][1]["message_text"] == "Hi there!"
        assert data["messages"][1]["sender"] == "assistant"
    
    def test_get_session_messages_session_not_found(self, client, test_user, auth_headers, db_session):
        """Test getting messages for non-existent session"""
        # Use non-existent session ID
        
        response = client.get("/api/v1/chat/sessions/999/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["detail"] == "Session not found"
    
    def test_get_session_messages_empty(self, client, test_user, auth_headers, db_session):
        """Test getting messages for session with no messages"""
        # Create test session without messages
        from sqlalchemy import text
        now = datetime.utcnow()
        session_result = db_session.execute(
            text("INSERT INTO chat_sessions (user_id, session_name, first_message_time, is_active, created_at, updated_at) VALUES (:user_id, :name, :time, 1, :created, :updated)"),
            {"user_id": test_user.id, "name": "Empty Session", "time": datetime(2024, 1, 1, 10, 0), "created": now, "updated": now}
        )
        session_id = session_result.lastrowid
        db_session.commit()
        
        response = client.get(f"/api/v1/chat/sessions/{session_id}/messages", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["session_id"] == session_id
        assert data["messages"] == []
    
    def test_get_session_messages_unauthorized(self, client):
        """Test getting session messages without authentication"""
        response = client.get("/api/v1/chat/sessions/1/messages")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_activate_session_success(self, client, test_user, auth_headers, db_session):
        """Test activating session successfully"""
        # Create test session
        from sqlalchemy import text
        now = datetime.utcnow()
        session_result = db_session.execute(
            text("INSERT INTO chat_sessions (user_id, session_name, first_message_time, is_active, created_at, updated_at) VALUES (:user_id, :name, :time, 0, :created, :updated)"),
            {"user_id": test_user.id, "name": "Test Session", "time": datetime(2024, 1, 1, 10, 0), "created": now, "updated": now}
        )
        session_id = session_result.lastrowid
        db_session.commit()
        
        response = client.put(f"/api/v1/chat/sessions/{session_id}/activate", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Session activated successfully"
    
    def test_activate_session_not_found(self, client, test_user, auth_headers, db_session):
        """Test activating non-existent session"""
        # Use non-existent session ID
        
        response = client.put("/api/v1/chat/sessions/999/activate", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["detail"] == "Session not found"
    
    def test_activate_session_unauthorized(self, client):
        """Test activating session without authentication"""
        response = client.put("/api/v1/chat/sessions/1/activate")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_activate_session_database_error(self, client, test_user, auth_headers):
        """Test activating session with database error"""
        from backend.main import app
        from backend.db.database import get_db
        
        mock_db = MagicMock()
        mock_db.execute.side_effect = Exception("Database error")
        mock_db.commit.return_value = None
        mock_db.rollback.return_value = None
        
        # Override the dependency to use mock database
        def override_get_db():
            yield mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.put("/api/v1/chat/sessions/1/activate", headers=auth_headers)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert "Failed to activate session" in data["detail"]
        finally:
            # Clean up the override
            if get_db in app.dependency_overrides:
                del app.dependency_overrides[get_db]
    
    def test_get_active_session_success(self, client, test_user, auth_headers, db_session):
        """Test getting active session successfully"""
        # Create active session
        from sqlalchemy import text
        now = datetime.utcnow()
        session_result = db_session.execute(
            text("INSERT INTO chat_sessions (user_id, session_name, first_message_time, is_active, created_at, updated_at) VALUES (:user_id, :name, :time, 1, :created, :updated)"),
            {"user_id": test_user.id, "name": "Active Session", "time": datetime(2024, 1, 1, 10, 0), "created": now, "updated": now}
        )
        db_session.commit()
        
        response = client.get("/api/v1/chat/sessions/active", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "id" in data
        assert data["session_name"] == "Active Session"
    
    def test_get_active_session_none(self, client, test_user, auth_headers, db_session):
        """Test getting active session when none exists"""
        # No active sessions created
        
        response = client.get("/api/v1/chat/sessions/active", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data is None
    
    def test_get_active_session_unauthorized(self, client):
        """Test getting active session without authentication"""
        response = client.get("/api/v1/chat/sessions/active")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_active_session_database_error(self, client, test_user, auth_headers):
        """Test getting active session with database error"""
        from backend.main import app
        from backend.db.database import get_db
        
        mock_db = MagicMock()
        mock_db.execute.side_effect = Exception("Database error")
        mock_db.commit.return_value = None
        mock_db.rollback.return_value = None
        
        # Override the dependency to use mock database
        def override_get_db():
            yield mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.get("/api/v1/chat/sessions/active", headers=auth_headers)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert "Failed to get active session" in data["detail"]
        finally:
            # Clean up the override
            if get_db in app.dependency_overrides:
                del app.dependency_overrides[get_db]
    
    def test_delete_session_success(self, client, test_user, auth_headers, db_session):
        """Test deleting session successfully"""
        # Create test session
        from sqlalchemy import text
        now = datetime.utcnow()
        session_result = db_session.execute(
            text("INSERT INTO chat_sessions (user_id, session_name, first_message_time, is_active, created_at, updated_at) VALUES (:user_id, :name, :time, 1, :created, :updated)"),
            {"user_id": test_user.id, "name": "Test Session", "time": datetime(2024, 1, 1, 10, 0), "created": now, "updated": now}
        )
        session_id = session_result.lastrowid
        db_session.commit()
        
        response = client.delete(f"/api/v1/chat/sessions/{session_id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Session deleted successfully"
    
    def test_delete_session_not_found(self, client, test_user, auth_headers, db_session):
        """Test deleting non-existent session"""
        # Use non-existent session ID
        
        response = client.delete("/api/v1/chat/sessions/999", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["detail"] == "Session not found"
    
    def test_delete_session_unauthorized(self, client):
        """Test deleting session without authentication"""
        response = client.delete("/api/v1/chat/sessions/1")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_delete_session_database_error(self, client, test_user, auth_headers):
        """Test deleting session with database error"""
        from backend.main import app
        from backend.db.database import get_db
        
        mock_db = MagicMock()
        mock_db.execute.side_effect = Exception("Database error")
        mock_db.commit.return_value = None
        mock_db.rollback.return_value = None
        
        # Override the dependency to use mock database
        def override_get_db():
            yield mock_db
        
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            response = client.delete("/api/v1/chat/sessions/1", headers=auth_headers)
            
            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            data = response.json()
            assert "Failed to delete session" in data["detail"]
        finally:
            # Clean up the override
            if get_db in app.dependency_overrides:
                del app.dependency_overrides[get_db]
    
    def test_create_session_missing_fields(self, client, test_user, auth_headers):
        """Test creating session with missing required fields"""
        session_data = {
            "session_name": "Test Session"
            # Missing first_message_time
        }
        
        response = client.post("/api/v1/chat/sessions", json=session_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_session_name_validation(self, client, test_user, auth_headers):
        """Test session name validation"""
        session_data = {
            "session_name": "A" * 1000,  # Very long name
            "first_message_time": "2024-01-01T10:00:00"
        }
        
        # This should still work as there's no explicit length validation in the API
        # But in a real scenario, you might want to add validation
        response = client.post("/api/v1/chat/sessions", json=session_data, headers=auth_headers)
        
        # The response depends on your validation rules
        # For now, assuming it works without validation
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_422_UNPROCESSABLE_ENTITY]