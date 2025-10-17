"""Unit tests for ResumeAnalyzerVLLM class."""

import pytest
import sys
import os
from unittest.mock import Mock, AsyncMock, patch
from typing import Dict, Any

# Add src directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', 'src'))


class TestResumeAnalyzerVLLMInitialization:
    """Test cases for ResumeAnalyzerVLLM initialization."""

    def test_init_with_default_params(self, mock_resume_analyzer_vllm):
        """Test initialization with default mock parameters."""
        # Assert
        assert mock_resume_analyzer_vllm is not None
        assert mock_resume_analyzer_vllm.model_name == "test-model"
        assert mock_resume_analyzer_vllm.api_base == "http://test:8888/v1"
        assert mock_resume_analyzer_vllm.temperature == 0.7
        assert mock_resume_analyzer_vllm.max_tokens == 2048

    def test_has_required_attributes(self, mock_resume_analyzer_vllm):
        """Test that analyzer has all required attributes."""
        # Assert
        assert hasattr(mock_resume_analyzer_vllm, 'model_name')
        assert hasattr(mock_resume_analyzer_vllm, 'api_base')
        assert hasattr(mock_resume_analyzer_vllm, 'temperature')
        assert hasattr(mock_resume_analyzer_vllm, 'max_tokens')
        assert hasattr(mock_resume_analyzer_vllm, 'base_llm_config')

    def test_base_llm_config_structure(self, mock_resume_analyzer_vllm):
        """Test that base_llm_config has correct structure."""
        # Assert
        config = mock_resume_analyzer_vllm.base_llm_config
        assert "model" in config
        assert "openai_api_base" in config
        assert "openai_api_key" in config
        assert config["openai_api_key"] == "EMPTY"


class TestJSONSchemaGeneration:
    """Test JSON Schema guided generation."""

    def test_create_llm_with_schema(self, mock_resume_analyzer_vllm):
        """Test creating LLM instance with JSON Schema."""
        # Arrange
        section_name = "professionalIdentity"
        mock_llm = Mock()

        mock_resume_analyzer_vllm._create_llm_with_schema.return_value = mock_llm

        # Act
        llm = mock_resume_analyzer_vllm._create_llm_with_schema(section_name)

        # Assert
        assert llm == mock_llm
        mock_resume_analyzer_vllm._create_llm_with_schema.assert_called_once_with(section_name)

    def test_create_llm_with_schema_custom_max_tokens(self, mock_resume_analyzer_vllm):
        """Test creating LLM with custom max_tokens."""
        # Arrange
        section_name = "skillsAnalysis"
        custom_max_tokens = 3000
        mock_llm = Mock()
        mock_llm.max_tokens = custom_max_tokens

        mock_resume_analyzer_vllm._create_llm_with_schema.return_value = mock_llm

        # Act
        llm = mock_resume_analyzer_vllm._create_llm_with_schema(
            section_name,
            max_tokens=custom_max_tokens
        )

        # Assert
        assert llm.max_tokens == custom_max_tokens

    def test_create_llm_with_schema_error_handling(self, mock_resume_analyzer_vllm):
        """Test error handling when schema creation fails."""
        # Arrange
        section_name = "invalidSection"

        mock_resume_analyzer_vllm._create_llm_with_schema.side_effect = RuntimeError(
            "Cannot create LLM with JSON Schema for section 'invalidSection'"
        )

        # Act & Assert
        with pytest.raises(RuntimeError) as exc_info:
            mock_resume_analyzer_vllm._create_llm_with_schema(section_name)

        assert "Cannot create LLM with JSON Schema" in str(exc_info.value)
        assert section_name in str(exc_info.value)


