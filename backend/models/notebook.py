"""
Notebook model for organizing notes into folders/collections
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime


def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)


class Notebook(Base):
    """
    Notebook for organizing notes into folders/collections.

    Each user can have multiple notebooks to organize their notes.
    Notes can optionally belong to a notebook, or exist in "Inbox" (no notebook).
    """
    __tablename__ = "notebooks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    # Core fields
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    # Styling
    color = Column(String(20), default="#6366f1")  # Hex color for UI theming
    icon = Column(String(50), default="folder")     # Icon name (Heroicons)

    # Ordering
    sort_order = Column(Integer, default=0)

    # Timestamps
    created_at = Column(TZDateTime, default=utc_now, index=True)
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", back_populates="notebooks")
    notes = relationship("Note", back_populates="notebook", cascade="all, delete-orphan")

    # Composite indexes for common queries
    __table_args__ = (
        Index('ix_notebooks_user_sort', 'user_id', 'sort_order'),
    )

    def __repr__(self):
        return f"<Notebook(id={self.id}, title='{self.title}')>"

    def to_dict(self, include_note_count=False):
        """Convert to dictionary for API responses"""
        result = {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "description": self.description,
            "color": self.color,
            "icon": self.icon,
            "sort_order": self.sort_order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_note_count:
            result["note_count"] = len(self.notes) if self.notes else 0
        return result
