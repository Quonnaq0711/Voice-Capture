"""
File Upload Configuration
Centralized configuration for file upload size limits and allowed formats
"""

# File size limits (in bytes)
MAX_RESUME_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_AVATAR_SIZE = 5 * 1024 * 1024   # 5 MB

# Allowed file extensions
ALLOWED_RESUME_EXTENSIONS = [".pdf", ".docx", ".txt"]
ALLOWED_AVATAR_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"]

# MIME type validation (optional, for additional security)
ALLOWED_RESUME_MIME_TYPES = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain"
]

ALLOWED_AVATAR_MIME_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
]


def format_file_size(size_bytes: int) -> str:
    """Convert bytes to human-readable format"""
    if size_bytes < 1024:
        return f"{size_bytes} bytes"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
