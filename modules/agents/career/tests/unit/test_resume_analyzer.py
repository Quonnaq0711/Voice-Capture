"""Unit tests for ResumeAnalyzer class."""

import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any, List, Optional

# Import the ResumeAnalyzer class
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from resume_analyzer import ResumeAnalyzer

class TestResumeAnalyzerInitialization:
    """Test cases for ResumeAnalyzer initialization."""
    
    def test_resume_analyzer_init_default(self):
        """Test ResumeAnalyzer initialization with default parameters."""
        # Act
        analyzer = ResumeAnalyzer()
        
        # Assert
        assert analyzer is not None
        assert hasattr(analyzer, 'chat_service')
    
    def test_resume_analyzer_init_with_params(self, mock_chat_service):
        """Test ResumeAnalyzer initialization with custom parameters."""
        # Arrange & Act
        analyzer = ResumeAnalyzer(
            chat_service=mock_chat_service
        )
        
        # Assert
        assert analyzer.chat_service == mock_chat_service

class TestAnalyzeResume:
    """Test cases for the analyze_resume method."""
    
    @pytest.mark.asyncio
    async def test_analyze_resume_success(self, mock_resume_analyzer, sample_resume_data):
        """Test successful resume analysis."""
        # Arrange
        user_id = 123
        expected_insights = {
            "professionalIdentity": {
                "title": "Senior Software Engineer",
                "summary": "Experienced developer with 5+ years in full-stack development",
                "keyStrengths": ["Python", "JavaScript", "React", "Node.js"]
            },
            "skillsAssessment": {
                "technicalSkills": ["Python", "JavaScript", "React", "Node.js", "SQL"],
                "softSkills": ["Leadership", "Communication", "Problem Solving"],
                "skillGaps": ["Machine Learning", "Cloud Architecture"]
            },
            "careerProgression": {
                "currentLevel": "Senior",
                "nextSteps": ["Tech Lead", "Engineering Manager"],
                "timeline": "1-2 years"
            }
        }
        
        mock_resume_analyzer.analyze_resume = AsyncMock(return_value=expected_insights)
        
        # Act
        insights = await mock_resume_analyzer.analyze_resume(user_id, sample_resume_data)
        
        # Assert
        assert insights == expected_insights
        mock_resume_analyzer.analyze_resume.assert_called_once_with(user_id, sample_resume_data)
    
    @pytest.mark.asyncio
    async def test_analyze_resume_with_professional_data(self, mock_resume_analyzer, sample_professional_data):
        """Test resume analysis with additional professional data."""
        # Arrange
        user_id = 123
        resume_data = {
            "personalInfo": {
                "name": "John Doe",
                "email": "john.doe@example.com",
                "phone": "+1-555-0123"
            },
            "experience": [
                {
                    "company": "Tech Corp",
                    "position": "Senior Developer",
                    "duration": "2020-2024",
                    "responsibilities": ["Led development team", "Architected solutions"]
                }
            ]
        }
        
        expected_insights = {
            "professionalIdentity": {
                "title": "Senior Software Engineer",
                "summary": "Experienced leader with strong technical background"
            },
            "marketAnalysis": {
                "demandLevel": "High",
                "salaryRange": "$120,000 - $180,000",
                "growthProjection": "15% over next 5 years"
            }
        }
        
        mock_resume_analyzer.analyze_resume = AsyncMock(return_value=expected_insights)
        
        # Act
        insights = await mock_resume_analyzer.analyze_resume(
            user_id, 
            resume_data, 
            professional_data=sample_professional_data
        )
        
        # Assert
        assert insights == expected_insights
        mock_resume_analyzer.analyze_resume.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_analyze_resume_empty_data(self, mock_resume_analyzer):
        """Test resume analysis with empty data."""
        # Arrange
        user_id = 123
        empty_resume_data = {}
        
        mock_resume_analyzer.analyze_resume = AsyncMock(side_effect=ValueError("Resume data cannot be empty"))
        
        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            await mock_resume_analyzer.analyze_resume(user_id, empty_resume_data)
        
        assert "Resume data cannot be empty" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_analyze_resume_invalid_user_id(self, mock_resume_analyzer, sample_resume_data):
        """Test resume analysis with invalid user ID."""
        # Arrange
        invalid_user_id = None
        
        mock_resume_analyzer.analyze_resume = AsyncMock(side_effect=ValueError("User ID is required"))
        
        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            await mock_resume_analyzer.analyze_resume(invalid_user_id, sample_resume_data)
        
        assert "User ID is required" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_analyze_resume_llm_error(self, mock_resume_analyzer, sample_resume_data):
        """Test handling of LLM errors during analysis."""
        # Arrange
        user_id = 123
        
        mock_resume_analyzer.analyze_resume = AsyncMock(side_effect=Exception("LLM service unavailable"))
        
        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            await mock_resume_analyzer.analyze_resume(user_id, sample_resume_data)
        
        assert "LLM service unavailable" in str(exc_info.value)

