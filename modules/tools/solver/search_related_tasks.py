"""
Search Related Tasks Tool for AI Task Solver

Searches for tasks by keyword in title and description.
"""
import os
import sys
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.todo import Todo
from sqlalchemy import or_

MAX_RESULTS = 5


class SearchRelatedTasksInput(BaseModel):
    """Input schema for searching related tasks"""
    query: str = Field(..., description="Keyword to search in task titles and descriptions")


@tool("SearchRelatedTasks", args_schema=SearchRelatedTasksInput)
def search_related_tasks(query: str, user_id: Optional[int] = None) -> str:
    """Search for related tasks by keyword in titles and descriptions."""
    db = SessionLocal()
    try:
        q = db.query(Todo).filter(Todo.user_id == (user_id or 1))
        pattern = f"%{query}%"
        q = q.filter(
            or_(
                Todo.title.ilike(pattern),
                Todo.description.ilike(pattern),
            )
        )
        tasks = q.order_by(Todo.updated_at.desc()).limit(MAX_RESULTS).all()

        if not tasks:
            return f"No tasks found matching '{query}'."

        lines = [f"Found {len(tasks)} task(s) matching '{query}':"]
        for t in tasks:
            due = f", due {t.due_date.strftime('%Y-%m-%d')}" if t.due_date else ""
            lines.append(f"  [{t.id}] {t.title} ({t.status}, {t.priority}{due})")

        return "\n".join(lines)

    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        db.close()
