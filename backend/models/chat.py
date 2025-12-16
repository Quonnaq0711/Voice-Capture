from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime

def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # Index for user queries
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True, index=True)  # Index for session queries
    message_text = Column(Text, nullable=False)
    sender = Column(String, nullable=False)  # 'user' or 'assistant'
    agent_type = Column(String, nullable=True, default='dashboard')  # 'dashboard', 'career', etc.
    created_at = Column(TZDateTime, default=utc_now, index=True)  # Index for time-based queries
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", back_populates="chat_messages")
    session = relationship("ChatSession", back_populates="messages")