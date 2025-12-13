"""
Delete Todo Tool for Work Agent
"""
import os
import sys
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.todo import Todo


class DeleteTodoInput(BaseModel):
    """Input schema for deleting a todo"""
    todo_id: int = Field(description="ID of the todo to delete")
    confirm: bool = Field(default=True, description="Confirm deletion (default: True)")


@tool("DeleteTodo", args_schema=DeleteTodoInput)
def delete_todo(
    todo_id: int,
    confirm: bool = True,
    user_id: Optional[int] = None
) -> str:
    """
    Permanently delete a todo item.

    Use this tool to remove a task that is no longer needed.
    This action cannot be undone.
    """
    if not confirm:
        return f"❌ Deletion cancelled for todo [{todo_id}]. Set confirm=True to delete."

    db = SessionLocal()
    try:
        todo = db.query(Todo).filter(
            Todo.id == todo_id,
            Todo.user_id == (user_id or 1)
        ).first()

        if not todo:
            return f"❌ Todo with ID {todo_id} not found"

        title = todo.title
        db.delete(todo)
        db.commit()

        return f"🗑️ Deleted todo [{todo_id}]: '{title}'"

    except Exception as e:
        db.rollback()
        return f"Error deleting todo: {str(e)}"
    finally:
        db.close()
