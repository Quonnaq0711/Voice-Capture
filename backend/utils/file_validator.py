"""
File Upload Validation Utilities
Provides secure file validation for uploads
"""
import os
from typing import Tuple, Optional
from fastapi import UploadFile, HTTPException, status
from backend.config.file_upload_config import (
    MAX_RESUME_SIZE,
    MAX_AVATAR_SIZE,
    ALLOWED_RESUME_EXTENSIONS,
    ALLOWED_AVATAR_EXTENSIONS,
    format_file_size
)


class FileValidator:
    """Secure file upload validator"""

    @staticmethod
    async def validate_resume(file: UploadFile) -> Tuple[bytes, str]:
        """
        Validate resume file for security and size constraints.

        Args:
            file: FastAPI UploadFile object

        Returns:
            Tuple of (file_content, file_extension)

        Raises:
            HTTPException: If validation fails
        """
        # Validate file extension
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ALLOWED_RESUME_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{file_extension}'. "
                       f"Allowed formats: {', '.join(ALLOWED_RESUME_EXTENSIONS)}"
            )

        # Read file content
        content = await file.read()

        # Validate file size
        file_size = len(content)
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty. Please upload a valid resume."
            )

        if file_size > MAX_RESUME_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size ({format_file_size(file_size)}) exceeds "
                       f"maximum allowed size of {format_file_size(MAX_RESUME_SIZE)}. "
                       f"Please upload a smaller file."
            )

        return content, file_extension

    @staticmethod
    async def validate_avatar(file: UploadFile) -> Tuple[bytes, str]:
        """
        Validate avatar image file for security and size constraints.

        Args:
            file: FastAPI UploadFile object

        Returns:
            Tuple of (file_content, file_extension)

        Raises:
            HTTPException: If validation fails
        """
        # Validate file extension
        file_extension = os.path.splitext(file.filename)[1].lower()
        if file_extension not in ALLOWED_AVATAR_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported image format '{file_extension}'. "
                       f"Allowed formats: {', '.join(ALLOWED_AVATAR_EXTENSIONS)}"
            )

        # Read file content
        content = await file.read()

        # Validate file size
        file_size = len(content)
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty. Please upload a valid image."
            )

        if file_size > MAX_AVATAR_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Image size ({format_file_size(file_size)}) exceeds "
                       f"maximum allowed size of {format_file_size(MAX_AVATAR_SIZE)}. "
                       f"Please upload a smaller image."
            )

        return content, file_extension

    @staticmethod
    def validate_filename(filename: str, max_length: int = 255) -> str:
        """
        Sanitize and validate filename to prevent path traversal attacks.

        Args:
            filename: Original filename
            max_length: Maximum allowed filename length

        Returns:
            Sanitized filename

        Raises:
            HTTPException: If filename is invalid
        """
        if not filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename cannot be empty."
            )

        # Remove any path components (prevent path traversal)
        filename = os.path.basename(filename)

        # Check for dangerous characters
        dangerous_chars = ['..', '/', '\\', '\x00']
        for char in dangerous_chars:
            if char in filename:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Filename contains invalid characters: '{char}'"
                )

        # Validate length
        if len(filename) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Filename is too long. Maximum length: {max_length} characters."
            )

        return filename
