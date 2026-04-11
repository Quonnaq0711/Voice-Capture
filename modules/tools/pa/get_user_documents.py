"""
Get User Documents Tool for Personal Assistant

Lists all documents (resumes and task attachments) for the current user.
Returns metadata only — use ReadDocument to read actual content.
"""
import os
import sys
import logging
from typing import Optional

from pydantic import BaseModel, Field
from langchain_core.tools import tool

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')))

from backend.db.database import SessionLocal
from backend.models.resume import Resume

logger = logging.getLogger(__name__)


class GetUserDocumentsInput(BaseModel):
    """Input schema for listing user documents"""
    file_type: Optional[str] = Field(default=None, description="Filter by file type: pdf, docx, txt")
    limit: Optional[int] = Field(default=20, description="Maximum number of documents to return")


@tool("GetUserDocuments", args_schema=GetUserDocumentsInput)
def get_user_documents(
    file_type: Optional[str] = None,
    limit: int = 20,
    user_id: Optional[int] = None,
) -> str:
    """List all documents uploaded by the user (resumes and task attachments). Returns metadata — use ReadDocument to read content."""
    db = SessionLocal()
    try:
        query = db.query(Resume).filter(Resume.user_id == (user_id or 1))

        if file_type:
            query = query.filter(Resume.file_type == file_type.lower().strip('.'))

        docs = query.order_by(Resume.created_at.desc()).limit(limit).all()

        if not docs:
            return "No documents found."

        lines = [f"Documents ({len(docs)} found):\n"]
        for d in docs:
            size = f"{d.file_size} bytes" if d.file_size else "unknown size"
            task_info = f", task #{d.todo_id}" if d.todo_id else ""
            date = d.created_at.strftime('%Y-%m-%d') if d.created_at else "unknown date"
            lines.append(f"  [ID:{d.id}] {d.original_filename} ({d.file_type}, {size}{task_info}, uploaded {date})")

        return "\n".join(lines)

    except Exception as e:
        return f"Error listing documents: {str(e)}"
    finally:
        db.close()
