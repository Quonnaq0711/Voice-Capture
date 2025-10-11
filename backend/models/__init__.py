"""
Models package initialization - imports all models in correct order to avoid circular imports
"""

# Import base classes first
from db.database import Base

# Import models without relationships first
from models.user import User
from models.resume import Resume
from models.career_insight import CareerInsight
from models.session import ChatSession
from models.chat import ChatMessage
from models.activity import UserActivity
from models.profile import UserProfile

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