class TestAnalyzeProfessionalIdentity:
    """Test cases for professional identity analysis."""
    
    @pytest.mark.asyncio
    async def test_analyze_professional_identity_success(self, mock_resume_analyzer):
        """Test successful professional identity analysis."""
        # Arrange
        resume_data = {
            "personalInfo": {"name": "Jane Smith"},
            "experience": [
                {
                    "company": "Innovation Labs",
                    "position": "Data Scientist",
                    "duration": "2021-2024",
                    "responsibilities": ["ML model development", "Data analysis"]
                }
            ],
            "skills": ["Python", "Machine Learning", "Statistics", "SQL"]
        }
        
        expected_identity = {
            "title": "Data Scientist",
            "summary": "Experienced data scientist with expertise in ML and analytics",
            "keyStrengths": ["Machine Learning", "Python", "Statistical Analysis"],
            "professionalBrand": "Data-driven problem solver with strong technical skills"
        }
        
        mock_resume_analyzer._analyze_professional_identity = AsyncMock(return_value=expected_identity)
        
        # Act
        identity = await mock_resume_analyzer._analyze_professional_identity(resume_data)
        
        # Assert
        assert identity == expected_identity
        mock_resume_analyzer._analyze_professional_identity.assert_called_once_with(resume_data)
    
    @pytest.mark.asyncio
    async def test_analyze_professional_identity_minimal_data(self, mock_resume_analyzer):
        """Test professional identity analysis with minimal data."""
        # Arrange
        minimal_resume_data = {
            "personalInfo": {"name": "John Doe"},
            "skills": ["JavaScript"]
        }
        
        expected_identity = {
            "title": "Developer",
            "summary": "Emerging professional with JavaScript skills",
            "keyStrengths": ["JavaScript"],
            "professionalBrand": "Developing technical professional"
        }
        
        mock_resume_analyzer._analyze_professional_identity = AsyncMock(return_value=expected_identity)
        
        # Act
        identity = await mock_resume_analyzer._analyze_professional_identity(minimal_resume_data)
        
        # Assert
        assert identity == expected_identity

