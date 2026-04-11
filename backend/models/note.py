"""
Note model for storing user notes with rich text content
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime


def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)


class Note(Base):
    """
    Note for storing user's text content with rich formatting.

    Supports:
    - Rich text content (HTML from Tiptap editor)
    - Plain text version for search
    - Organization by notebook
    - Pin and archive functionality
    - Templates for quick note creation
    """
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    notebook_id = Column(Integer, ForeignKey("notebooks.id", ondelete="SET NULL"), nullable=True, index=True)

    # Core content
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=True)  # HTML from Tiptap rich text editor
    content_text = Column(Text, nullable=True)  # Plain text for search indexing

    # Status flags
    is_pinned = Column(Boolean, default=False, index=True)
    is_archived = Column(Boolean, default=False, index=True)
    is_trashed = Column(Boolean, default=False, index=True)
    deleted_at = Column(TZDateTime, nullable=True)  # When moved to trash

    # Template tracking
    template_id = Column(String(50), nullable=True)  # e.g., "meeting_minutes", "daily_standup"

    # Timestamps
    created_at = Column(TZDateTime, default=utc_now, index=True)
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", back_populates="notes")
    notebook = relationship("Notebook", back_populates="notes")

    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_notes_user_notebook', 'user_id', 'notebook_id'),
        Index('ix_notes_user_pinned', 'user_id', 'is_pinned'),
        Index('ix_notes_user_archived', 'user_id', 'is_archived'),
        Index('ix_notes_user_trashed', 'user_id', 'is_trashed'),
        Index('ix_notes_user_updated', 'user_id', 'updated_at'),
    )

    def __repr__(self):
        return f"<Note(id={self.id}, title='{self.title[:30]}...')>"

    def to_dict(self, include_content=True):
        """Convert to dictionary for API responses"""
        result = {
            "id": self.id,
            "user_id": self.user_id,
            "notebook_id": self.notebook_id,
            "title": self.title,
            "is_pinned": self.is_pinned,
            "is_archived": self.is_archived,
            "is_trashed": self.is_trashed,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "template_id": self.template_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_content:
            result["content"] = self.content
            result["content_text"] = self.content_text
        # Add notebook title if available
        if self.notebook:
            result["notebook_title"] = self.notebook.title
        return result

    def get_preview(self, max_length=100):
        """Get a text preview of the note content"""
        if not self.content_text:
            return ""
        if len(self.content_text) <= max_length:
            return self.content_text
        return self.content_text[:max_length].rsplit(' ', 1)[0] + "..."
