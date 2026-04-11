from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime
from backend.models.career_insight import CareerInsight

def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)  # UUID-based filename
    original_filename = Column(String)  # Original uploaded filename
    file_path = Column(String)  # Full path to the resume file
    file_type = Column(String)  # File extension (pdf or txt)
    file_size = Column(Integer, nullable=True)  # File size in bytes
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  # Index for user queries
    todo_id = Column(Integer, ForeignKey("todos.id", ondelete="SET NULL"), nullable=True, index=True)  # Link to task (nullable — if task deleted, attachment stays)
    created_at = Column(TZDateTime, default=utc_now, index=True)  # Index for time-based queries
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)

    # AI content summary cache — avoids re-summarizing on every ReadAttachment call
    ai_content_summary = Column(Text, nullable=True)  # LLM-generated summary of file contents
    ai_summary_updated_at = Column(TZDateTime, nullable=True)  # When summary was last generated

    # Relationships
    user = relationship("User", back_populates="resumes")
    career_insights = relationship("CareerInsight", back_populates="resume", cascade="all, delete-orphan")

    @property
    def url(self) -> str:
        """Serving URL — resumes via static mount, attachments via work agent API."""
        if self.file_path and '/attachments/' in self.file_path:
            return f"/api/work/files/attachments/{self.user_id}/{self.filename}"
        return f"/resumes/{self.user_id}/{self.filename}"