class TestAnalyzeSkills:
    """Test cases for skills analysis."""
    
    @pytest.mark.asyncio
    async def test_analyze_skills_comprehensive(self, mock_resume_analyzer):
        """Test comprehensive skills analysis."""
        # Arrange
        resume_data = {
            "skills": ["Python", "JavaScript", "React", "Node.js", "SQL", "Git"],
            "experience": [
                {
                    "position": "Full Stack Developer",
                    "responsibilities": ["Frontend development", "Backend APIs", "Database design"]
                }
            ]
        }
        
        expected_skills_analysis = {
            "technicalSkills": {
                "programming": ["Python", "JavaScript"],
                "frameworks": ["React", "Node.js"],
                "databases": ["SQL"],
                "tools": ["Git"]
            },
            "softSkills": ["Problem Solving", "Communication", "Teamwork"],
            "skillLevels": {
                "Python": "Advanced",
                "JavaScript": "Advanced",
                "React": "Intermediate",
                "Node.js": "Intermediate"
            },
            "skillGaps": ["Cloud Platforms", "DevOps", "Testing Frameworks"],
            "recommendations": [
                "Consider learning AWS or Azure",
                "Improve testing skills with Jest or Pytest"
            ]
        }
        
        mock_resume_analyzer._analyze_skills = AsyncMock(return_value=expected_skills_analysis)
        
        # Act
        skills_analysis = await mock_resume_analyzer._analyze_skills(resume_data)
        
        # Assert
        assert skills_analysis == expected_skills_analysis
        mock_resume_analyzer._analyze_skills.assert_called_once_with(resume_data)
    
    @pytest.mark.asyncio
    async def test_analyze_skills_limited_data(self, mock_resume_analyzer):
        """Test skills analysis with limited skill data."""
        # Arrange
        limited_resume_data = {
            "skills": ["HTML", "CSS"],
            "experience": []
        }
        
        expected_skills_analysis = {
            "technicalSkills": {
                "frontend": ["HTML", "CSS"]
            },
            "softSkills": [],
            "skillLevels": {
                "HTML": "Beginner",
                "CSS": "Beginner"
            },
            "skillGaps": ["JavaScript", "Framework Knowledge", "Backend Development"],
            "recommendations": [
                "Learn JavaScript fundamentals",
                "Pick up a modern framework like React or Vue"
            ]
        }
        
        mock_resume_analyzer._analyze_skills = AsyncMock(return_value=expected_skills_analysis)
        
        # Act
        skills_analysis = await mock_resume_analyzer._analyze_skills(limited_resume_data)
        
        # Assert
        assert skills_analysis == expected_skills_analysis

class TestAnalyzeCareerProgression:
    """Test cases for career progression analysis."""
    
    @pytest.mark.asyncio
    async def test_analyze_career_progression_upward_trajectory(self, mock_resume_analyzer):
        """Test career progression analysis showing upward trajectory."""
        # Arrange
        resume_data = {
            "experience": [
                {
                    "company": "StartupCorp",
                    "position": "Junior Developer",
                    "duration": "2020-2021",
                    "responsibilities": ["Bug fixes", "Feature implementation"]
                },
                {
                    "company": "TechCorp",
                    "position": "Software Engineer",
                    "duration": "2021-2023",
                    "responsibilities": ["Full-stack development", "Code reviews"]
                },
                {
                    "company": "BigTech",
                    "position": "Senior Software Engineer",
                    "duration": "2023-2024",
                    "responsibilities": ["Technical leadership", "Architecture design"]
                }
            ]
        }
        
        expected_progression = {
            "currentLevel": "Senior",
            "careerTrajectory": "Upward",
            "progressionRate": "Fast",
            "nextPossibleRoles": ["Tech Lead", "Engineering Manager", "Principal Engineer"],
            "timeToNextLevel": "1-2 years",
            "strengthsForAdvancement": ["Technical Leadership", "Architecture Skills"],
            "areasForImprovement": ["People Management", "Strategic Planning"]
        }
        
        mock_resume_analyzer._analyze_career_progression = AsyncMock(return_value=expected_progression)
        
        # Act
        progression = await mock_resume_analyzer._analyze_career_progression(resume_data)
        
        # Assert
        assert progression == expected_progression
        mock_resume_analyzer._analyze_career_progression.assert_called_once_with(resume_data)
    
    @pytest.mark.asyncio
    async def test_analyze_career_progression_early_career(self, mock_resume_analyzer):
        """Test career progression analysis for early career professional."""
        # Arrange
        early_career_data = {
            "experience": [
                {
                    "company": "FirstJob Inc",
                    "position": "Junior Developer",
                    "duration": "2023-2024",
                    "responsibilities": ["Learning", "Basic development tasks"]
                }
            ]
        }
        
        expected_progression = {
            "currentLevel": "Junior",
            "careerTrajectory": "Starting",
            "progressionRate": "Normal",
            "nextPossibleRoles": ["Software Engineer", "Developer II"],
            "timeToNextLevel": "1-2 years",
            "strengthsForAdvancement": ["Learning Agility", "Technical Foundation"],
            "areasForImprovement": ["Experience", "Advanced Technical Skills"]
        }
        
        mock_resume_analyzer._analyze_career_progression = AsyncMock(return_value=expected_progression)
        
        # Act
        progression = await mock_resume_analyzer._analyze_career_progression(early_career_data)
        
        # Assert
        assert progression == expected_progression

