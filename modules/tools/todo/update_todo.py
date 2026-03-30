"""
Update Todo Tool for Work Agent
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


class UpdateTodoInput(BaseModel):
    """Input schema for updating a todo"""
    todo_id: int = Field(description="ID of the todo to update")
    title: Optional[str] = Field(default=None, description="New title")
    description: Optional[str] = Field(default=None, description="New description")
    due_date: Optional[str] = Field(default=None, description="New due date (YYYY-MM-DD or YYYY-MM-DD HH:MM)")
    priority: Optional[str] = Field(default=None, description="New priority: low, medium, high, urgent")
    status: Optional[str] = Field(default=None, description="New status: pending, in_progress, completed, cancelled")
    category: Optional[str] = Field(default=None, description="New category")


@tool("UpdateTodo", args_schema=UpdateTodoInput)
def update_todo(
    todo_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[int] = None
) -> str:
    """
    Update an existing todo item.

    Use this tool to modify a task's title, description, due date, priority, status, or category.
    Specify only the fields you want to change.
    """
    db = SessionLocal()
    try:
        todo = db.query(Todo).filter(
            Todo.id == todo_id,
            Todo.user_id == (user_id or 1)
        ).first()

        if not todo:
            return f"❌ Todo with ID {todo_id} not found"

        changes = []

        # Update fields if provided
        if title is not None:
            old_title = todo.title
            todo.title = title
            changes.append(f"title: '{old_title}' → '{title}'")

        if description is not None:
            todo.description = description
            changes.append("description updated")

        if due_date is not None:
            try:
                if due_date.lower() == "none" or due_date.lower() == "clear":
                    todo.due_date = None
                    changes.append("due date cleared")
                elif " " in due_date:
                    todo.due_date = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
                    changes.append(f"due date → {due_date}")
                else:
                    todo.due_date = datetime.strptime(due_date, "%Y-%m-%d")
                    changes.append(f"due date → {due_date}")
            except ValueError:
                return f"❌ Invalid date format: {due_date}. Use YYYY-MM-DD or YYYY-MM-DD HH:MM"

        if priority is not None:
            valid_priorities = ["low", "medium", "high", "urgent"]
            if priority.lower() not in valid_priorities:
                return f"❌ Invalid priority: {priority}. Use: {', '.join(valid_priorities)}"
            old_priority = todo.priority
            todo.priority = priority.lower()
            changes.append(f"priority: {old_priority} → {priority}")

        if status is not None:
            valid_statuses = ["pending", "in_progress", "completed", "cancelled"]
            if status.lower() not in valid_statuses:
                return f"❌ Invalid status: {status}. Use: {', '.join(valid_statuses)}"
            old_status = todo.status
            todo.status = status.lower()
            changes.append(f"status: {old_status} → {status}")

            # Set completed_at if marking as completed
            if status.lower() == "completed" and old_status != "completed":
                todo.completed_at = datetime.utcnow()

        if category is not None:
            todo.category = category if category.lower() != "none" else None
            changes.append(f"category → {category}")

        if not changes:
            return f"ℹ️ No changes specified for todo [{todo_id}]"

        db.commit()

        return f"✅ Updated todo [{todo_id}] '{todo.title}':\n   " + "\n   ".join(changes)

    except Exception as e:
        db.rollback()
        return f"Error updating todo: {str(e)}"
    finally:
        db.close()
