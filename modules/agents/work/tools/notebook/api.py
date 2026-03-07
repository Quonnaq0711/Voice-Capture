"""
FastAPI routes for NoteBook Tool
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.db.database import get_db
from .schemas import (
    NotebookCreate,
    NotebookUpdate,
    NotebookResponse,
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteListResponse,
    TemplateResponse,
    TemplateListResponse,
)
from .service import NotebookService


router = APIRouter()


def get_notebook_service(db: Session = Depends(get_db)) -> NotebookService:
    """Dependency to get NotebookService instance."""
    return NotebookService(db)


# ==================== Notebook Endpoints ====================

@router.get("/notebooks", response_model=List[NotebookResponse])
async def list_notebooks(
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """List all notebooks for a user."""
    notebooks = service.get_notebooks(user_id)
    return [
        NotebookResponse(
            id=nb.id,
            user_id=nb.user_id,
            title=nb.title,
            description=nb.description,
            color=nb.color,
            icon=nb.icon,
            sort_order=nb.sort_order,
            # Only count non-archived, non-trashed notes
            note_count=len([n for n in nb.notes if not n.is_archived and not getattr(n, 'is_trashed', False)]) if nb.notes else 0,
            created_at=nb.created_at,
            updated_at=nb.updated_at,
        )
        for nb in notebooks
    ]


@router.post("/notebooks", response_model=NotebookResponse)
async def create_notebook(
    data: NotebookCreate,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Create a new notebook."""
    notebook = service.create_notebook(
        user_id=user_id,
        title=data.title,
        description=data.description,
        color=data.color or "#6366f1",
        icon=data.icon or "folder",
    )
    return NotebookResponse(
        id=notebook.id,
        user_id=notebook.user_id,
        title=notebook.title,
        description=notebook.description,
        color=notebook.color,
        icon=notebook.icon,
        sort_order=notebook.sort_order,
        note_count=0,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
    )


