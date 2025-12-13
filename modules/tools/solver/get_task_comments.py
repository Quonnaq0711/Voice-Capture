"""
Get Task Comments Tool for AI Task Solver

Retrieves comments on a task, ordered by creation time.
"""
import os
import sys
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.todo_comment import TodoComment
from backend.models.todo import Todo

MAX_COMMENTS_OUTPUT = 2000


class GetTaskCommentsInput(BaseModel):
    """Input schema for getting task comments"""
    task_id: int = Field(..., description="ID of the task to get comments for")


@tool("GetTaskComments", args_schema=GetTaskCommentsInput)
def get_task_comments(task_id: int, user_id: Optional[int] = None) -> str:
    """Get all comments on a task, ordered by date."""
    db = SessionLocal()
    try:
        # Verify task ownership
        task_query = db.query(Todo).filter(Todo.id == task_id)
        if user_id:
            task_query = task_query.filter(Todo.user_id == user_id)
        task = task_query.first()
        if not task:
            return f"Error: Task with ID {task_id} not found."

        comments = (
            db.query(TodoComment)
            .filter(TodoComment.todo_id == task_id)
            .order_by(TodoComment.created_at)
            .all()
        )

        if not comments:
            return f"No comments on task [{task_id}] '{task.title}'."

        lines = [f"Comments on task [{task_id}] '{task.title}' ({len(comments)} total):"]
        for c in comments:
            date_str = c.created_at.strftime('%Y-%m-%d %H:%M') if c.created_at else ''
            content = c.content[:200] if c.content else ''
            lines.append(f"  [{date_str}]: {content}")

        result = "\n".join(lines)
        if len(result) > MAX_COMMENTS_OUTPUT:
            result = result[:MAX_COMMENTS_OUTPUT] + "\n[... truncated]"
        return result

    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        db.close()
