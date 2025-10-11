"""
Model to track all user activities across the platform
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from db.database import Base

class UserActivity(Base):
    """
    Model to track all user activities across the platform
    """
    __tablename__ = "user_activities"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Activity details
    activity_type = Column(String(50), nullable=False)  # 'chat', 'resume_analysis', 'agent_interaction'
    activity_source = Column(String(50), nullable=False)  # 'dashboard', 'career', 'money', 'mind', etc.
    activity_title = Column(String(255), nullable=False)  # Human readable title
    activity_description = Column(Text, nullable=True)  # Optional detailed description

    # Context data (JSON field for flexible storage)
    activity_metadata = Column(JSON, nullable=True)  # Store additional context like agent type, session info, etc.

    # References to related entities
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True)
    message_id = Column(Integer, ForeignKey("chat_messages.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="activities")
    session = relationship("ChatSession", foreign_keys=[session_id])
    message = relationship("ChatMessage", foreign_keys=[message_id])

    def __repr__(self):
        return f"<UserActivity(id={self.id}, user_id={self.user_id}, type={self.activity_type}, source={self.activity_source})>"

    def to_dict(self):
        """Convert activity to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "activity_type": self.activity_type,
            "activity_source": self.activity_source,
            "activity_title": self.activity_title,
            "activity_description": self.activity_description,
            "activity_metadata": self.activity_metadata,
            "session_id": self.session_id,
            "message_id": self.message_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }