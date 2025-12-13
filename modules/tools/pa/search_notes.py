"""
Search Notes Tool for Personal Assistant

Searches the user's notes by keyword (title and plain-text content).
"""
import os
import sys
import logging
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.note import Note

logger = logging.getLogger(__name__)

MAX_PREVIEW = 150


class SearchNotesInput(BaseModel):
    """Input schema for searching notes"""
    query: str = Field(..., description="Keyword to search in note titles and content")
    limit: Optional[int] = Field(default=10, description="Maximum number of notes to return")


@tool("SearchNotes", args_schema=SearchNotesInput)
def search_notes(query: str, limit: int = 10, user_id: Optional[int] = None) -> str:
    """Search the user's notes by keyword. Returns matching note titles and previews."""
    db = SessionLocal()
    try:
        pattern = f"%{query}%"
        notes = (
            db.query(Note)
            .filter(
                Note.user_id == (user_id or 1),
                Note.is_trashed == False,
                (Note.title.ilike(pattern) | Note.content_text.ilike(pattern)),
            )
            .order_by(Note.updated_at.desc())
            .limit(limit)
            .all()
        )

        if not notes:
            return f"No notes found matching '{query}'."

        lines = [f"Notes matching '{query}' ({len(notes)} found):\n"]
        for n in notes:
            date = n.updated_at.strftime('%Y-%m-%d') if n.updated_at else ""
            preview = n.get_preview(MAX_PREVIEW)
            lines.append(f"  [{n.id}] {n.title} ({date})")
            if preview:
                lines.append(f"      {preview}")

        return "\n".join(lines)

    except Exception as e:
        return f"Error searching notes: {str(e)}"
    finally:
        db.close()
