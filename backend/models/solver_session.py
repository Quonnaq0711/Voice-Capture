"""
SolverSession model for AI Solver conversation persistence per task.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime


def utc_now():
    return datetime.now(timezone.utc)


class SolverSession(Base):
    __tablename__ = "solver_sessions"

    id = Column(Integer, primary_key=True, index=True)
    todo_id = Column(Integer, ForeignKey("todos.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False, default="New conversation")
    created_at = Column(TZDateTime, default=utc_now, index=True)
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    todo = relationship("Todo", back_populates="solver_sessions")
    messages = relationship(
        "SolverMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="SolverMessage.created_at",
    )

    __table_args__ = (
        Index("ix_solver_sessions_todo_id", "todo_id"),
        Index("ix_solver_sessions_user_id", "user_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "todo_id": self.todo_id,
            "user_id": self.user_id,
            "title": self.title,
            "message_count": len(self.messages) if self.messages else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