class TestAnalyzeMarketPosition:
    """Test cases for market position analysis."""
    
    @pytest.mark.asyncio
    async def test_analyze_market_position_high_demand_role(self, mock_resume_analyzer):
        """Test market position analysis for high-demand role."""
        # Arrange
        resume_data = {
            "experience": [
                {
                    "position": "Data Scientist",
                    "company": "AI Corp"
                }
            ],
            "skills": ["Python", "Machine Learning", "TensorFlow", "Statistics"]
        }
        
        expected_market_analysis = {
            "demandLevel": "Very High",
            "salaryRange": {
                "min": 130000,
                "max": 200000,
                "currency": "USD"
            },
            "growthProjection": "22% over next 5 years",
            "competitiveAdvantages": ["ML Expertise", "Python Proficiency"],
            "marketChallenges": ["High Competition", "Rapidly Evolving Field"],
            "recommendations": [
                "Stay updated with latest ML frameworks",
                "Develop domain expertise in specific industries"
            ]
        }
        
        mock_resume_analyzer._analyze_market_position = AsyncMock(return_value=expected_market_analysis)
        
        # Act
        market_analysis = await mock_resume_analyzer._analyze_market_position(resume_data)
        
        # Assert
        assert market_analysis == expected_market_analysis
        mock_resume_analyzer._analyze_market_position.assert_called_once_with(resume_data)
    
    @pytest.mark.asyncio
    async def test_analyze_market_position_niche_role(self, mock_resume_analyzer):
        """Test market position analysis for niche role."""
        # Arrange
        niche_resume_data = {
            "experience": [
                {
                    "position": "COBOL Developer",
                    "company": "Legacy Systems Inc"
                }
            ],
            "skills": ["COBOL", "Mainframe", "JCL"]
        }
        
        expected_market_analysis = {
            "demandLevel": "Moderate",
            "salaryRange": {
                "min": 80000,
                "max": 120000,
                "currency": "USD"
            },
            "growthProjection": "Stable but declining",
            "competitiveAdvantages": ["Specialized Knowledge", "Legacy System Expertise"],
            "marketChallenges": ["Limited Opportunities", "Technology Obsolescence"],
            "recommendations": [
                "Consider learning modern languages",
                "Leverage legacy expertise in modernization projects"
            ]
        }
        
        mock_resume_analyzer._analyze_market_position = AsyncMock(return_value=expected_market_analysis)
        
        # Act
        market_analysis = await mock_resume_analyzer._analyze_market_position(niche_resume_data)
        
        # Assert
        assert market_analysis == expected_market_analysis

class TestStoreInsights:
    """Test cases for storing analysis insights."""
    
    @pytest.mark.asyncio
    async def test_store_insights_success(self, mock_resume_analyzer, mock_db_session):
        """Test successful storage of analysis insights."""
        # Arrange
        user_id = 123
        insights = {
            "professionalIdentity": {"title": "Software Engineer"},
            "skillsAssessment": {"technicalSkills": ["Python", "JavaScript"]},
            "careerProgression": {"currentLevel": "Mid-level"}
        }
        
        mock_resume_analyzer.store_insights = AsyncMock()
        
        # Act
        await mock_resume_analyzer.store_insights(user_id, insights, mock_db_session)
        
        # Assert
        mock_resume_analyzer.store_insights.assert_called_once_with(user_id, insights, mock_db_session)
    
    @pytest.mark.asyncio
    async def test_store_insights_database_error(self, mock_resume_analyzer, mock_db_session):
        """Test handling of database errors during insights storage."""
        # Arrange
        user_id = 123
        insights = {"test": "data"}
        
        mock_resume_analyzer.store_insights = AsyncMock(side_effect=Exception("Database connection failed"))
        
        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            await mock_resume_analyzer.store_insights(user_id, insights, mock_db_session)
        
        assert "Database connection failed" in str(exc_info.value)

