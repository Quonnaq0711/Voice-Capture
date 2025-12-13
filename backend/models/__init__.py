"""
Models package initialization - imports all models in correct order to avoid circular imports
"""

# Import base classes first
from backend.db.database import Base

# Import models without relationships first
from backend.models.user import User
from backend.models.refresh_token import RefreshToken
from backend.models.resume import Resume
from backend.models.career_insight import CareerInsight
from backend.models.session import ChatSession
from backend.models.chat import ChatMessage
from backend.models.activity import UserActivity
from backend.models.profile import UserProfile
from backend.models.daily_recommendation import DailyRecommendation
from backend.models.todo import Todo
from backend.models.oauth_token import OAuthToken
from backend.models.extracted_task import ExtractedTask, ProcessedSource, ScannedDateRange
from backend.models.notebook import Notebook
from backend.models.note import Note
from backend.models.todo_comment import TodoComment
from backend.models.solver_session import SolverSession
from backend.models.solver_message import SolverMessage

# Export all models
__all__ = [
    "Base",
    "User",
    "RefreshToken",
    "Resume",
    "CareerInsight",
    "ChatSession",
    "ChatMessage",
    "UserActivity",
    "UserProfile",
    "DailyRecommendation",
    "Todo",
    "OAuthToken",
    "ExtractedTask",
    "ProcessedSource",
    "ScannedDateRange",
    "Notebook",
    "Note",
    "TodoComment",
    "SolverSession",
    "SolverMessage",
]