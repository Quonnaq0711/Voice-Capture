"""
Read Document Tool for Personal Assistant

Reads text content from a user document (PDF, DOCX, TXT) by its ID.
Uses intelligent LLM summarization for long documents, with DB caching.
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


class ReadDocumentInput(BaseModel):
    """Input schema for reading a document"""
    document_id: int = Field(..., description="ID of the document to read (from GetUserDocuments)")


@tool("ReadDocument", args_schema=ReadDocumentInput)
def read_document(document_id: int, user_id: Optional[int] = None) -> str:
    """Read the text content of a user document (PDF, DOCX, or TXT) by its ID."""
    db = SessionLocal()
    try:
        query = db.query(Resume).filter(Resume.id == document_id)
        if user_id:
            query = query.filter(Resume.user_id == user_id)
        doc = query.first()

        if not doc:
            return f"Error: Document with ID {document_id} not found."

        if not doc.file_path or not os.path.exists(doc.file_path):
            return f"Error: File not found on disk for '{doc.original_filename}'."

        try:
            content = read_file(doc.file_path, doc.file_type)
        except ValueError as e:
            return f"Error: {e}"
        except Exception as e:
            return f"Error reading '{doc.original_filename}': {str(e)}"

        result = get_or_create_summary(db, doc, content)
        return f"=== {doc.original_filename} ===\n{result}"

    except Exception as e:
        return f"Error: {str(e)}"
    finally:
        db.close()
