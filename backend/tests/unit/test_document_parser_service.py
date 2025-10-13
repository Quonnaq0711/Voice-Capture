"""Unit tests for DocumentParserService."""

import os
import pytest
import tempfile
from pathlib import Path

from backend.services.document_parser_service import DocumentParserService


class TestDocumentParserService:
    """Test suite for DocumentParserService."""

    def test_is_supported_format_pdf(self):
        """Test that PDF format is recognized as supported."""
        assert DocumentParserService.is_supported_format("test.pdf") is True
        assert DocumentParserService.is_supported_format("test.PDF") is True

    def test_is_supported_format_docx(self):
        """Test that DOCX format is recognized as supported."""
        assert DocumentParserService.is_supported_format("test.docx") is True
        assert DocumentParserService.is_supported_format("test.DOCX") is True

    def test_is_supported_format_txt(self):
        """Test that TXT format is recognized as supported."""
        assert DocumentParserService.is_supported_format("test.txt") is True
        assert DocumentParserService.is_supported_format("test.TXT") is True

    def test_is_supported_format_unsupported(self):
        """Test that unsupported formats are rejected."""
        assert DocumentParserService.is_supported_format("test.exe") is False
        assert DocumentParserService.is_supported_format("test.jpg") is False
        assert DocumentParserService.is_supported_format("test.png") is False
        assert DocumentParserService.is_supported_format("test.zip") is False
        assert DocumentParserService.is_supported_format("test.doc") is False  # DOC not supported

    def test_parse_txt_file(self):
        """Test parsing a TXT file."""
        # Create a temporary TXT file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
            test_content = "This is a test resume.\nName: John Doe\nExperience: 5 years"
            f.write(test_content)
            temp_file = f.name

        try:
            # Parse the file
            content = DocumentParserService.parse_document(temp_file)

            # Verify content
            assert content is not None
            assert "This is a test resume" in content
            assert "John Doe" in content
            assert "5 years" in content
        finally:
            # Cleanup
            os.unlink(temp_file)

    def test_parse_txt_file_with_utf8_bom(self):
        """Test parsing a TXT file with UTF-8 BOM."""
        # Create a temporary TXT file with BOM
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8-sig') as f:
            test_content = "Resume with UTF-8 BOM\nSkills: Python, JavaScript"
            f.write(test_content)
            temp_file = f.name

        try:
            # Parse the file
            content = DocumentParserService.parse_document(temp_file)

            # Verify content
            assert content is not None
            assert "Resume with UTF-8 BOM" in content
            assert "Python" in content
        finally:
            # Cleanup
            os.unlink(temp_file)

    def test_parse_empty_txt_file(self):
        """Test parsing an empty TXT file."""
        # Create an empty TXT file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            temp_file = f.name

        try:
            # Parse the file
            content = DocumentParserService.parse_document(temp_file)

            # Empty file should return None
            assert content is None
        finally:
            # Cleanup
            os.unlink(temp_file)

    def test_parse_nonexistent_file(self):
        """Test parsing a file that doesn't exist."""
        with pytest.raises(FileNotFoundError):
            DocumentParserService.parse_document("/nonexistent/file.txt")

    def test_parse_unsupported_format(self):
        """Test parsing an unsupported file format."""
        # Create a temporary file with unsupported extension
        with tempfile.NamedTemporaryFile(mode='w', suffix='.exe', delete=False) as f:
            f.write("test content")
            temp_file = f.name

        try:
            with pytest.raises(ValueError, match="Unsupported file format"):
                DocumentParserService.parse_document(temp_file)
        finally:
            # Cleanup
            os.unlink(temp_file)

    def test_get_file_info_txt(self):
        """Test getting file information for a TXT file."""
        # Create a temporary TXT file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("Test content for file info")
            temp_file = f.name

        try:
            # Get file info
            info = DocumentParserService.get_file_info(temp_file)

            # Verify info
            assert info['extension'] == '.txt'
            assert info['is_supported'] is True
            assert info['size_bytes'] > 0
            assert info['size_kb'] > 0
            assert 'filename' in info
        finally:
            # Cleanup
            os.unlink(temp_file)

    def test_get_file_info_unsupported(self):
        """Test getting file information for an unsupported file."""
        # Create a temporary file with unsupported extension
        with tempfile.NamedTemporaryFile(mode='w', suffix='.xyz', delete=False) as f:
            f.write("test")
            temp_file = f.name

        try:
            # Get file info
            info = DocumentParserService.get_file_info(temp_file)

            # Verify unsupported flag
            assert info['extension'] == '.xyz'
            assert info['is_supported'] is False
        finally:
            # Cleanup
            os.unlink(temp_file)

    def test_get_file_info_nonexistent(self):
        """Test getting file info for a nonexistent file."""
        info = DocumentParserService.get_file_info("/nonexistent/file.txt")

        # Should return empty dict on error
        assert info == {}

    def test_supported_formats_constant(self):
        """Test that SUPPORTED_FORMATS constant contains all expected formats."""
        expected_formats = ['.pdf', '.docx', '.txt']
        assert DocumentParserService.SUPPORTED_FORMATS == expected_formats

    def test_parse_txt_with_special_characters(self):
        """Test parsing TXT file with special characters."""
        # Create a temporary TXT file with special characters
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
            test_content = "Resume: João Silva\nEmail: test@example.com\nSkills: C++, C#, 日本語"
            f.write(test_content)
            temp_file = f.name

        try:
            # Parse the file
            content = DocumentParserService.parse_document(temp_file)

            # Verify content with special characters
            assert content is not None
            assert "João Silva" in content
            assert "C++" in content
            assert "test@example.com" in content
        finally:
            # Cleanup
            os.unlink(temp_file)

    def test_parse_txt_multiline(self):
        """Test parsing TXT file with multiple lines and sections."""
        # Create a comprehensive multi-line resume
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
            test_content = """John Doe
Senior Software Engineer

EXPERIENCE:
- Software Engineer at Tech Corp (2018-2023)
- Junior Developer at StartUp Inc (2016-2018)

SKILLS:
Python, JavaScript, Docker, Kubernetes

EDUCATION:
BS Computer Science, MIT, 2016
"""
            f.write(test_content)
            temp_file = f.name

        try:
            # Parse the file
            content = DocumentParserService.parse_document(temp_file)

            # Verify all sections are present
            assert content is not None
            assert "John Doe" in content
            assert "EXPERIENCE" in content
            assert "Tech Corp" in content
            assert "SKILLS" in content
            assert "Python" in content
            assert "EDUCATION" in content
            assert "MIT" in content
        finally:
            # Cleanup
            os.unlink(temp_file)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
