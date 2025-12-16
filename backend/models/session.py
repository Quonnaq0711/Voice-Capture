from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime

def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # Index for user queries
    session_name = Column(String(255), nullable=False)
    first_message_time = Column(TZDateTime, nullable=False)
    created_at = Column(TZDateTime, default=utc_now, index=True)  # Index for time-based queries
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)
    is_active = Column(Boolean, default=False, index=True)  # Index for active session queries
    unread = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session")