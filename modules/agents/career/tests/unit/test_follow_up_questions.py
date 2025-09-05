"""Unit tests for ChatService follow-up questions functionality."""

import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any, List, Optional

# Import the ChatService class
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from chat_service import ChatService

class TestGenerateFollowUpQuestions:
    """Test cases for the generate_follow_up_questions method."""
    
    @pytest.mark.asyncio
    async def test_generate_follow_up_questions_success(self):
        """Test successful generation of follow-up questions."""
        # Arrange
        user_message = "How can I improve my resume for tech jobs?"
        ai_response = "To improve your resume for tech jobs, focus on highlighting relevant technical skills, quantifying achievements, and tailoring your experience to match job descriptions."
        session_id = "test_session_456"
        
        expected_questions = [
            "Which technical skills should I prioritize on my resume?",
            "How can I effectively quantify my achievements?",
            "What's the best format for a tech resume?"
        ]
        
        # Create a real ChatService instance with mocked methods
        with patch('chat_service.ChatService._generate_follow_up_sync') as mock_generate_sync:
            # Mock the synchronous generation method
            mock_generate_sync.return_value = """
            1. Which technical skills should I prioritize on my resume?
            2. How can I effectively quantify my achievements?
            3. What's the best format for a tech resume?
            """
            
            # Create service instance
            service = ChatService()
            
            # Act
            questions = await service.generate_follow_up_questions(
                user_message=user_message,
                ai_response=ai_response,
                session_id=session_id
            )
            
            # Assert
            assert questions == expected_questions
            mock_generate_sync.assert_called_once()
            # Verify the prompt formatting
            call_args = mock_generate_sync.call_args[0]
            assert user_message in call_args[0]
            assert ai_response in call_args[0]
    
    @pytest.mark.asyncio
    async def test_generate_follow_up_questions_with_profile(self):
        """Test follow-up questions generation with user profile data."""
        # Arrange
        user_message = "How can I transition to a management role?"
        ai_response = "To transition to a management role, focus on developing leadership skills, taking on team projects, and communicating your interest to your supervisor."
        session_id = "test_session_789"
        profile_data = {
            "current_role": "Senior Developer",
            "experience_years": 5,
            "industry": "Software"
        }
        
        # Create a real ChatService instance with mocked methods
        with patch('chat_service.ChatService._generate_follow_up_sync') as mock_generate_sync, \
             patch('chat_service.ChatService._format_profile_for_context') as mock_format_profile:
            
            # Mock the synchronous generation method
            mock_generate_sync.return_value = """
            1. What leadership skills are most important for a technical manager?
            2. How can I demonstrate management potential in my current role?
            3. What timeline should I expect for this transition?
            """
            
            # Mock profile formatting
            mock_format_profile.return_value = "Senior Developer with 5 years of experience in Software industry"
            
            # Create service instance
            service = ChatService()
            
            # Act
            questions = await service.generate_follow_up_questions(
                user_message=user_message,
                ai_response=ai_response,
                session_id=session_id,
                profile_data=profile_data
            )
            
            # Assert
            assert len(questions) == 3
            assert "leadership skills" in questions[0].lower()
            assert "current role" in questions[1].lower()
            assert "timeline" in questions[2].lower()
            mock_format_profile.assert_called_once_with(profile_data)
    
    @pytest.mark.asyncio
    async def test_generate_follow_up_questions_with_cancellation(self):
        """Test follow-up questions generation with cancellation event."""
        # Arrange
        user_message = "What skills should I learn for data science?"
        ai_response = "For data science, focus on Python, statistics, machine learning, and data visualization."
        session_id = "test_session_cancel"
        cancellation_event = asyncio.Event()
        cancellation_event.set()  # Set the event to trigger cancellation
        
        # Create service instance
        service = ChatService()
        
        # Act
        questions = await service.generate_follow_up_questions(
            user_message=user_message,
            ai_response=ai_response,
            session_id=session_id,
            cancellation_event=cancellation_event
        )
        
        # Assert
        assert questions == []  # Should return empty list when cancelled
    
    @pytest.mark.asyncio
    async def test_generate_follow_up_questions_exception_handling(self):
        """Test exception handling in follow-up questions generation."""
        # Arrange
        user_message = "Career advice for software engineers"
        ai_response = "Focus on continuous learning and building a portfolio."
        session_id = "test_session_error"
        
        # Create a real ChatService instance with mocked methods that raise an exception
        with patch('chat_service.ChatService._generate_follow_up_sync') as mock_generate_sync:
            # Mock the synchronous generation method to raise an exception
            mock_generate_sync.side_effect = Exception("Test exception")
            
            # Create service instance
            service = ChatService()
            
            # Act
            questions = await service.generate_follow_up_questions(
                user_message=user_message,
                ai_response=ai_response,
                session_id=session_id
            )
            
            # Assert
            assert len(questions) == 3  # Should return default questions
            assert all(isinstance(q, str) for q in questions)
            assert "career advice" in questions[0].lower() or "details" in questions[0].lower()
    
    def test_parse_follow_up_questions(self):
        """Test the parsing of follow-up questions from raw text."""
        # Arrange
        service = ChatService()
        
        # Test case 1: Well-formatted numbered questions
        raw_text_1 = """
        1. What programming languages should I learn?
        2. How important is a computer science degree?
        3. What projects should I include in my portfolio?
        """
        
        # Test case 2: Questions with different numbering format
        raw_text_2 = """
        1) What are the best resources for learning Python?
        2) How can I prepare for technical interviews?
        3) Should I focus on frontend or backend development?
        """
        
        # Test case 3: Poorly formatted text with questions
        raw_text_3 = """
        Here are some questions:
        - What certifications are valuable in tech?
        - How do I network effectively in the industry?
        * Is it worth contributing to open source projects?
        """
        
        # Test case 4: Text with more than 3 questions
        raw_text_4 = """
        1. Question one about career?
        2. Question two about skills?
        3. Question three about education?
        4. Extra question that should be ignored?
        5. Another extra question?
        """
        
        # Act
        result_1 = service._parse_follow_up_questions(raw_text_1)
        result_2 = service._parse_follow_up_questions(raw_text_2)
        result_3 = service._parse_follow_up_questions(raw_text_3)
        result_4 = service._parse_follow_up_questions(raw_text_4)
        
        # Assert
        assert len(result_1) == 3
        assert "programming languages" in result_1[0]
        
        assert len(result_2) == 3
        assert "Python" in result_2[0]
        
        assert len(result_3) == 3
        assert "certifications" in result_3[0]
        
        assert len(result_4) == 3
        assert "extra question" not in result_4[2]  # Should only include first 3 questions