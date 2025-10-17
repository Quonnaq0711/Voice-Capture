"""
Models package initialization - imports all models in correct order to avoid circular imports
"""

# Import base classes first
from backend.db.database import Base

# Import models without relationships first
from backend.models.user import User
from backend.models.resume import Resume
from backend.models.career_insight import CareerInsight
from backend.models.session import ChatSession
from backend.models.chat import ChatMessage
from backend.models.activity import UserActivity
from backend.models.profile import UserProfile

# Export all models
__all__ = [
    "Base",
    "User",
    "Resume",
    "CareerInsight",
    "ChatSession",
    "ChatMessage",
    "UserActivity",
    "UserProfile"
]