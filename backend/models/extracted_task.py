"""
ExtractedTask model for AI-extracted tasks from emails/calendar
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime


def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)


class ExtractedTask(Base):
    """
    AI-extracted task from email or calendar event.

    These are suggestions that can be:
    - Added to user's todo list (converted to Todo)
    - Dismissed (marked as dismissed)
    - Auto-dismissed after expiry
    """
    __tablename__ = "extracted_tasks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    # Task content (extracted by LLM)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), default="none")  # none, low, medium, high, urgent
    due_date = Column(DateTime, nullable=True)
    confidence = Column(Float, default=0.8)  # LLM confidence score 0-1
    ai_summary = Column(JSON, nullable=True)  # LLM-generated bullet points (list of strings)

    # Source tracking
    source_type = Column(String(20), nullable=False, index=True)  # "email", "calendar", or "gtask"
    source_id = Column(String(255), nullable=False, index=True)  # Gmail message ID or Calendar event ID
    source_subject = Column(String(500), nullable=True)  # Email subject or event title
    source_account = Column(String(255), nullable=True)  # Which account this came from
    source_date = Column(DateTime, nullable=True)  # Original email date or event start time

    # Status
    status = Column(String(20), default="pending", index=True)  # pending, added, dismissed
    added_todo_id = Column(Integer, ForeignKey("todos.id", ondelete="SET NULL"), nullable=True)

    # Timestamps
    extracted_at = Column(TZDateTime, default=utc_now, index=True)
    processed_at = Column(TZDateTime, nullable=True)  # When added/dismissed

    # Relationships
    user = relationship("User", back_populates="extracted_tasks")
    added_todo = relationship("Todo", foreign_keys=[added_todo_id])

    # Indexes
    __table_args__ = (
        Index('ix_extracted_tasks_user_status', 'user_id', 'status'),
        Index('ix_extracted_tasks_source', 'user_id', 'source_type', 'source_id'),
        # Composite index for pagination queries: WHERE user_id=? AND status='pending' ORDER BY due_date
        Index('ix_extracted_tasks_pagination', 'user_id', 'status', 'due_date'),
    )

    def __repr__(self):
        return f"<ExtractedTask(id={self.id}, title='{self.title[:30]}...', source={self.source_type})>"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "priority": self.priority,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "confidence": self.confidence,
            "ai_summary": self.ai_summary,
            "source_type": self.source_type,
            "source_id": self.source_id,
            "source_subject": self.source_subject,
            "source_account": self.source_account,
            "source_date": self.source_date.isoformat() if self.source_date else None,
            "status": self.status,
            "added_todo_id": self.added_todo_id,
            "extracted_at": self.extracted_at.isoformat() if self.extracted_at else None,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
        }


class ProcessedSource(Base):
    """
    Tracks which email/calendar items have been processed for task extraction.
    Used for incremental extraction - only process new items.
    """
    __tablename__ = "processed_sources"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    # Source identification
    source_type = Column(String(20), nullable=False)  # "email" or "calendar"
    source_id = Column(String(255), nullable=False)  # Gmail message ID or Calendar event ID
    source_account = Column(String(255), nullable=True)  # Account email

    # Processing info
    processed_at = Column(TZDateTime, default=utc_now)
    tasks_extracted = Column(Integer, default=0)  # How many tasks were extracted

    # Relationships
    user = relationship("User")

    # Unique constraint - one entry per source item per user
    __table_args__ = (
        Index('ix_processed_sources_lookup', 'user_id', 'source_type', 'source_id', unique=True),
    )

    def __repr__(self):
        return f"<ProcessedSource(user={self.user_id}, type={self.source_type}, id={self.source_id})>"


class ScannedDateRange(Base):
    """
    Tracks which date ranges have been fully scanned per (user, account, source_type).
    Persisted to DB so range optimization survives server restarts.
    On overlapping extraction requests, only the uncovered portion is queried from APIs.
    Cleared on force_refresh.
    """
    __tablename__ = "scanned_date_ranges"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_email = Column(String(255), nullable=False)
    source_type = Column(String(20), nullable=False)  # "email"
    start_date = Column(DateTime, nullable=False)  # Range start (date only, stored as datetime)
    end_date = Column(DateTime, nullable=False)    # Range end (inclusive)

    __table_args__ = (
        Index('ix_scanned_ranges_lookup', 'user_id', 'account_email', 'source_type'),
    )

    def __repr__(self):
        return f"<ScannedDateRange(user={self.user_id}, account={self.account_email}, {self.start_date}~{self.end_date})>"
