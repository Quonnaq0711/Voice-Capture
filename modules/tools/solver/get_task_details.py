"""
Get Task Details Tool for AI Task Solver

Retrieves full details of a specific task by ID.
"""
import os
import sys
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.todo import Todo


class GetTaskDetailsInput(BaseModel):
    """Input schema for getting task details"""
    task_id: int = Field(..., description="ID of the task to get full details for")


@tool("GetTaskDetails", args_schema=GetTaskDetailsInput)
def get_task_details(task_id: int, user_id: Optional[int] = None) -> str:
    """Get the full details of a task by its ID."""
    db = SessionLocal()
    try:
        query = db.query(Todo).filter(Todo.id == task_id)
        if user_id:
            query = query.filter(Todo.user_id == user_id)
        task = query.first()

        if not task:
            return f"Error: Task with ID {task_id} not found."

        parts = [
            f"Task [{task.id}]: {task.title}",
            f"Status: {task.status or 'none'}",
            f"Priority: {task.priority or 'none'}",
        ]

        if task.description:
            desc = task.description[:500]
            if len(task.description) > 500:
                desc += "... [truncated]"
            parts.append(f"Description: {desc}")

        if task.ai_summary:
            bullets = task.ai_summary if isinstance(task.ai_summary, list) else []
            if bullets:
                parts.append("AI Summary:\n" + "\n".join(f"  - {b}" for b in bullets))

        if task.due_date:
            parts.append(f"Due Date: {task.due_date.strftime('%Y-%m-%d')}")
        if task.category:
            parts.append(f"Category: {task.category}")
        if task.ai_estimated_minutes:
            parts.append(f"Estimated Duration: {task.ai_estimated_minutes} minutes")
        if task.ai_priority_reasoning:
            parts.append(f"AI Priority Reasoning: {task.ai_priority_reasoning}")
        if task.created_at:
            parts.append(f"Created: {task.created_at.strftime('%Y-%m-%d %H:%M')}")

        return "\n".join(parts)

    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        db.close()
