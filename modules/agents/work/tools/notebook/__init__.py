"""
NoteBook Tool for Work Agent

A simple notebook tool for creating, editing, and organizing notes with rich text formatting.
"""

from .api import router as notebook_router
from .schemas import (
    NotebookCreate,
    NotebookUpdate,
    NotebookResponse,
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteListResponse,
    TemplateResponse,
)
from .service import NotebookService

__all__ = [
    "notebook_router",
    "NotebookService",
    "NotebookCreate",
    "NotebookUpdate",
    "NotebookResponse",
    "NoteCreate",
    "NoteUpdate",
    "NoteResponse",
    "NoteListResponse",
    "TemplateResponse",
]
