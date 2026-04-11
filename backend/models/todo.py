"""
Todo model for Work Agent task management
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, JSON, Boolean
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime


def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)


class Todo(Base):
    """
    Todo item for user's task list.

    Supports:
    - Basic CRUD operations
    - Priority levels (low, medium, high, urgent)
    - Status tracking (none, todo, in_progress, review, done, delayed)
    - Due dates with timezone support
    - Optional linking to external systems (Jira, etc.)
    """
    __tablename__ = "todos"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    # Core fields
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    ai_summary = Column(JSON, nullable=True)  # LLM-generated bullet points (shared with ExtractedTask)

    # Status and priority
    status = Column(String(20), default="todo", index=True)  # none, todo, in_progress, review, done, delayed
    priority = Column(String(20), default="none", index=True)  # none, low, medium, high, urgent

    # Dates
    due_date = Column(DateTime, nullable=True, index=True)
    reminder_at = Column(DateTime, nullable=True)

    # Categorization
    category = Column(String(100), nullable=True)  # work, personal, meeting_prep, etc.
    tags = Column(Text, nullable=True)  # JSON array of tags

    # External system linking (for future Jira/etc integration)
    external_id = Column(String(255), nullable=True)  # Jira issue key, etc.
    external_source = Column(String(50), nullable=True)  # "jira", "google_tasks", etc.
    external_url = Column(String(500), nullable=True)  # Link to external system

    # Scheduling
    is_scheduled = Column(Boolean, default=False, nullable=False, server_default="0")  # True when placed on calendar via AI scheduler
    scheduled_start = Column(DateTime, nullable=True)   # Calendar event start
    scheduled_end = Column(DateTime, nullable=True)      # Calendar event end
    scheduled_calendar_event_id = Column(String(255), nullable=True)  # Google Calendar event ID

    # AI prioritization metadata
    ai_estimated_minutes = Column(Integer, nullable=True)  # AI-estimated task duration
    ai_suggested_order = Column(Integer, nullable=True)  # AI-suggested execution order
    ai_priority_reasoning = Column(String(500), nullable=True)  # Brief reasoning for AI priority (set once, not overwritten)
    ai_last_analyzed = Column(TZDateTime, nullable=True)  # When task was last AI-analyzed

    # Timestamps
    created_at = Column(TZDateTime, default=utc_now, index=True)
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)
    completed_at = Column(TZDateTime, nullable=True)

    # Relationships
    user = relationship("User", back_populates="todos")
    comments = relationship("TodoComment", back_populates="todo", cascade="all, delete-orphan", order_by="TodoComment.created_at")
    solver_sessions = relationship("SolverSession", back_populates="todo", cascade="all, delete-orphan", order_by="SolverSession.updated_at.desc()")
    attachments = relationship("Resume", backref="todo", lazy="select")

    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_todos_user_status', 'user_id', 'status'),
        Index('ix_todos_user_due_date', 'user_id', 'due_date'),
        Index('ix_todos_user_priority', 'user_id', 'priority'),
    )

    def __repr__(self):
        return f"<Todo(id={self.id}, title='{self.title[:30]}...', status={self.status})>"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "ai_summary": self.ai_summary,
            "status": self.status,
            "priority": self.priority,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "category": self.category,
            "tags": self.tags,
            "external_id": self.external_id,
            "external_source": self.external_source,
            "external_url": self.external_url,
            "is_scheduled": self.is_scheduled or False,
            "scheduled_start": self.scheduled_start.isoformat() if self.scheduled_start else None,
            "scheduled_end": self.scheduled_end.isoformat() if self.scheduled_end else None,
            "scheduled_calendar_event_id": self.scheduled_calendar_event_id,
            "ai_estimated_minutes": self.ai_estimated_minutes,
            "ai_suggested_order": self.ai_suggested_order,
            "ai_priority_reasoning": self.ai_priority_reasoning,
            "ai_last_analyzed": self.ai_last_analyzed.isoformat() if self.ai_last_analyzed else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }
