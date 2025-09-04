"""Unit tests for ResumeAnalysisWorkflow class."""

import pytest
import asyncio
import sys
import os
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable

# Import the workflow engine classes
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
from workflow_engine import ResumeAnalysisWorkflow, WorkflowState, AnalysisStatus

# Define workflow states for testing
class WorkflowStates:
    INITIALIZING = "initializing"
    ANALYZING_IDENTITY = "analyzing_identity"
    ANALYZING_SKILLS = "analyzing_skills"
    ANALYZING_PROGRESSION = "analyzing_progression"
    ANALYZING_MARKET = "analyzing_market"
    GENERATING_RECOMMENDATIONS = "generating_recommendations"
    COMPLETED = "completed"
class TestResumeAnalysisWorkflowInitialization:
    """Test cases for ResumeAnalysisWorkflow initialization."""
    
    def test_workflow_init_default(self, mock_chat_service):
        """Test workflow initialization with default parameters."""
        # Act
        workflow = ResumeAnalysisWorkflow(mock_chat_service)
        
        # Assert
        assert workflow is not None
        assert hasattr(workflow, 'chat_service')
        assert hasattr(workflow, 'sections')
        assert hasattr(workflow, 'workflow')
        assert workflow.chat_service == mock_chat_service
    
    def test_workflow_init_with_config(self, mock_chat_service, retry_config):
        """Test workflow initialization with custom configuration."""
        # Act
        workflow = ResumeAnalysisWorkflow(mock_chat_service, retry_config)
        
        # Assert
        assert workflow.chat_service == mock_chat_service
        assert workflow.retry_config == retry_config
        assert hasattr(workflow, 'error_handler')
        assert hasattr(workflow, 'sections')
    
    def test_workflow_nodes_initialization(self, mock_workflow):
        """Test that workflow nodes are properly initialized."""
        # Arrange
        expected_nodes = [
            "professional_identity",
            "skills_assessment", 
            "career_progression",
            "market_analysis",
            "recommendations"
        ]
        
        mock_workflow.nodes = {node: Mock() for node in expected_nodes}
        
        # Act & Assert
        for node_name in expected_nodes:
            assert node_name in mock_workflow.nodes
            assert mock_workflow.nodes[node_name] is not None