class TestMaxTokensValidation:
    """Test max_tokens parameter validation."""

    def test_validate_max_tokens_positive_integer(self, mock_resume_analyzer_vllm):
        """Test that max_tokens must be a positive integer."""
        # Arrange
        mock_resume_analyzer_vllm._create_llm_with_schema.side_effect = [
            ValueError("max_tokens must be a positive integer, got: 0"),
            ValueError("max_tokens must be a positive integer, got: -100")
        ]

        # Act & Assert - Zero tokens
        with pytest.raises(ValueError) as exc_info:
            mock_resume_analyzer_vllm._create_llm_with_schema("test_section", max_tokens=0)
        assert "must be a positive integer" in str(exc_info.value)

        # Act & Assert - Negative tokens
        with pytest.raises(ValueError) as exc_info:
            mock_resume_analyzer_vllm._create_llm_with_schema("test_section", max_tokens=-100)
        assert "must be a positive integer" in str(exc_info.value)

    def test_validate_max_tokens_type(self, mock_resume_analyzer_vllm):
        """Test that max_tokens must be an integer type."""
        # Arrange
        mock_resume_analyzer_vllm._create_llm_with_schema.side_effect = [
            ValueError("max_tokens must be a positive integer, got: 2048 (type: str)"),
            ValueError("max_tokens must be a positive integer, got: 2048.5 (type: float)")
        ]

        # Act & Assert - String type
        with pytest.raises(ValueError) as exc_info:
            mock_resume_analyzer_vllm._create_llm_with_schema("test_section", max_tokens="2048")
        assert "must be a positive integer" in str(exc_info.value)

        # Act & Assert - Float type
        with pytest.raises(ValueError) as exc_info:
            mock_resume_analyzer_vllm._create_llm_with_schema("test_section", max_tokens=2048.5)
        assert "must be a positive integer" in str(exc_info.value)

    def test_validate_max_tokens_upper_bound(self, mock_resume_analyzer_vllm):
        """Test that max_tokens has an upper bound."""
        # Arrange
        mock_resume_analyzer_vllm._create_llm_with_schema.side_effect = ValueError(
            "max_tokens (20000) exceeds maximum allowed value (16384)"
        )

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            mock_resume_analyzer_vllm._create_llm_with_schema("test_section", max_tokens=20000)

        assert "exceeds maximum allowed value" in str(exc_info.value)
        assert "16384" in str(exc_info.value)

    def test_validate_max_tokens_valid_range(self, mock_resume_analyzer_vllm):
        """Test that valid max_tokens values are accepted."""
        # Arrange
        valid_values = [1, 100, 2048, 4096, 8192, 16384]

        for max_tokens in valid_values:
            mock_llm = Mock()
            mock_llm.max_tokens = max_tokens
            mock_resume_analyzer_vllm._create_llm_with_schema.return_value = mock_llm

            # Act
            llm = mock_resume_analyzer_vllm._create_llm_with_schema(
                "test_section",
                max_tokens=max_tokens
            )

            # Assert
            assert llm.max_tokens == max_tokens


class TestAnalyzeResume:
    """Test resume analysis functionality."""

    @pytest.mark.asyncio
    async def test_analyze_resume_success(self, mock_resume_analyzer_vllm, sample_resume_content):
        """Test successful resume analysis."""
        # Arrange
        user_id = 123
        resume_id = 1

        expected_insights = {
            "professionalIdentity": {
                "title": "Senior Software Engineer",
                "summary": "Experienced developer with 5+ years"
            },
            "skillsAnalysis": {
                "technicalSkills": ["Python", "JavaScript", "React"],
                "softSkills": ["Leadership", "Communication"]
            }
        }

        mock_resume_analyzer_vllm.analyze_resume.return_value = expected_insights

        # Act
        result = await mock_resume_analyzer_vllm.analyze_resume(
            resume_content=sample_resume_content,
            user_id=user_id,
            resume_id=resume_id
        )

        # Assert
        assert result == expected_insights
        mock_resume_analyzer_vllm.analyze_resume.assert_called_once()

    @pytest.mark.asyncio
    async def test_analyze_resume_with_empty_content(self, mock_resume_analyzer_vllm):
        """Test resume analysis with empty content."""
        # Arrange
        mock_resume_analyzer_vllm.analyze_resume.side_effect = ValueError(
            "Resume content cannot be empty"
        )

        # Act & Assert
        with pytest.raises(ValueError) as exc_info:
            await mock_resume_analyzer_vllm.analyze_resume(
                resume_content="",
                user_id=123,
                resume_id=1
            )

        assert "cannot be empty" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_analyze_resume_llm_error(self, mock_resume_analyzer_vllm, sample_resume_content):
        """Test handling of LLM errors during analysis."""
        # Arrange
        mock_resume_analyzer_vllm.analyze_resume.side_effect = Exception(
            "vLLM service unavailable"
        )

        # Act & Assert
        with pytest.raises(Exception) as exc_info:
            await mock_resume_analyzer_vllm.analyze_resume(
                resume_content=sample_resume_content,
                user_id=123,
                resume_id=1
            )

        assert "unavailable" in str(exc_info.value).lower()


