"""
Error handling utilities for API responses.

This module provides functions to sanitize error messages before returning them
to clients, preventing internal system details from being exposed.
"""

import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)


# Patterns that indicate sensitive information
SENSITIVE_PATTERNS = [
    r'password',
    r'secret',
    r'token',
    r'key',
    r'credential',
    r'auth',
    r'/home/\w+',  # User home directories
    r'/var/\w+',   # System directories
    r'/etc/\w+',   # Config directories
    r'postgres://|mysql://|sqlite://',  # Database URLs
    r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}',  # IP addresses
    r'port \d+',
    r'connection refused',
    r'errno',
    r'traceback',
]


def sanitize_error_message(error: Exception, default_message: str = "An error occurred") -> str:
    """
    Sanitize an error message for safe client exposure.

    Args:
        error: The exception that occurred
        default_message: Default message to return if error contains sensitive info

    Returns:
        A sanitized error message safe for client exposure
    """
    error_str = str(error).lower()

    # Check for sensitive patterns
    for pattern in SENSITIVE_PATTERNS:
        if re.search(pattern, error_str, re.IGNORECASE):
            logger.warning(f"Sanitized error containing sensitive pattern: {pattern}")
            return default_message

    # Truncate very long error messages
    error_message = str(error)
    if len(error_message) > 200:
        error_message = error_message[:200] + "..."

    return error_message


def get_safe_error_detail(
    error: Exception,
    context: str = "operation",
    log_full_error: bool = True
) -> str:
    """
    Get a safe error detail string for API responses.

    Args:
        error: The exception that occurred
        context: Context description for the error (e.g., "login", "file upload")
        log_full_error: Whether to log the full error for debugging

    Returns:
        A safe, user-friendly error message
    """
    if log_full_error:
        logger.error(f"Error during {context}: {str(error)}", exc_info=True)

    # Common error types with safe messages
    error_type = type(error).__name__

    safe_messages = {
        'ValueError': f"Invalid value provided for {context}",
        'TypeError': f"Invalid data type for {context}",
        'KeyError': f"Missing required field for {context}",
        'FileNotFoundError': "Requested resource not found",
        'PermissionError': "Permission denied",
        'TimeoutError': "Request timed out",
        'ConnectionError': "Service temporarily unavailable",
    }

    if error_type in safe_messages:
        return safe_messages[error_type]

    # For other errors, sanitize the message
    return sanitize_error_message(error, f"Error during {context}")
