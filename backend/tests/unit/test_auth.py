import pytest
import io
import os
from unittest.mock import patch, mock_open, AsyncMock
from fastapi import status
from datetime import datetime

from models.user import User
from models.resume import Resume
from utils.auth import get_password_hash

class TestAuthAPI:
    """Test cases for Authentication API endpoints"""
    
    def test_signup_success(self, client, db_session):
        """Test successful user registration"""
        user_data = {
            "username": "newuser",
            "email": "newuser@example.com",
            "password": "securepassword123"
        }
        
        response = client.post("/api/v1/auth/signup", json=user_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert data["is_active"] is True
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data
        # Password should not be returned
        assert "password" not in data
        assert "hashed_password" not in data
    
    def test_signup_duplicate_email(self, client, test_user):
        """Test registration with duplicate email"""
        user_data = {
            "username": "differentuser",
            "email": "test@example.com",  # Same as test_user
            "password": "securepassword123"
        }
        
        response = client.post("/api/v1/auth/signup", json=user_data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "Email already registered"
    
    def test_signup_duplicate_username(self, client, test_user):
        """Test registration with duplicate username"""
        user_data = {
            "username": "testuser",  # Same as test_user
            "email": "different@example.com",
            "password": "securepassword123"
        }
        
        response = client.post("/api/v1/auth/signup", json=user_data)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "Username already taken"
    
    def test_signup_invalid_email(self, client):
        """Test registration with invalid email format"""
        user_data = {
            "username": "newuser",
            "email": "invalid-email",
            "password": "securepassword123"
        }
        
        response = client.post("/api/v1/auth/signup", json=user_data)
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    def test_login_success(self, client, test_user):
        """Test successful login"""
        login_data = {
            "username": "test@example.com",  # OAuth2PasswordRequestForm uses username field for email
            "password": "testpassword123"
        }
        
        response = client.post("/api/v1/auth/token", data=login_data)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert isinstance(data["access_token"], str)
        assert len(data["access_token"]) > 0
    
    def test_login_invalid_email(self, client):
        """Test login with invalid email"""
        login_data = {
            "username": "nonexistent@example.com",
            "password": "anypassword"
        }
        
        response = client.post("/api/v1/auth/token", data=login_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert data["detail"] == "Incorrect email or password"
    
    def test_login_invalid_password(self, client, test_user):
        """Test login with invalid password"""
        login_data = {
            "username": "test@example.com",
            "password": "wrongpassword"
        }
        
        response = client.post("/api/v1/auth/token", data=login_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        data = response.json()
        assert data["detail"] == "Incorrect email or password"
    
    @patch('backend.api.auth.aiofiles.open')
    @patch('backend.api.auth.os.makedirs')
    def test_upload_resume_pdf_success(self, mock_makedirs, mock_aiofiles_open, 
                                     client, test_user, auth_headers):
        """Test successful PDF resume upload"""
        # Mock file operations
        mock_file = mock_aiofiles_open.return_value.__aenter__.return_value
        mock_file.write = AsyncMock()
        
        files = {"file": ("resume.pdf", io.BytesIO(b"fake pdf content"), "application/pdf")}
        
        response = client.post("/api/v1/auth/upload-resume", files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "filename" in data
        assert data["filename"].endswith(".pdf")
        assert data["message"] == "Resume uploaded successfully"
        mock_makedirs.assert_called_once()
    
    @patch('backend.api.auth.aiofiles.open')
    @patch('backend.api.auth.os.makedirs')
    def test_upload_resume_txt_success(self, mock_makedirs, mock_aiofiles_open,
                                     client, test_user, auth_headers):
        """Test successful TXT resume upload"""
        # Mock file operations
        mock_file = mock_aiofiles_open.return_value.__aenter__.return_value
        mock_file.write = AsyncMock()
        
        files = {"file": ("resume.txt", io.BytesIO(b"fake txt content"), "text/plain")}
        
        response = client.post("/api/v1/auth/upload-resume", files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "filename" in data
        assert data["filename"].endswith(".txt")
        assert data["message"] == "Resume uploaded successfully"
    
    def test_upload_resume_invalid_format(self, client, test_user, auth_headers):
        """Test uploading resume with invalid file format"""
        files = {"file": ("resume.docx", io.BytesIO(b"fake docx content"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        
        response = client.post("/api/v1/auth/upload-resume", files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "Only PDF and TXT files are allowed"
    
    def test_upload_resume_unauthorized(self, client):
        """Test uploading resume without authentication"""
        files = {"file": ("resume.pdf", io.BytesIO(b"fake pdf content"), "application/pdf")}
        
        response = client.post("/api/v1/auth/upload-resume", files=files)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_user_resumes_success(self, client, test_user, auth_headers, db_session):
        """Test getting user resumes successfully"""
        # Get user ID before any operations
        user_id = test_user.id
        
        # Create test resumes
        resume1 = Resume(
            filename="resume1.pdf",
            original_filename="my_resume.pdf",
            file_path="/path/to/resume1.pdf",
            file_type="pdf",
            user_id=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        resume2 = Resume(
            filename="resume2.txt",
            original_filename="my_resume.txt",
            file_path="/path/to/resume2.txt",
            file_type="txt",
            user_id=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(resume1)
        db_session.add(resume2)
        db_session.commit()
        
        response = client.get("/api/v1/auth/resumes", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        assert data[0]["filename"] in ["resume1.pdf", "resume2.txt"]
        assert data[1]["filename"] in ["resume1.pdf", "resume2.txt"]
        assert data[0]["user_id"] == user_id
        assert data[1]["user_id"] == user_id
    
    def test_get_user_resumes_empty(self, client, test_user, auth_headers):
        """Test getting user resumes when user has no resumes"""
        response = client.get("/api/v1/auth/resumes", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data == []
    
    def test_get_user_resumes_unauthorized(self, client):
        """Test getting user resumes without authentication"""
        response = client.get("/api/v1/auth/resumes")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @patch('backend.api.auth.os.remove')
    def test_delete_resume_success(self, mock_remove, client, test_user, auth_headers, db_session):
        """Test successful resume deletion"""
        # Create test resume
        resume = Resume(
            filename="resume_to_delete.pdf",
            original_filename="my_resume.pdf",
            file_path="/path/to/resume_to_delete.pdf",
            file_type="pdf",
            user_id=test_user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(resume)
        db_session.commit()
        db_session.refresh(resume)
        
        response = client.delete(f"/api/v1/auth/resumes/{resume.id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Resume deleted successfully"
        mock_remove.assert_called_once_with("/path/to/resume_to_delete.pdf")
        
        # Verify resume is deleted from database
        deleted_resume = db_session.query(Resume).filter(Resume.id == resume.id).first()
        assert deleted_resume is None
    
    def test_delete_resume_not_found(self, client, test_user, auth_headers):
        """Test deleting non-existent resume"""
        response = client.delete("/api/v1/auth/resumes/999", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["detail"] == "Resume not found"
    
    def test_delete_resume_not_owner(self, client, test_user, auth_headers, db_session):
        """Test deleting resume that belongs to another user"""
        # Create another user
        other_user = User(
            username="otheruser",
            email="other@example.com",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(other_user)
        db_session.commit()
        db_session.refresh(other_user)
        
        # Create resume for other user
        resume = Resume(
            filename="other_resume.pdf",
            original_filename="other_resume.pdf",
            file_path="/path/to/other_resume.pdf",
            file_type="pdf",
            user_id=other_user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(resume)
        db_session.commit()
        db_session.refresh(resume)
        
        response = client.delete(f"/api/v1/auth/resumes/{resume.id}", headers=auth_headers)
        
        assert response.status_code == status.HTTP_404_NOT_FOUND
        data = response.json()
        assert data["detail"] == "Resume not found"
    
    def test_delete_resume_unauthorized(self, client):
        """Test deleting resume without authentication"""
        response = client.delete("/api/v1/auth/resumes/1")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @patch('backend.api.auth.os.remove')
    def test_delete_resume_file_not_exists(self, mock_remove, client, test_user, auth_headers, db_session):
        """Test deleting resume when file doesn't exist on disk"""
        # Mock os.remove to raise OSError (file not found)
        mock_remove.side_effect = OSError("File not found")
        
        # Create test resume
        resume = Resume(
            filename="missing_file.pdf",
            original_filename="missing_file.pdf",
            file_path="/path/to/missing_file.pdf",
            file_type="pdf",
            user_id=test_user.id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db_session.add(resume)
        db_session.commit()
        db_session.refresh(resume)
        
        response = client.delete(f"/api/v1/auth/resumes/{resume.id}", headers=auth_headers)
        
        # Should still succeed even if file doesn't exist
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Resume deleted successfully"
        
        # Verify resume is deleted from database
        deleted_resume = db_session.query(Resume).filter(Resume.id == resume.id).first()
        assert deleted_resume is None