"""
Get Todos Tool for Work Agent
"""
import os
import sys
from datetime import datetime, timedelta
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

# Add backend to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.todo import Todo


class GetTodosInput(BaseModel):
    """Input schema for getting todos"""
    date: Optional[str] = Field(default=None, description="Filter by specific date (YYYY-MM-DD) or 'today', 'tomorrow', 'this_week'")
    status: Optional[str] = Field(default=None, description="Filter by status: pending, in_progress, completed, all")
    priority: Optional[str] = Field(default=None, description="Filter by priority: low, medium, high, urgent")
    category: Optional[str] = Field(default=None, description="Filter by category")
    limit: Optional[int] = Field(default=20, description="Maximum number of todos to return")


@tool("GetTodos", args_schema=GetTodosInput)
def get_todos(
    date: Optional[str] = None,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 20,
    user_id: Optional[int] = None
) -> str:
    """
    Get todo items from the user's task list with optional filters.

    Use this tool to view tasks, check what needs to be done, or review completed items.
    Supports filtering by date, status, priority, and category.
    """
    db = SessionLocal()
    try:
        query = db.query(Todo).filter(Todo.user_id == (user_id or 1))

        # Date filtering
        if date:
            today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

            if date.lower() == "today":
                tomorrow = today + timedelta(days=1)
                query = query.filter(Todo.due_date >= today, Todo.due_date < tomorrow)
            elif date.lower() == "tomorrow":
                tomorrow = today + timedelta(days=1)
                day_after = today + timedelta(days=2)
                query = query.filter(Todo.due_date >= tomorrow, Todo.due_date < day_after)
            elif date.lower() == "this_week":
                week_end = today + timedelta(days=7)
                query = query.filter(Todo.due_date >= today, Todo.due_date < week_end)
            elif date.lower() == "overdue":
                query = query.filter(Todo.due_date < today, Todo.status != "completed")
            else:
                try:
                    target_date = datetime.strptime(date, "%Y-%m-%d")
                    next_day = target_date + timedelta(days=1)
                    query = query.filter(Todo.due_date >= target_date, Todo.due_date < next_day)
                except ValueError:
                    pass  # Invalid date format, skip filter

        # Status filtering
        if status and status.lower() != "all":
            query = query.filter(Todo.status == status.lower())
        elif not status:
            # By default, show non-completed todos
            query = query.filter(Todo.status.in_(["pending", "in_progress"]))

        # Priority filtering
        if priority:
            query = query.filter(Todo.priority == priority.lower())

        # Category filtering
        if category:
            query = query.filter(Todo.category == category)

        # Order by priority (urgent first) then due date
        priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
        todos = query.order_by(Todo.due_date.asc().nullslast()).limit(limit).all()

        # Sort by priority in Python (SQLite doesn't support CASE well)
        todos.sort(key=lambda t: (priority_order.get(t.priority, 2), t.due_date or datetime.max))

        if not todos:
            filter_desc = []
            if date:
                filter_desc.append(f"date={date}")
            if status:
                filter_desc.append(f"status={status}")
            if priority:
                filter_desc.append(f"priority={priority}")
            filter_str = f" (filters: {', '.join(filter_desc)})" if filter_desc else ""
            return f"📋 No todos found{filter_str}"

        # Format output
        priority_icons = {"low": "🟢", "medium": "🟡", "high": "🔴", "urgent": "🔥"}
        status_icons = {"pending": "⬜", "in_progress": "🔄", "completed": "✅", "cancelled": "❌"}

        lines = [f"📋 Todo List ({len(todos)} items):\n"]

        for todo in todos:
            status_icon = status_icons.get(todo.status, "⬜")
            priority_icon = priority_icons.get(todo.priority, "")

            # Format due date
            due_str = ""
            if todo.due_date:
                today = datetime.now().date()
                due_date = todo.due_date.date() if hasattr(todo.due_date, 'date') else todo.due_date

                if due_date < today and todo.status != "completed":
                    due_str = f" ⚠️ OVERDUE ({todo.due_date.strftime('%m/%d')})"
                elif due_date == today:
                    due_str = " 📅 Today"
                elif due_date == today + timedelta(days=1):
                    due_str = " 📅 Tomorrow"
                else:
                    due_str = f" 📅 {todo.due_date.strftime('%m/%d')}"

            line = f"{status_icon} {priority_icon} [{todo.id}] {todo.title}{due_str}"
            lines.append(line)

            if todo.description:
                # Truncate long descriptions
                desc = todo.description[:60] + "..." if len(todo.description) > 60 else todo.description
                lines.append(f"   └─ {desc}")

        return "\n".join(lines)

    except Exception as e:
        return f"Error getting todos: {str(e)}"
    finally:
        db.close()
