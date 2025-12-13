"""
TodoComment model for task comments
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime


def utc_now():
    return datetime.now(timezone.utc)


class TodoComment(Base):
    __tablename__ = "todo_comments"

    id = Column(Integer, primary_key=True, index=True)
    todo_id = Column(Integer, ForeignKey("todos.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(TZDateTime, default=utc_now, index=True)

    # Relationships
    todo = relationship("Todo", back_populates="comments")
    user = relationship("User")

    __table_args__ = (
        Index('ix_todo_comments_todo_id', 'todo_id'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "todo_id": self.todo_id,
            "user_id": self.user_id,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
