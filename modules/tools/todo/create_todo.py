"""
Create Todo Tool for Work Agent
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


class CreateTodoInput(BaseModel):
    """Input schema for creating a todo"""
    title: str = Field(description="Title of the todo item (required)")
    description: Optional[str] = Field(default=None, description="Detailed description of the task")
    due_date: Optional[str] = Field(default=None, description="Due date in YYYY-MM-DD or YYYY-MM-DD HH:MM format")
    priority: Optional[str] = Field(default="medium", description="Priority level: low, medium, high, urgent")
    category: Optional[str] = Field(default=None, description="Category: work, personal, meeting_prep, etc.")


@tool("CreateTodo", args_schema=CreateTodoInput)
def create_todo(
    title: str,
    description: Optional[str] = None,
    due_date: Optional[str] = None,
    priority: str = "medium",
    category: Optional[str] = None,
    user_id: Optional[int] = None
) -> str:
    """
    Create a new todo item in the user's task list.

    Use this tool when the user wants to add a new task, reminder, or to-do item.
    Returns confirmation with the created todo's ID.
    """
    # Validate priority
    valid_priorities = ["low", "medium", "high", "urgent"]
    if priority not in valid_priorities:
        priority = "medium"

    # Parse due date
    parsed_due_date = None
    if due_date:
        try:
            # Try full datetime format first
            if " " in due_date:
                parsed_due_date = datetime.strptime(due_date, "%Y-%m-%d %H:%M")
            else:
                parsed_due_date = datetime.strptime(due_date, "%Y-%m-%d")
        except ValueError:
            return f"Error: Invalid date format '{due_date}'. Please use YYYY-MM-DD or YYYY-MM-DD HH:MM"

    db = SessionLocal()
    try:
        todo = Todo(
            user_id=user_id or 1,  # Default to user 1 for testing
            title=title,
            description=description,
            due_date=parsed_due_date,
            priority=priority,
            category=category,
            status="pending"
        )
        db.add(todo)
        db.commit()
        db.refresh(todo)

        # Format response
        response = f"✅ Created todo: '{title}' (ID: {todo.id})"
        if parsed_due_date:
            response += f"\n   📅 Due: {parsed_due_date.strftime('%Y-%m-%d %H:%M') if parsed_due_date.hour else parsed_due_date.strftime('%Y-%m-%d')}"
        if priority != "medium":
            priority_icons = {"low": "🟢", "medium": "🟡", "high": "🔴", "urgent": "🔥"}
            response += f"\n   {priority_icons.get(priority, '')} Priority: {priority}"
        if category:
            response += f"\n   📁 Category: {category}"

        return response

    except Exception as e:
        db.rollback()
        return f"Error creating todo: {str(e)}"
    finally:
        db.close()
