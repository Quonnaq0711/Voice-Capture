"""
NoteBook Service - Business logic for notebook operations
"""
import os
import json
import re
from typing import List, Optional
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import desc, or_, func

from backend.models.notebook import Notebook
from backend.models.note import Note


class NotebookService:
    """Service class for notebook and note operations."""

    def __init__(self, db: Session):
        self.db = db
        self._templates_dir = os.path.join(os.path.dirname(__file__), "templates")

    # ==================== Notebook Operations ====================

    def get_notebooks(self, user_id: int) -> List[Notebook]:
        """Get all notebooks for a user, ordered by sort_order.

        Uses selectinload to eagerly load notes for count calculation.
        """
        return (
            self.db.query(Notebook)
            .options(selectinload(Notebook.notes))
            .filter(Notebook.user_id == user_id)
            .order_by(Notebook.sort_order, Notebook.created_at)
            .all()
        )

    def get_notebook(self, notebook_id: int, user_id: int) -> Optional[Notebook]:
        """Get a specific notebook by ID."""
        return (
            self.db.query(Notebook)
            .filter(Notebook.id == notebook_id, Notebook.user_id == user_id)
            .first()
        )

    def create_notebook(self, user_id: int, title: str, description: str = None,
                        color: str = "#6366f1", icon: str = "folder") -> Notebook:
        """Create a new notebook."""
        # Get max sort_order for user
        max_order = (
            self.db.query(Notebook.sort_order)
            .filter(Notebook.user_id == user_id)
            .order_by(desc(Notebook.sort_order))
            .first()
        )
        sort_order = (max_order[0] + 1) if max_order else 0

        notebook = Notebook(
            user_id=user_id,
            title=title,
            description=description,
            color=color,
            icon=icon,
            sort_order=sort_order,
        )
        self.db.add(notebook)
        self.db.commit()
        self.db.refresh(notebook)
        return notebook

    def update_notebook(self, notebook_id: int, user_id: int, **kwargs) -> Optional[Notebook]:
        """Update a notebook. Only provided fields will be updated."""
        notebook = self.get_notebook(notebook_id, user_id)
        if not notebook:
            return None

        for key, value in kwargs.items():
            if value is not None and hasattr(notebook, key):
                setattr(notebook, key, value)

        self.db.commit()
        self.db.refresh(notebook)
        return notebook

    def delete_notebook(self, notebook_id: int, user_id: int) -> bool:
        """Delete a notebook. Notes will have notebook_id set to NULL."""
        notebook = self.get_notebook(notebook_id, user_id)
        if not notebook:
            return False

        self.db.delete(notebook)
        self.db.commit()
        return True

    def get_stats(self, user_id: int) -> dict:
        """Get statistics for notebooks sidebar display.

        Returns counts for:
        - all_notes: Total non-archived, non-trashed notes
        - archived: Total archived notes
        - trashed: Total trashed notes
        """
        # Count all non-archived, non-trashed notes (for "All Notes" view)
        all_notes_count = (
            self.db.query(func.count(Note.id))
            .filter(
                Note.user_id == user_id,
                Note.is_archived == False,
                Note.is_trashed == False,
            )
            .scalar()
        ) or 0

        # Count archived (non-trashed) notes
        archived_count = (
            self.db.query(func.count(Note.id))
            .filter(
                Note.user_id == user_id,
                Note.is_archived == True,
                Note.is_trashed == False,
            )
            .scalar()
        ) or 0

        # Count trashed notes
        trashed_count = (
            self.db.query(func.count(Note.id))
            .filter(
                Note.user_id == user_id,
                Note.is_trashed == True,
            )
            .scalar()
        ) or 0

        return {
            "all_notes": all_notes_count,
            "archived": archived_count,
            "trashed": trashed_count,
        }

    # ==================== Note Operations ====================

    def get_notes(self, user_id: int, notebook_id: int = None, search: str = None,
                  archived: bool = False, trashed: bool = False,
                  limit: int = 100, offset: int = 0) -> List[Note]:
        """Get notes for a user with optional filtering.

        Uses selectinload to eagerly load notebook relationship for notebook_title.
        By default, excludes trashed notes unless trashed=True.
        """
        query = (
            self.db.query(Note)
            .options(selectinload(Note.notebook))
            .filter(Note.user_id == user_id)
        )

        # Filter by notebook (only if not viewing trash)
        if notebook_id is not None and not trashed:
            query = query.filter(Note.notebook_id == notebook_id)

        # Filter by trashed status
        query = query.filter(Note.is_trashed == trashed)

        # Filter by archived status (only when not in trash view)
        if not trashed:
            query = query.filter(Note.is_archived == archived)

        # Search in title and content_text
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Note.title.ilike(search_term),
                    Note.content_text.ilike(search_term)
                )
            )

        # Order: for trash, order by deleted_at desc; otherwise pinned first, then updated_at
        if trashed:
            query = query.order_by(desc(Note.deleted_at))
        else:
            query = query.order_by(desc(Note.is_pinned), desc(Note.updated_at))

        return query.offset(offset).limit(limit).all()

    def get_note(self, note_id: int, user_id: int) -> Optional[Note]:
        """Get a specific note by ID with notebook relationship loaded."""
        return (
            self.db.query(Note)
            .options(selectinload(Note.notebook))
            .filter(Note.id == note_id, Note.user_id == user_id)
            .first()
        )

    def create_note(self, user_id: int, title: str, content: str = None,
                    notebook_id: int = None, template_id: str = None) -> Note:
        """Create a new note."""
        # Extract plain text from HTML content for search
        content_text = self._extract_text_from_html(content) if content else None

        note = Note(
            user_id=user_id,
            notebook_id=notebook_id,
            title=title,
            content=content,
            content_text=content_text,
            template_id=template_id,
        )
        self.db.add(note)
        self.db.commit()
        self.db.refresh(note)
        return note

    def update_note(self, note_id: int, user_id: int, **kwargs) -> Optional[Note]:
        """Update a note. Only provided fields will be updated."""
        note = self.get_note(note_id, user_id)
        if not note:
            return None

        # If content is being updated, also update content_text
        if "content" in kwargs and kwargs["content"] is not None:
            kwargs["content_text"] = self._extract_text_from_html(kwargs["content"])

        for key, value in kwargs.items():
            if value is not None and hasattr(note, key):
                setattr(note, key, value)

        self.db.commit()
        self.db.refresh(note)
        return note

    def delete_note(self, note_id: int, user_id: int) -> bool:
        """Delete a note."""
        note = self.get_note(note_id, user_id)
        if not note:
            return False

        self.db.delete(note)
        self.db.commit()
        return True

    def toggle_pin(self, note_id: int, user_id: int) -> Optional[Note]:
        """Toggle the pinned status of a note."""
        note = self.get_note(note_id, user_id)
        if not note:
            return None

        note.is_pinned = not note.is_pinned
        self.db.commit()
        self.db.refresh(note)
        return note

    def toggle_archive(self, note_id: int, user_id: int) -> Optional[Note]:
        """Toggle the archived status of a note."""
        note = self.get_note(note_id, user_id)
        if not note:
            return None

        note.is_archived = not note.is_archived
        # Unpin when archiving
        if note.is_archived:
            note.is_pinned = False
        self.db.commit()
        self.db.refresh(note)
        return note

    # ==================== Trash Operations ====================

    def move_to_trash(self, note_id: int, user_id: int) -> Optional[Note]:
        """Move a note to trash (soft delete).

        Following notesnook's pattern:
        - Sets is_trashed = True
        - Records deleted_at timestamp
        - Unpins the note
        """
        from datetime import datetime, timezone

        note = self.get_note(note_id, user_id)
        if not note:
            return None

        note.is_trashed = True
        note.deleted_at = datetime.now(timezone.utc)
        note.is_pinned = False  # Unpin when trashing
        self.db.commit()
        self.db.refresh(note)
        return note

    def restore_from_trash(self, note_id: int, user_id: int) -> Optional[Note]:
        """Restore a note from trash.

        Following notesnook's pattern:
        - Sets is_trashed = False
        - Clears deleted_at
        - Note returns to its original notebook (or Inbox if notebook was deleted)
        """
        note = self.get_note(note_id, user_id)
        if not note or not note.is_trashed:
            return None

        note.is_trashed = False
        note.deleted_at = None
        self.db.commit()
        self.db.refresh(note)
        return note

    def permanent_delete(self, note_id: int, user_id: int) -> bool:
        """Permanently delete a note from trash.

        This is the actual deletion - note is removed from database.
        Only works on notes that are already in trash.
        """
        note = self.get_note(note_id, user_id)
        if not note or not note.is_trashed:
            return False

        self.db.delete(note)
        self.db.commit()
        return True

    def empty_trash(self, user_id: int) -> int:
        """Permanently delete all notes in trash.

        Returns the number of notes deleted.
        """
        notes = (
            self.db.query(Note)
            .filter(Note.user_id == user_id, Note.is_trashed == True)
            .all()
        )
        count = len(notes)
        for note in notes:
            self.db.delete(note)
        self.db.commit()
        return count

    # ==================== Template Operations ====================

    def get_templates(self) -> List[dict]:
        """Get list of available templates (without content)."""
        templates = []
        if not os.path.exists(self._templates_dir):
            return templates

        for filename in os.listdir(self._templates_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self._templates_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        template = json.load(f)
                        templates.append({
                            "id": template.get("id"),
                            "name": template.get("name"),
                            "description": template.get("description"),
                            "icon": template.get("icon"),
                        })
                except (json.JSONDecodeError, IOError):
                    continue

        return templates

    def get_template(self, template_id: str) -> Optional[dict]:
        """Get a specific template by ID."""
        filepath = os.path.join(self._templates_dir, f"{template_id}.json")
        if not os.path.exists(filepath):
            return None

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return None

    # ==================== Helper Methods ====================

    def _extract_text_from_html(self, html: str) -> str:
        """Extract plain text from HTML content for search indexing."""
        if not html:
            return ""
        # Remove HTML tags
        text = re.sub(r'<[^>]+>', ' ', html)
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def get_note_preview(self, note: Note, max_length: int = 100) -> str:
        """Get a preview of the note content."""
        if not note.content_text:
            return ""
        if len(note.content_text) <= max_length:
            return note.content_text
        return note.content_text[:max_length].rsplit(' ', 1)[0] + "..."