class TestWorkflowExecution:
    """Test cases for workflow execution."""
    
    @pytest.mark.asyncio
    async def test_execute_workflow_success(self, mock_workflow, sample_resume_data):
        """Test successful workflow execution."""
        # Arrange
        user_id = 123
        expected_result = {
            "professionalIdentity": {
                "title": "Senior Software Engineer",
                "summary": "Experienced developer with strong technical skills"
            },
            "skillsAssessment": {
                "technicalSkills": ["Python", "JavaScript", "React"],
                "softSkills": ["Leadership", "Communication"]
            },
            "careerProgression": {
                "currentLevel": "Senior",
                "nextSteps": ["Tech Lead", "Engineering Manager"]
            },
            "marketAnalysis": {
                "demandLevel": "High",
                "salaryRange": "$120,000 - $180,000"
            },
            "recommendations": {
                "skillDevelopment": ["Cloud Architecture", "System Design"],
                "careerMoves": ["Technical Leadership Role"]
            }
        }
        
        mock_workflow.execute = AsyncMock(return_value=expected_result)
        
        # Act
        result = await mock_workflow.execute(user_id, sample_resume_data)
        
        # Assert
        assert result == expected_result
        mock_workflow.execute.assert_called_once_with(user_id, sample_resume_data)
    
    @pytest.mark.asyncio
    async def test_execute_workflow_with_state_tracking(self, mock_workflow, sample_resume_data):
        """Test workflow execution with state tracking."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        # Mock state progression
        state_progression = [
            WorkflowStates.INITIALIZING,
            WorkflowStates.ANALYZING_IDENTITY,
            WorkflowStates.ANALYZING_SKILLS,
            WorkflowStates.ANALYZING_PROGRESSION,
            WorkflowStates.ANALYZING_MARKET,
            WorkflowStates.GENERATING_RECOMMENDATIONS,
            WorkflowStates.COMPLETED
        ]
        
        mock_workflow.get_state = Mock(side_effect=state_progression)
        mock_workflow.execute = AsyncMock(return_value={"status": "completed"})
        
        # Act
        result = await mock_workflow.execute(user_id, sample_resume_data, session_id=session_id)
        
        # Assert
        assert result is not None
        mock_workflow.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_workflow_parallel_processing(self, mock_workflow, sample_resume_data):
        """Test workflow execution with parallel processing enabled."""
        # Arrange
        user_id = 123
        
        # Configure for parallel execution
        mock_workflow.parallel_execution = True
        mock_workflow.execute = AsyncMock(return_value={
            "professionalIdentity": {"title": "Developer"},
            "skillsAssessment": {"skills": ["Python"]},
            "executionTime": 45.2,  # Should be faster with parallel processing
            "parallelSections": ["professionalIdentity", "skillsAssessment"]
        })
        
        # Act
        result = await mock_workflow.execute(user_id, sample_resume_data)
        
        # Assert
        assert result is not None
        assert "executionTime" in result
        assert "parallelSections" in result
        mock_workflow.execute.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_execute_workflow_node_failure(self, mock_workflow, sample_resume_data):
        """Test workflow execution with node failure."""
        # Arrange
        user_id = 123
        
        mock_workflow.execute = AsyncMock(side_effect=Exception("Skills analysis node failed"))
        
        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            await mock_workflow.execute(user_id, sample_resume_data)
        
        assert "Skills analysis node failed" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_execute_workflow_with_retry(self, mock_workflow, sample_resume_data):
        """Test workflow execution with retry mechanism."""
        # Arrange
        user_id = 123
        
        # Mock failure followed by success
        mock_workflow.execute = AsyncMock(
            side_effect=[
                Exception("Temporary failure"),
                {"status": "completed", "retryCount": 1}
            ]
        )
        
        # Act & Assert
        # First call should fail
        with pytest.raises(Exception):
            await mock_workflow.execute(user_id, sample_resume_data)
        
        # Second call should succeed
        result = await mock_workflow.execute(user_id, sample_resume_data)
        assert result["status"] == "completed"
        assert result["retryCount"] == 1
        
        assert mock_workflow.execute.call_count == 2

class TestWorkflowNodes:
    """Test cases for individual workflow nodes."""
    
    @pytest.mark.asyncio
    async def test_professional_identity_node(self, mock_workflow):
        """Test professional identity analysis node."""
        # Arrange
        resume_data = {
            "personalInfo": {"name": "John Doe"},
            "experience": [
                {
                    "position": "Software Engineer",
                    "company": "Tech Corp",
                    "duration": "2020-2024"
                }
            ]
        }
        
        expected_identity = {
            "title": "Software Engineer",
            "summary": "Experienced software engineer with 4 years of experience",
            "keyStrengths": ["Software Development", "Problem Solving"]
        }
        
        mock_workflow._execute_professional_identity_node = AsyncMock(return_value=expected_identity)
        
        # Act
        result = await mock_workflow._execute_professional_identity_node(resume_data)
        
        # Assert
        assert result == expected_identity
        mock_workflow._execute_professional_identity_node.assert_called_once_with(resume_data)
    
    @pytest.mark.asyncio
    async def test_skills_assessment_node(self, mock_workflow):
        """Test skills assessment analysis node."""
        # Arrange
        resume_data = {
            "skills": ["Python", "JavaScript", "React", "Node.js"],
            "experience": [
                {
                    "responsibilities": ["Full-stack development", "API design"]
                }
            ]
        }
        
        expected_skills = {
            "technicalSkills": ["Python", "JavaScript", "React", "Node.js"],
            "softSkills": ["Problem Solving", "Communication"],
            "skillLevels": {
                "Python": "Advanced",
                "JavaScript": "Advanced",
                "React": "Intermediate"
            },
            "skillGaps": ["Cloud Platforms", "DevOps"]
        }
        
        mock_workflow._execute_skills_assessment_node = AsyncMock(return_value=expected_skills)
        
        # Act
        result = await mock_workflow._execute_skills_assessment_node(resume_data)
        
        # Assert
        assert result == expected_skills
        mock_workflow._execute_skills_assessment_node.assert_called_once_with(resume_data)
    
    @pytest.mark.asyncio
    async def test_career_progression_node(self, mock_workflow):
        """Test career progression analysis node."""
        # Arrange
        resume_data = {
            "experience": [
                {
                    "position": "Junior Developer",
                    "duration": "2020-2021"
                },
                {
                    "position": "Software Engineer",
                    "duration": "2021-2024"
                }
            ]
        }
        
        expected_progression = {
            "currentLevel": "Mid-level",
            "careerTrajectory": "Upward",
            "progressionRate": "Normal",
            "nextPossibleRoles": ["Senior Software Engineer", "Tech Lead"],
            "timeToNextLevel": "1-2 years"
        }
        
        mock_workflow._execute_career_progression_node = AsyncMock(return_value=expected_progression)
        
        # Act
        result = await mock_workflow._execute_career_progression_node(resume_data)
        
        # Assert
        assert result == expected_progression
        mock_workflow._execute_career_progression_node.assert_called_once_with(resume_data)
    
    @pytest.mark.asyncio
    async def test_market_analysis_node(self, mock_workflow):
        """Test market analysis node."""
        # Arrange
        resume_data = {
            "experience": [{"position": "Data Scientist"}],
            "skills": ["Python", "Machine Learning", "Statistics"]
        }
        
        expected_market_analysis = {
            "demandLevel": "Very High",
            "salaryRange": {
                "min": 130000,
                "max": 200000,
                "currency": "USD"
            },
            "growthProjection": "22% over next 5 years",
            "competitiveAdvantages": ["ML Expertise", "Statistical Knowledge"]
        }
        
        mock_workflow._execute_market_analysis_node = AsyncMock(return_value=expected_market_analysis)
        
        # Act
        result = await mock_workflow._execute_market_analysis_node(resume_data)
        
        # Assert
        assert result == expected_market_analysis
        mock_workflow._execute_market_analysis_node.assert_called_once_with(resume_data)
    
    @pytest.mark.asyncio
    async def test_recommendations_node(self, mock_workflow):
        """Test recommendations generation node."""
        # Arrange
        analysis_results = {
            "professionalIdentity": {"title": "Software Engineer"},
            "skillsAssessment": {"skillGaps": ["Cloud Platforms", "DevOps"]},
            "careerProgression": {"nextPossibleRoles": ["Senior Engineer"]},
            "marketAnalysis": {"demandLevel": "High"}
        }
        
        expected_recommendations = {
            "skillDevelopment": [
                "Learn AWS or Azure cloud platforms",
                "Gain experience with Docker and Kubernetes",
                "Improve system design skills"
            ],
            "careerMoves": [
                "Target senior engineer positions",
                "Consider technical leadership roles",
                "Explore opportunities in high-growth companies"
            ],
            "learningPath": [
                {
                    "skill": "Cloud Platforms",
                    "priority": "High",
                    "timeframe": "3-6 months",
                    "resources": ["AWS Certification", "Hands-on Projects"]
                }
            ]
        }
        
        mock_workflow._execute_recommendations_node = AsyncMock(return_value=expected_recommendations)
        
        # Act
        result = await mock_workflow._execute_recommendations_node(analysis_results)
        
        # Assert
        assert result == expected_recommendations
        mock_workflow._execute_recommendations_node.assert_called_once_with(analysis_results)

class TestWorkflowState:
    """Test cases for workflow state management."""
    
    def test_workflow_state_transitions(self, mock_workflow):
        """Test workflow state transitions."""
        # Arrange
        expected_states = [
            WorkflowStates.INITIALIZING,
            WorkflowStates.ANALYZING_IDENTITY,
            WorkflowStates.ANALYZING_SKILLS,
            WorkflowStates.ANALYZING_PROGRESSION,
            WorkflowStates.ANALYZING_MARKET,
            WorkflowStates.GENERATING_RECOMMENDATIONS,
            WorkflowStates.COMPLETED
        ]
        
        mock_workflow.state = WorkflowStates.INITIALIZING
        mock_workflow.transition_to = Mock()
        
        # Act & Assert
        for i, state in enumerate(expected_states[1:], 1):
            mock_workflow.transition_to(state)
            mock_workflow.transition_to.assert_called_with(state)
    
    def test_workflow_state_validation(self, mock_workflow):
        """Test workflow state validation."""
        # Arrange
        valid_transitions = {
            WorkflowStates.INITIALIZING: [WorkflowStates.ANALYZING_IDENTITY],
            WorkflowStates.ANALYZING_IDENTITY: [WorkflowStates.ANALYZING_SKILLS],
            WorkflowStates.ANALYZING_SKILLS: [WorkflowStates.ANALYZING_PROGRESSION],
            WorkflowStates.ANALYZING_PROGRESSION: [WorkflowStates.ANALYZING_MARKET],
            WorkflowStates.ANALYZING_MARKET: [WorkflowStates.GENERATING_RECOMMENDATIONS],
            WorkflowStates.GENERATING_RECOMMENDATIONS: [WorkflowStates.COMPLETED]
        }
        
        mock_workflow.valid_transitions = valid_transitions
        mock_workflow.is_valid_transition = Mock(return_value=True)
        
        # Act & Assert
        for current_state, next_states in valid_transitions.items():
            for next_state in next_states:
                is_valid = mock_workflow.is_valid_transition(current_state, next_state)
                assert is_valid == True
    
    def test_workflow_state_invalid_transition(self, mock_workflow):
        """Test handling of invalid state transitions."""
        # Arrange
        mock_workflow.is_valid_transition = Mock(return_value=False)
        mock_workflow.transition_to = Mock(side_effect=ValueError("Invalid state transition"))
        
        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            mock_workflow.transition_to(WorkflowStates.COMPLETED)  # Invalid from INITIALIZING
        
        assert "Invalid state transition" in str(exc_info.value)

class TestWorkflowProgress:
    """Test cases for workflow progress tracking."""
    
    def test_workflow_progress_calculation(self, mock_workflow):
        """Test workflow progress calculation."""
        # Arrange
        total_nodes = 5
        completed_nodes = 3
        expected_progress = (completed_nodes / total_nodes) * 100  # 60%
        
        mock_workflow.get_progress = Mock(return_value=expected_progress)
        
        # Act
        progress = mock_workflow.get_progress()
        
        # Assert
        assert progress == expected_progress
        mock_workflow.get_progress.assert_called_once()
    
    def test_workflow_progress_with_weights(self, mock_workflow):
        """Test workflow progress calculation with node weights."""
        # Arrange
        node_weights = {
            "professional_identity": 0.2,
            "skills_assessment": 0.3,
            "career_progression": 0.2,
            "market_analysis": 0.2,
            "recommendations": 0.1
        }
        
        completed_nodes = ["professional_identity", "skills_assessment"]
        expected_progress = (0.2 + 0.3) * 100  # 50%
        
        mock_workflow.node_weights = node_weights
        mock_workflow.get_weighted_progress = Mock(return_value=expected_progress)
        
        # Act
        progress = mock_workflow.get_weighted_progress(completed_nodes)
        
        # Assert
        assert progress == expected_progress
        mock_workflow.get_weighted_progress.assert_called_once_with(completed_nodes)
    
    @pytest.mark.asyncio
    async def test_workflow_progress_callbacks(self, mock_workflow):
        """Test workflow progress callbacks."""
        # Arrange
        progress_callback = AsyncMock()
        mock_workflow.set_progress_callback = Mock()
        mock_workflow._notify_progress = AsyncMock()
        mock_workflow.set_progress_callback(progress_callback)
        
        # Simulate progress updates
        progress_updates = [20, 40, 60, 80, 100]
        
        # Act
        for progress in progress_updates:
            await mock_workflow._notify_progress(progress)
        
        # Assert
        assert mock_workflow._notify_progress.call_count == len(progress_updates)
        for progress in progress_updates:
            mock_workflow._notify_progress.assert_any_call(progress)

class TestWorkflowIntegration:
    """Integration tests for workflow functionality."""
    
    @pytest.mark.asyncio
    async def test_complete_workflow_integration(self, mock_workflow, sample_resume_data):
        """Test complete workflow integration from start to finish."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        expected_final_result = {
            "professionalIdentity": {"title": "Full Stack Developer"},
            "skillsAssessment": {"technicalSkills": ["JavaScript", "Python"]},
            "careerProgression": {"currentLevel": "Mid-level"},
            "marketAnalysis": {"demandLevel": "High"},
            "recommendations": {"skillDevelopment": ["Cloud Platforms"]},
            "metadata": {
                "executionTime": 120.5,
                "nodesExecuted": 5,
                "sessionId": session_id
            }
        }
        
        # Mock the complete workflow execution
        mock_workflow.execute = AsyncMock(return_value=expected_final_result)
        mock_workflow.get_state = Mock(return_value=WorkflowStates.COMPLETED)
        mock_workflow.get_progress = Mock(return_value=100.0)
        
        # Act
        result = await mock_workflow.execute(user_id, sample_resume_data, session_id=session_id)
        
        # Assert
        assert result == expected_final_result
        assert mock_workflow.get_state() == WorkflowStates.COMPLETED
        assert mock_workflow.get_progress() == 100.0
        
        mock_workflow.execute.assert_called_once_with(user_id, sample_resume_data, session_id=session_id)
    
    @pytest.mark.asyncio
    async def test_workflow_cancellation(self, mock_workflow, sample_resume_data):
        """Test workflow cancellation functionality."""
        # Arrange
        user_id = 123
        session_id = "test_session_123"
        
        # Mock cancellation during execution
        mock_workflow.cancel = AsyncMock()
        mock_workflow.is_cancelled = Mock(return_value=True)
        mock_workflow.execute = AsyncMock(side_effect=asyncio.CancelledError("Workflow cancelled"))
        
        # Act & Assert
        with pytest.raises(asyncio.CancelledError):
            await mock_workflow.execute(user_id, sample_resume_data, session_id=session_id)
        
        # Verify cancellation was handled
        assert mock_workflow.is_cancelled() == True
    
    @pytest.mark.asyncio
    async def test_workflow_error_recovery(self, mock_workflow, sample_resume_data):
        """Test workflow error recovery mechanisms."""
        # Arrange
        user_id = 123
        
        # Mock partial failure and recovery
        partial_result = {
            "professionalIdentity": {"title": "Developer"},
            "skillsAssessment": {"skills": ["Python"]},
            "errors": {
                "market_analysis": "External API unavailable",
                "recommendations": "Dependent on market analysis"
            },
            "status": "partial_success"
        }
        
        mock_workflow.execute = AsyncMock(return_value=partial_result)
        mock_workflow.has_errors = Mock(return_value=True)
        mock_workflow.get_errors = Mock(return_value=partial_result["errors"])
        
        # Act
        result = await mock_workflow.execute(user_id, sample_resume_data)
        
        # Assert
        assert result == partial_result
        assert mock_workflow.has_errors() == True
        assert len(mock_workflow.get_errors()) == 2
        assert result["status"] == "partial_success"