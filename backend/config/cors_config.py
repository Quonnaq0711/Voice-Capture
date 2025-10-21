"""
CORS Configuration Module
Provides environment-based CORS origin configuration for enhanced security
"""
import os
from typing import List
import logging

logger = logging.getLogger(__name__)


def get_allowed_origins() -> List[str]:
    """
    Get allowed CORS origins based on environment.

    Priority:
    1. CORS_ALLOWED_ORIGINS environment variable (comma-separated)
    2. Default values based on ENVIRONMENT variable

    Returns:
        List of allowed origin URLs

    Examples:
        Development: ['http://localhost:1000', 'http://localhost:3000', ...]
        Staging: ['https://staging.idii.co', 'https://idii.co']
        Production: ['https://idii.co']
    """
    # Get environment
    env = os.getenv("ENVIRONMENT", "production").lower()

    # Check if CORS_ALLOWED_ORIGINS is explicitly set
    cors_origins_env = os.getenv("CORS_ALLOWED_ORIGINS", "")

    if cors_origins_env:
        # Split by comma and strip whitespace
        origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
        logger.info(f"CORS origins loaded from CORS_ALLOWED_ORIGINS environment variable")
        return origins

    # Fallback to environment-based defaults
    if env == "development":
        origins = [
            "http://localhost:1000",       # Development frontend (default)
            "http://localhost:3000",       # Alternative frontend port
            "http://127.0.0.1:1000",       # Localhost IP variant
            "http://127.0.0.1:3000",       # Alternative localhost IP
            "http://localhost:5000",       # Backend (for Swagger UI)
            "http://127.0.0.1:5000",       # Backend localhost IP
        ]
        logger.info(f"Using default CORS origins for DEVELOPMENT environment")

    elif env == "staging":
        origins = [
            "https://staging.idii.co",     # Staging frontend
            "https://idii.co",             # Production fallback for testing
        ]
        logger.info(f"Using default CORS origins for STAGING environment")

    else:  # production or any other environment
        origins = [
            "https://idii.co",             # Production frontend only
        ]
        logger.info(f"Using default CORS origins for PRODUCTION environment")

    return origins


def get_allowed_methods() -> List[str]:
    """
    Get allowed HTTP methods for CORS.

    Returns:
        List of allowed HTTP methods
    """
    # Restrict to commonly used methods (avoid "*")
    return ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]


def log_cors_configuration(allowed_origins: List[str]):
    """
    Log CORS configuration for debugging.

    Args:
        allowed_origins: List of allowed origin URLs
    """
    env = os.getenv("ENVIRONMENT", "production")

    logger.info("=" * 60)
    logger.info("🔒 CORS Security Configuration")
    logger.info("=" * 60)
    logger.info(f"Environment: {env}")
    logger.info(f"Allowed Origins ({len(allowed_origins)}):")
    for origin in allowed_origins:
        logger.info(f"  ✓ {origin}")
    logger.info(f"Allowed Methods: {', '.join(get_allowed_methods())}")
    logger.info(f"Credentials Allowed: True")
    logger.info("=" * 60)
