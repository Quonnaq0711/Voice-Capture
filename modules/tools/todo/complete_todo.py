"""
Complete Todo Tool for Work Agent
"""
import os
import sys
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.todo import Todo


class CompleteTodoInput(BaseModel):
    """Input schema for completing a todo"""
    todo_id: int = Field(description="ID of the todo to mark as completed")


@tool("CompleteTodo", args_schema=CompleteTodoInput)
def complete_todo(
    todo_id: int,
    user_id: Optional[int] = None
) -> str:
    """
    Mark a todo item as completed.

    Use this tool when a task has been finished.
    Sets the status to 'completed' and records the completion time.
    """
    db = SessionLocal()
    try:
        todo = db.query(Todo).filter(
            Todo.id == todo_id,
            Todo.user_id == (user_id or 1)
        ).first()

        if not todo:
            return f"❌ Todo with ID {todo_id} not found"

        if todo.status == "completed":
            return f"ℹ️ Todo [{todo_id}] '{todo.title}' is already completed"

        old_status = todo.status
        todo.status = "completed"
        todo.completed_at = datetime.utcnow()

        db.commit()

        return f"✅ Completed: '{todo.title}' (was: {old_status})"

    except Exception as e:
        db.rollback()
        return f"Error completing todo: {str(e)}"
    finally:
        db.close()
