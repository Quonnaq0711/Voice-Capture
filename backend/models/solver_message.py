"""
SolverMessage model for AI Solver conversation messages.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime


def utc_now():
    return datetime.now(timezone.utc)


class SolverMessage(Base):
    __tablename__ = "solver_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("solver_sessions.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(20), nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    quick_action = Column(String(50), nullable=True)  # e.g. 'suggest_approach', 'break_down'
    created_at = Column(TZDateTime, default=utc_now, index=True)

    # Relationships
    session = relationship("SolverSession", back_populates="messages")

    __table_args__ = (
        Index("ix_solver_messages_session_id", "session_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "role": self.role,
            "content": self.content,
            "quick_action": self.quick_action,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
