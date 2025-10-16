import pytest
import json
import io
from unittest.mock import patch, mock_open
from fastapi import status
from PIL import Image
from models.profile import UserProfile

class TestProfileAPI:
    """Test cases for Profile API endpoints"""
    
    def test_get_current_user_profile_success(self, client, test_user_profile, auth_headers):
        """Test getting current user profile successfully"""
        response = client.get("/api/v1/profile/me", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["first_name"] == "testuser"
        assert data["last_name"] == "tester"
        assert data["email"] == "test@example.com"
        assert "profile" in data
    
    def test_get_current_user_profile_unauthorized(self, client):
        """Test getting current user profile without authentication"""
        response = client.get("/api/v1/profile/me")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_user_profile_existing(self, client, test_user_profile, auth_headers):
        """Test getting existing user profile"""
        response = client.get("/api/v1/profile/profile", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["current_job"] == "Software Engineer"
        assert data["company"] == "Tech Corp"
        assert data["industry"] == "Technology"
        assert data["experience"] == "3-5 years"
        assert data["skills"] == ["Python", "JavaScript", "React"]
        assert data["career_goals"] == "Become a senior developer"
    
    def test_get_user_profile_create_if_not_exists(self, client, test_user, auth_headers):
        """Test getting user profile creates empty profile if doesn't exist"""
        response = client.get("/api/v1/profile/profile", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["user_id"] == test_user.id
        assert data["current_job"] is None
        assert data["company"] is None
    
    def test_get_user_profile_unauthorized(self, client):
        """Test getting user profile without authentication"""
        response = client.get("/api/v1/profile/profile")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_create_profile_new_user(self, client, test_user, auth_headers):
        """Test creating profile for new user"""
        profile_data = {
            "current_job": "Data Scientist",
            "company": "AI Corp",
            "industry": "Artificial Intelligence",
            "experience": "2-3 years",
            "skills": ["Python", "Machine Learning", "TensorFlow"],
            "career_goals": "Become an AI researcher",
            "work_life_balance_priority": "High",
            "company_size_preference": "Medium"
        }
        
        response = client.post("/api/v1/profile/profile", json=profile_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["current_job"] == "Data Scientist"
        assert data["company"] == "AI Corp"
        assert data["industry"] == "Artificial Intelligence"
        assert data["skills"] == ["Python", "Machine Learning", "TensorFlow"]
        assert data["user_id"] == test_user.id
    
    def test_update_existing_profile(self, client, test_user_profile, auth_headers):
        """Test updating existing user profile"""
        update_data = {
            "current_job": "Senior Software Engineer",
            "experience": "5-7 years",
            "skills": ["Python", "JavaScript", "React", "Node.js"],
            "career_goals": "Become a tech lead"
        }
        
        response = client.post("/api/v1/profile/profile", json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["current_job"] == "Senior Software Engineer"
        assert data["experience"] == "5-7 years"
        assert data["skills"] == ["Python", "JavaScript", "React", "Node.js"]
        assert data["career_goals"] == "Become a tech lead"
        # Company should remain unchanged
        assert data["company"] == "Tech Corp"
    
    def test_create_profile_unauthorized(self, client):
        """Test creating profile without authentication"""
        profile_data = {"current_job": "Developer"}
        
        response = client.post("/api/v1/profile/profile", json=profile_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_change_password_success(self, client, test_user, auth_headers):
        """Test changing password successfully"""
        password_data = {
            "current_password": "testpassword123",
            "new_password": "newpassword456"
        }
        
        response = client.put("/api/v1/profile/password", json=password_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Password updated successfully"
    
    def test_change_password_incorrect_current(self, client, test_user, auth_headers):
        """Test changing password with incorrect current password"""
        password_data = {
            "current_password": "wrongpassword",
            "new_password": "newpassword456"
        }
        
        response = client.put("/api/v1/profile/password", json=password_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "Current password is incorrect"
    
    def test_change_password_unauthorized(self, client):
        """Test changing password without authentication"""
        password_data = {
            "current_password": "testpassword123",
            "new_password": "newpassword456"
        }
        
        response = client.put("/api/v1/profile/password", json=password_data)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @patch('backend.api.profile.os.makedirs')
    @patch('backend.api.profile.os.path.exists')
    @patch('backend.api.profile.os.listdir')
    @patch('builtins.open', new_callable=mock_open)
    def test_upload_avatar_success(self, mock_file, mock_listdir, mock_exists, mock_makedirs, 
                                 client, test_user, auth_headers, sample_image_file):
        """Test uploading avatar successfully"""
        mock_exists.return_value = True
        mock_listdir.return_value = []
        
        # Create test image file
        image = Image.new('RGB', (100, 100), color='blue')
        img_bytes = io.BytesIO()
        image.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        files = {"file": ("test_avatar.png", img_bytes, "image/png")}
        
        with patch('backend.api.profile.Image.open') as mock_image_open:
            
            mock_image_instance = mock_image_open.return_value
            mock_image_instance.thumbnail = lambda *args, **kwargs: None
            mock_image_instance.save = lambda *args, **kwargs: None
            
            response = client.post("/api/v1/profile/avatar", files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Avatar uploaded successfully"
        assert "filename" in data
        assert "url" in data
        assert data["url"].startswith("http://localhost:8000/avatars/")
    
    def test_upload_avatar_invalid_file_type(self, client, test_user, auth_headers):
        """Test uploading non-image file as avatar"""
        files = {"file": ("test.txt", io.BytesIO(b"not an image"), "text/plain")}
        
        response = client.post("/api/v1/profile/avatar", files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "File must be an image"
    
    def test_upload_avatar_unsupported_format(self, client, test_user, auth_headers):
        """Test uploading unsupported image format"""
        files = {"file": ("test.bmp", io.BytesIO(b"fake bmp data"), "image/bmp")}
        
        response = client.post("/api/v1/profile/avatar", files=files, headers=auth_headers)
        
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert data["detail"] == "Unsupported image format. Please use JPG, PNG, or GIF"
    
    def test_upload_avatar_unauthorized(self, client):
        """Test uploading avatar without authentication"""
        files = {"file": ("test.png", io.BytesIO(b"fake image data"), "image/png")}
        
        response = client.post("/api/v1/profile/avatar", files=files)
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @patch('backend.api.profile.os.path.exists')
    @patch('backend.api.profile.os.listdir')
    @patch('backend.api.profile.os.remove')
    @patch('backend.api.profile.os.rmdir')
    def test_delete_avatar_success(self, mock_rmdir, mock_remove, mock_listdir, mock_exists,
                                 client, test_user_profile, auth_headers):
        """Test deleting avatar successfully"""
        mock_exists.return_value = True
        mock_listdir.return_value = ["avatar.png"]
        
        response = client.delete("/api/v1/profile/avatar", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Avatar deleted successfully"
        mock_remove.assert_called_once()
        mock_rmdir.assert_called_once()
    
    @patch('backend.api.profile.os.path.exists')
    def test_delete_avatar_no_existing_avatar(self, mock_exists, client, test_user, auth_headers):
        """Test deleting avatar when no avatar exists"""
        mock_exists.return_value = False
        
        response = client.delete("/api/v1/profile/avatar", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["message"] == "Avatar deleted successfully"
    
    def test_delete_avatar_unauthorized(self, client):
        """Test deleting avatar without authentication"""
        response = client.delete("/api/v1/profile/avatar")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_get_avatar_url_with_custom_avatar(self, client, test_user_profile, auth_headers, db_session):
        """Test getting avatar URL when user has custom avatar"""
        # Set custom avatar URL for the user
        profile = db_session.query(UserProfile).filter(UserProfile.user_id == test_user_profile.id).first()
        profile.avatar_url = "/avatars/123/custom_avatar.png"
        db_session.commit()
        
        response = client.get("/api/v1/profile/avatar", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["url"] == "http://localhost:8000/avatars/123/custom_avatar.png"
    
    def test_get_avatar_url_default_avatar(self, client, test_user, auth_headers):
        """Test getting avatar URL when user has no custom avatar"""
        response = client.get("/api/v1/profile/avatar", headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["url"] == "http://localhost:8000/avatars/default.png"
    
    def test_get_avatar_url_unauthorized(self, client):
        """Test getting avatar URL without authentication"""
        response = client.get("/api/v1/profile/avatar")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    def test_profile_data_validation(self, client, test_user, auth_headers):
        """Test profile data validation with various field types"""
        profile_data = {
            "current_job": "Product Manager",
            "company": "StartupXYZ",
            "industry": "E-commerce",
            "experience": "1-2 years",
            "skills": ["Product Strategy", "User Research", "Analytics"],
            "soft_skills": ["Communication", "Leadership", "Problem Solving"],
            "certifications": ["PMP", "Scrum Master"],
            "short_term_goals": "Launch a successful product",
            "career_goals": "Become a VP of Product",
            "work_life_balance_priority": "High",
            "company_size_preference": "Startup",
            "target_industries": ["Tech", "Healthcare"],
            "work_values": ["Innovation", "Impact", "Growth"],
            "professional_strengths": ["Strategic thinking", "Data analysis"],
            "learning_preferences": ["Online courses", "Mentorship"]
        }
        
        response = client.post("/api/v1/profile/profile", json=profile_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["current_job"] == "Product Manager"
        assert data["skills"] == ["Product Strategy", "User Research", "Analytics"]
        assert data["target_industries"] == ["Tech", "Healthcare"]
        assert data["work_values"] == ["Innovation", "Impact", "Growth"]
    
    def test_partial_profile_update(self, client, test_user_profile, auth_headers):
        """Test partial profile update (only updating specific fields)"""
        update_data = {
            "experience": "7-10 years",
            "career_goals": "Become a CTO"
        }
        
        response = client.post("/api/v1/profile/profile", json=update_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Updated fields
        assert data["experience"] == "7-10 years"
        assert data["career_goals"] == "Become a CTO"
        # Unchanged fields should remain the same
        assert data["current_job"] == "Software Engineer"
        assert data["company"] == "Tech Corp"
        assert data["industry"] == "Technology"
    
    def test_empty_profile_creation(self, client, test_user, auth_headers):
        """Test creating profile with minimal/empty data"""
        profile_data = {}
        
        response = client.post("/api/v1/profile/profile", json=profile_data, headers=auth_headers)
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["user_id"] == test_user.id
        assert data["current_job"] is None
        assert data["company"] is None
        assert data["skills"] is None