class TestGetStoredInsights:
    """Test cases for retrieving stored insights."""
    
    @pytest.mark.asyncio
    async def test_get_stored_insights_success(self, mock_resume_analyzer, mock_db_session):
        """Test successful retrieval of stored insights."""
        # Arrange
        user_id = 123
        expected_insights = {
            "professionalIdentity": {"title": "Senior Developer"},
            "skillsAssessment": {"technicalSkills": ["Python", "React"]},
            "timestamp": "2024-01-01T12:00:00Z"
        }
        
        mock_resume_analyzer.get_stored_insights = AsyncMock(return_value=expected_insights)
        
        # Act
        insights = await mock_resume_analyzer.get_stored_insights(user_id, mock_db_session)
        
        # Assert
        assert insights == expected_insights
        mock_resume_analyzer.get_stored_insights.assert_called_once_with(user_id, mock_db_session)
    
    @pytest.mark.asyncio
    async def test_get_stored_insights_not_found(self, mock_resume_analyzer, mock_db_session):
        """Test retrieval when no insights are stored."""
        # Arrange
        user_id = 999  # Non-existent user
        
        mock_resume_analyzer.get_stored_insights = AsyncMock(return_value=None)
        
        # Act
        insights = await mock_resume_analyzer.get_stored_insights(user_id, mock_db_session)
        
        # Assert
        assert insights is None
        mock_resume_analyzer.get_stored_insights.assert_called_once_with(user_id, mock_db_session)

class TestResumeAnalyzerIntegration:
    """Integration tests for ResumeAnalyzer functionality."""
    
    @pytest.mark.asyncio
    async def test_full_analysis_workflow(self, mock_resume_analyzer, sample_resume_data, mock_db_session):
        """Test complete analysis workflow from resume to stored insights."""
        # Arrange
        user_id = 123
        
        expected_insights = {
            "professionalIdentity": {"title": "Full Stack Developer"},
            "skillsAssessment": {"technicalSkills": ["JavaScript", "Python"]},
            "careerProgression": {"currentLevel": "Mid-level"},
            "marketAnalysis": {"demandLevel": "High"}
        }
        
        # Mock the complete workflow
        mock_resume_analyzer.analyze_resume = AsyncMock(return_value=expected_insights)
        mock_resume_analyzer.store_insights = AsyncMock()
        mock_resume_analyzer.get_stored_insights = AsyncMock(return_value=expected_insights)
        
        # Act
        # Step 1: Analyze resume
        insights = await mock_resume_analyzer.analyze_resume(user_id, sample_resume_data)
        
        # Step 2: Store insights
        await mock_resume_analyzer.store_insights(user_id, insights, mock_db_session)
        
        # Step 3: Retrieve stored insights
        stored_insights = await mock_resume_analyzer.get_stored_insights(user_id, mock_db_session)
        
        # Assert
        assert insights == expected_insights
        assert stored_insights == expected_insights
        
        mock_resume_analyzer.analyze_resume.assert_called_once_with(user_id, sample_resume_data)
        mock_resume_analyzer.store_insights.assert_called_once_with(user_id, insights, mock_db_session)
        mock_resume_analyzer.get_stored_insights.assert_called_once_with(user_id, mock_db_session)
    
    @pytest.mark.asyncio
    async def test_analysis_with_error_handling(self, mock_resume_analyzer, sample_resume_data):
        """Test analysis workflow with error handling."""
        # Arrange
        user_id = 123
        
        # Mock LLM failure followed by retry success
        mock_resume_analyzer.analyze_resume = AsyncMock(
            side_effect=[
                Exception("LLM timeout"),
                {"professionalIdentity": {"title": "Developer"}}
            ]
        )
        
        # Act & Assert
        # First call should fail
        with pytest.raises(Exception):
            await mock_resume_analyzer.analyze_resume(user_id, sample_resume_data)
        
        # Second call should succeed
        insights = await mock_resume_analyzer.analyze_resume(user_id, sample_resume_data)
        assert insights is not None
        assert "professionalIdentity" in insights
        
        assert mock_resume_analyzer.analyze_resume.call_count == 2