class TestGuidedGenerationFeatures:
    """Test vLLM Guided Generation specific features."""

    def test_json_schema_constraint_applied(self, mock_resume_analyzer_vllm):
        """Test that JSON Schema constraint is properly applied."""
        # Arrange
        section_name = "workExperience"
        mock_llm = Mock()

        # Mock that schema is applied
        mock_resume_analyzer_vllm._create_llm_with_schema.return_value = mock_llm

        # Act
        llm = mock_resume_analyzer_vllm._create_llm_with_schema(section_name)

        # Assert
        assert llm is not None
        mock_resume_analyzer_vllm._create_llm_with_schema.assert_called_once_with(section_name)


class TestDatabaseIntegration:
    """Test database methods from BaseResumeAnalyzer."""

    @pytest.mark.asyncio
    async def test_store_career_insight(self, mock_resume_analyzer_vllm):
        """Test storing career insight to database."""
        # Arrange
        user_id = 123
        resume_id = 1
        insights = {"professionalIdentity": {"title": "Engineer"}}

        mock_career_insight = Mock()
        mock_career_insight.id = 1
        mock_resume_analyzer_vllm.store_career_insight.return_value = mock_career_insight

        # Act
        result = await mock_resume_analyzer_vllm.store_career_insight(
            user_id=user_id,
            resume_id=resume_id,
            professional_data=insights
        )

        # Assert
        assert result.id == 1
        mock_resume_analyzer_vllm.store_career_insight.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_latest_career_insight(self, mock_resume_analyzer_vllm):
        """Test retrieving latest career insight."""
        # Arrange
        user_id = 123

        expected_insight = {
            "id": 1,
            "user_id": user_id,
            "professionalIdentity": {"title": "Senior Engineer"}
        }
        mock_resume_analyzer_vllm.get_latest_career_insight.return_value = expected_insight

        # Act
        result = await mock_resume_analyzer_vllm.get_latest_career_insight(user_id)

        # Assert
        assert result == expected_insight
        mock_resume_analyzer_vllm.get_latest_career_insight.assert_called_once_with(user_id)

    @pytest.mark.asyncio
    async def test_get_latest_resume(self, mock_resume_analyzer_vllm):
        """Test retrieving latest resume."""
        # Arrange
        user_id = 123

        expected_resume = {
            "id": 1,
            "user_id": user_id,
            "filename": "resume.pdf",
            "file_path": "/path/to/resume.pdf"
        }
        mock_resume_analyzer_vllm.get_latest_resume.return_value = expected_resume

        # Act
        result = await mock_resume_analyzer_vllm.get_latest_resume(user_id)

        # Assert
        assert result == expected_resume
        mock_resume_analyzer_vllm.get_latest_resume.assert_called_once_with(user_id)


class TestInheritance:
    """Test inheritance from BaseResumeAnalyzer."""

    def test_inherits_base_methods(self, mock_resume_analyzer_vllm):
        """Test that ResumeAnalyzerVLLM has base class methods."""
        # Assert - Should have base class methods
        assert hasattr(mock_resume_analyzer_vllm, 'analyze_resume')
        assert hasattr(mock_resume_analyzer_vllm, 'store_career_insight')
        assert hasattr(mock_resume_analyzer_vllm, 'get_latest_career_insight')
        assert hasattr(mock_resume_analyzer_vllm, 'get_latest_resume')

    def test_database_methods_callable(self, mock_resume_analyzer_vllm):
        """Test that database methods are callable."""
        # Assert
        assert callable(mock_resume_analyzer_vllm.store_career_insight)
        assert callable(mock_resume_analyzer_vllm.get_latest_career_insight)
        assert callable(mock_resume_analyzer_vllm.get_latest_resume)
        assert callable(mock_resume_analyzer_vllm.analyze_resume)
