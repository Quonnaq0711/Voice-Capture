"""
Pydantic schemas for NoteBook Tool API
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ==================== Notebook Schemas ====================

class NotebookCreate(BaseModel):
    """Request schema for creating a notebook."""
    title: str = Field(..., min_length=1, max_length=255, description="Notebook title")
    description: Optional[str] = Field(None, max_length=1000, description="Notebook description")
    color: Optional[str] = Field("#6366f1", description="Hex color for UI theming")
    icon: Optional[str] = Field("folder", description="Icon name (Heroicons)")


class NotebookUpdate(BaseModel):
    """Request schema for updating a notebook."""
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_order: Optional[int] = None


class NotebookResponse(BaseModel):
    """Response schema for notebook operations."""
    id: int
    user_id: int
    title: str
    description: Optional[str]
    color: str
    icon: str
    sort_order: int
    note_count: int = 0
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==================== Note Schemas ====================

class NoteCreate(BaseModel):
    """Request schema for creating a note."""
    title: str = Field(..., min_length=1, max_length=500, description="Note title")
    content: Optional[str] = Field(None, description="HTML content from rich text editor")
    notebook_id: Optional[int] = Field(None, description="Notebook ID to organize note into")
    template_id: Optional[str] = Field(None, description="Template ID used to create note")


class NoteUpdate(BaseModel):
    """Request schema for updating a note."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = None
    notebook_id: Optional[int] = None
    is_pinned: Optional[bool] = None
    is_archived: Optional[bool] = None


class NoteResponse(BaseModel):
    """Response schema for note operations."""
    id: int
    user_id: int
    notebook_id: Optional[int]
    notebook_title: Optional[str] = None
    title: str
    content: Optional[str]
    content_text: Optional[str]
    preview: Optional[str] = None
    is_pinned: bool
    is_archived: bool
    is_trashed: bool = False
    deleted_at: Optional[datetime] = None
    template_id: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class NoteListResponse(BaseModel):
    """Response schema for note list (without full content)."""
    id: int
    user_id: int
    notebook_id: Optional[int]
    notebook_title: Optional[str] = None
    title: str
    preview: str = ""
    is_pinned: bool
    is_archived: bool
    is_trashed: bool = False
    deleted_at: Optional[datetime] = None
    template_id: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


# ==================== Template Schemas ====================

class TemplateResponse(BaseModel):
    """Response schema for note template."""
    id: str
    name: str
    description: str
    icon: str
    content: str  # HTML template content


class TemplateListResponse(BaseModel):
    """Response schema for template list (without content)."""
    id: str
    name: str
    description: str
    icon: str