@router.get("/notebooks/{notebook_id}", response_model=NotebookResponse)
async def get_notebook(
    notebook_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Get a specific notebook."""
    notebook = service.get_notebook(notebook_id, user_id)
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return NotebookResponse(
        id=notebook.id,
        user_id=notebook.user_id,
        title=notebook.title,
        description=notebook.description,
        color=notebook.color,
        icon=notebook.icon,
        sort_order=notebook.sort_order,
        note_count=len([n for n in notebook.notes if not n.is_archived and not getattr(n, 'is_trashed', False)]) if notebook.notes else 0,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
    )


@router.put("/notebooks/{notebook_id}", response_model=NotebookResponse)
async def update_notebook(
    notebook_id: int,
    data: NotebookUpdate,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Update a notebook."""
    notebook = service.update_notebook(
        notebook_id=notebook_id,
        user_id=user_id,
        title=data.title,
        description=data.description,
        color=data.color,
        icon=data.icon,
        sort_order=data.sort_order,
    )
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return NotebookResponse(
        id=notebook.id,
        user_id=notebook.user_id,
        title=notebook.title,
        description=notebook.description,
        color=notebook.color,
        icon=notebook.icon,
        sort_order=notebook.sort_order,
        note_count=len([n for n in notebook.notes if not n.is_archived and not getattr(n, 'is_trashed', False)]) if notebook.notes else 0,
        created_at=notebook.created_at,
        updated_at=notebook.updated_at,
    )


@router.delete("/notebooks/{notebook_id}")
async def delete_notebook(
    notebook_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Delete a notebook. Notes in this notebook will be moved to Inbox."""
    success = service.delete_notebook(notebook_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return {"success": True, "message": "Notebook deleted"}


@router.get("/stats")
async def get_notebook_stats(
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Get notebook statistics for sidebar display."""
    stats = service.get_stats(user_id)
    return stats


# ==================== Note Endpoints ====================

@router.get("/notes", response_model=List[NoteListResponse])
async def list_notes(
    user_id: int = Query(..., description="User ID"),
    notebook_id: Optional[int] = Query(None, description="Filter by notebook ID"),
    search: Optional[str] = Query(None, description="Search in title and content"),
    archived: bool = Query(False, description="Show archived notes"),
    trashed: bool = Query(False, description="Show trashed notes"),
    limit: int = Query(100, ge=1, le=500, description="Max notes to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    service: NotebookService = Depends(get_notebook_service)
):
    """List notes with optional filtering."""
    notes = service.get_notes(
        user_id=user_id,
        notebook_id=notebook_id,
        search=search,
        archived=archived,
        trashed=trashed,
        limit=limit,
        offset=offset,
    )
    return [
        NoteListResponse(
            id=note.id,
            user_id=note.user_id,
            notebook_id=note.notebook_id,
            notebook_title=note.notebook.title if note.notebook else None,
            title=note.title,
            preview=service.get_note_preview(note),
            is_pinned=note.is_pinned,
            is_archived=note.is_archived,
            is_trashed=note.is_trashed,
            deleted_at=note.deleted_at,
            template_id=note.template_id,
            created_at=note.created_at,
            updated_at=note.updated_at,
        )
        for note in notes
    ]


@router.post("/notes", response_model=NoteResponse)
async def create_note(
    data: NoteCreate,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Create a new note."""
    # If template_id is provided, get template content
    content = data.content
    if data.template_id and not content:
        template = service.get_template(data.template_id)
        if template:
            content = template.get("content", "")

    note = service.create_note(
        user_id=user_id,
        title=data.title,
        content=content,
        notebook_id=data.notebook_id,
        template_id=data.template_id,
    )
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        notebook_id=note.notebook_id,
        notebook_title=note.notebook.title if note.notebook else None,
        title=note.title,
        content=note.content,
        content_text=note.content_text,
        preview=service.get_note_preview(note),
        is_pinned=note.is_pinned,
        is_archived=note.is_archived,
        is_trashed=note.is_trashed,
        deleted_at=note.deleted_at,
        template_id=note.template_id,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.get("/notes/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Get a specific note."""
    note = service.get_note(note_id, user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        notebook_id=note.notebook_id,
        notebook_title=note.notebook.title if note.notebook else None,
        title=note.title,
        content=note.content,
        content_text=note.content_text,
        preview=service.get_note_preview(note),
        is_pinned=note.is_pinned,
        is_archived=note.is_archived,
        is_trashed=note.is_trashed,
        deleted_at=note.deleted_at,
        template_id=note.template_id,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.put("/notes/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    data: NoteUpdate,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Update a note."""
    note = service.update_note(
        note_id=note_id,
        user_id=user_id,
        title=data.title,
        content=data.content,
        notebook_id=data.notebook_id,
        is_pinned=data.is_pinned,
        is_archived=data.is_archived,
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        notebook_id=note.notebook_id,
        notebook_title=note.notebook.title if note.notebook else None,
        title=note.title,
        content=note.content,
        content_text=note.content_text,
        preview=service.get_note_preview(note),
        is_pinned=note.is_pinned,
        is_archived=note.is_archived,
        is_trashed=note.is_trashed,
        deleted_at=note.deleted_at,
        template_id=note.template_id,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Delete a note."""
    success = service.delete_note(note_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True, "message": "Note deleted"}


@router.post("/notes/{note_id}/pin", response_model=NoteResponse)
async def toggle_pin(
    note_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Toggle the pinned status of a note."""
    note = service.toggle_pin(note_id, user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        notebook_id=note.notebook_id,
        notebook_title=note.notebook.title if note.notebook else None,
        title=note.title,
        content=note.content,
        content_text=note.content_text,
        preview=service.get_note_preview(note),
        is_pinned=note.is_pinned,
        is_archived=note.is_archived,
        is_trashed=note.is_trashed,
        deleted_at=note.deleted_at,
        template_id=note.template_id,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.post("/notes/{note_id}/archive", response_model=NoteResponse)
async def toggle_archive(
    note_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Toggle the archived status of a note."""
    note = service.toggle_archive(note_id, user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        notebook_id=note.notebook_id,
        notebook_title=note.notebook.title if note.notebook else None,
        title=note.title,
        content=note.content,
        content_text=note.content_text,
        preview=service.get_note_preview(note),
        is_pinned=note.is_pinned,
        is_archived=note.is_archived,
        is_trashed=note.is_trashed,
        deleted_at=note.deleted_at,
        template_id=note.template_id,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


# ==================== Trash Endpoints ====================

@router.post("/notes/{note_id}/trash", response_model=NoteResponse)
async def move_to_trash(
    note_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Move a note to trash (soft delete)."""
    note = service.move_to_trash(note_id, user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        notebook_id=note.notebook_id,
        notebook_title=note.notebook.title if note.notebook else None,
        title=note.title,
        content=note.content,
        content_text=note.content_text,
        preview=service.get_note_preview(note),
        is_pinned=note.is_pinned,
        is_archived=note.is_archived,
        is_trashed=note.is_trashed,
        deleted_at=note.deleted_at,
        template_id=note.template_id,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.post("/notes/{note_id}/restore", response_model=NoteResponse)
async def restore_from_trash(
    note_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Restore a note from trash."""
    note = service.restore_from_trash(note_id, user_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found or not in trash")
    return NoteResponse(
        id=note.id,
        user_id=note.user_id,
        notebook_id=note.notebook_id,
        notebook_title=note.notebook.title if note.notebook else None,
        title=note.title,
        content=note.content,
        content_text=note.content_text,
        preview=service.get_note_preview(note),
        is_pinned=note.is_pinned,
        is_archived=note.is_archived,
        is_trashed=note.is_trashed,
        deleted_at=note.deleted_at,
        template_id=note.template_id,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.delete("/notes/{note_id}/permanent")
async def permanent_delete(
    note_id: int,
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Permanently delete a note from trash."""
    success = service.permanent_delete(note_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found or not in trash")
    return {"success": True, "message": "Note permanently deleted"}


@router.delete("/trash/empty")
async def empty_trash(
    user_id: int = Query(..., description="User ID"),
    service: NotebookService = Depends(get_notebook_service)
):
    """Empty trash - permanently delete all trashed notes."""
    count = service.empty_trash(user_id)
    return {"success": True, "message": f"Deleted {count} notes", "count": count}


# ==================== Template Endpoints ====================

@router.get("/templates", response_model=List[TemplateListResponse])
async def list_templates(
    service: NotebookService = Depends(get_notebook_service)
):
    """List available note templates."""
    templates = service.get_templates()
    return [
        TemplateListResponse(
            id=t["id"],
            name=t["name"],
            description=t["description"],
            icon=t["icon"],
        )
        for t in templates
    ]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(
    template_id: str,
    service: NotebookService = Depends(get_notebook_service)
):
    """Get a specific template with content."""
    template = service.get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return TemplateResponse(
        id=template["id"],
        name=template["name"],
        description=template["description"],
        icon=template["icon"],
        content=template["content"],
    )
