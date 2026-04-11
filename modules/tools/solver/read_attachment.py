"""
Read Attachment Tool for AI Task Solver

Reads text content from PDF, TXT, or DOCX attachments linked to tasks.
Uses intelligent LLM summarization for long documents instead of hard truncation.
Summaries are cached in the database for instant subsequent reads.
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
from modules.tools.common.file_readers import read_file
from modules.tools.solver.content_compressor import get_or_create_summary

logger = logging.getLogger(__name__)


class ReadAttachmentInput(BaseModel):
    """Input schema for reading an attachment"""
    attachment_id: int = Field(..., description="ID of the attachment to read")


@tool("ReadAttachment", args_schema=ReadAttachmentInput)
def read_attachment(attachment_id: int, user_id: Optional[int] = None) -> str:
    """Read the text content of a file attachment (PDF, TXT, or DOCX) linked to a task."""
    db = SessionLocal()
    try:
        query = db.query(Resume).filter(Resume.id == attachment_id)
        if user_id:
            query = query.filter(Resume.user_id == user_id)
        attachment = query.first()

        if not attachment:
            return f"Error: Attachment with ID {attachment_id} not found."

        file_path = attachment.file_path
        if not file_path or not os.path.exists(file_path):
            return f"Error: File not found on disk for attachment '{attachment.original_filename}'."

        try:
            content = read_file(file_path, attachment.file_type)
        except ValueError as e:
            return f"Error: {e}"
        except Exception as e:
            return f"Error reading '{attachment.original_filename}': {str(e)}"

        # Intelligent compression: short content returned as-is, long content summarized
        result = get_or_create_summary(db, attachment, content)

        return f"=== {attachment.original_filename} ===\n{result}"

    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        db.close()
