"""
Work Agent API Endpoints.

Provides REST API for:
- Chat with the Work Assistant
- Direct Todo CRUD operations
"""
import os
import sys
import re
import html as html_module
import json
import logging
import asyncio
import time
import math
from dataclasses import dataclass, field
from typing import Optional, List, Set, Dict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Body, UploadFile, File
from fastapi.responses import StreamingResponse, FileResponse
from sse_starlette.sse import EventSourceResponse
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

# Add paths
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

from backend.db.database import get_db
from backend.models.todo import Todo
from backend.models.todo_comment import TodoComment
from backend.models.resume import Resume
from backend.models.solver_session import SolverSession
from backend.models.solver_message import SolverMessage
from backend.models.extracted_task import ExtractedTask as ExtractedTaskModel, ProcessedSource
from modules.agents.work.src.schemas import (
    ChatRequest, ChatResponse, TodoCreate, TodoUpdate, TodoResponse, HealthResponse,
    TaskExtractRequest, TaskExtractResponse, ExtractedTask, SyncStatusResponse,
    TaskPrioritizeRequest, TaskPrioritizeResponse, ApplyPrioritiesRequest, ApplyPrioritiesResponse,
    PrioritizedTask, ScheduledTask, CalendarEvent, PrioritizationWarning, PrioritizationSummary,
    ReorderRequest, CommentCreate, CommentResponse,
    TaskSolverChatRequest,
    SolverSessionCreate, SolverSessionRename,
    AttachmentResponse,
    TaskScheduleRequest, TaskScheduleResponse, ScheduledEventResult,
    ScheduleSlot, TaskSchedulePreviewResponse,
    TaskScheduleAcceptRequest, TaskScheduleAcceptResponse,
    TaskSchedulePushRequest, TaskScheduleUnacceptRequest, ScheduledTaskEvent,
    TaskUnscheduleRequest,
)
from pydantic import BaseModel, Field, validator
from modules.agents.work.src.agents.work_assistant import WorkAssistant
from modules.agents.work.src.services.email_filter import filter_emails_for_extraction

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/work", tags=["work"])

# Cache for WorkAssistant instances per user
_assistants = {}

# Background extraction tracking (per-user)
# Stores: {user_id: {"status": "running"|"done"|"error", "progress": str, "started_at": float}}
_bg_extraction: Dict[int, Dict] = {}


def get_work_assistant(user_id: int = 1) -> WorkAssistant:
    """Get or create a WorkAssistant instance for a user."""
    if user_id not in _assistants:
        _assistants[user_id] = WorkAssistant(user_id=user_id)
    return _assistants[user_id]


# ==================== Chat Endpoints ====================

@router.post("/chat/message", response_model=ChatResponse)
async def send_message(
    request: ChatRequest,
    user_id: int = Query(default=1, description="User ID"),
):
    """
    Send a message to the Work Assistant.

    The assistant can help with:
    - Managing todos (create, view, update, delete, complete)
    - Planning your day
    - Task prioritization
    """
    try:
        assistant = get_work_assistant(user_id)
        response = assistant.chat(request.message)

        return ChatResponse(
            response=response,
            session_id=request.session_id or assistant.thread_id,
            status="success"
        )
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/message/stream")
async def send_message_stream(
    message: str = Query(..., description="User's message"),
    user_id: int = Query(default=1, description="User ID"),
):
    """
    Stream responses from the Work Assistant.

    Returns Server-Sent Events (SSE) with the response chunks.
    """
    try:
        assistant = get_work_assistant(user_id)

        async def event_generator():
            try:
                for chunk in assistant.stream_chat(message):
                    yield {
                        "event": "message",
                        "data": json.dumps(chunk, default=str)
                    }
                yield {"event": "done", "data": ""}
            except Exception as e:
                logger.error(f"Streaming error: {str(e)}")
                yield {"event": "error", "data": json.dumps({"error": str(e)})}

        return EventSourceResponse(event_generator())

    except Exception as e:
        logger.error(f"Error setting up stream: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Todo CRUD Endpoints ====================

@router.get("/todos", response_model=List[TodoResponse])
async def get_todos(
    user_id: int = Query(default=1, description="User ID"),
    status: Optional[str] = Query(None, description="Filter by status"),
    priority: Optional[str] = Query(None, description="Filter by priority"),
    date: Optional[str] = Query(None, description="Filter by due date (YYYY-MM-DD, today, tomorrow, this_week)"),
    sort: Optional[str] = Query(None, description="Sort order: 'prioritized' for AI order, default is by due_date"),
    limit: int = Query(default=50, le=100, description="Maximum results"),
    db: Session = Depends(get_db)
):
    """
    Get user's todos with optional filters.

    Filters:
    - status: none, todo, in_progress, review, done, delayed
    - priority: low, medium, high, urgent
    - date: YYYY-MM-DD, today, tomorrow, this_week, overdue
    - sort: 'prioritized' to order by AI-suggested order
    """
    query = db.query(Todo).filter(Todo.user_id == user_id)

    if status:
        query = query.filter(Todo.status == status)

    if priority:
        query = query.filter(Todo.priority == priority)

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
            query = query.filter(Todo.due_date < today, Todo.status != "done")
        else:
            try:
                target_date = datetime.strptime(date, "%Y-%m-%d")
                next_day = target_date + timedelta(days=1)
                query = query.filter(Todo.due_date >= target_date, Todo.due_date < next_day)
            except ValueError:
                pass

    # Sort order
    if sort == "prioritized":
        query = query.order_by(Todo.ai_suggested_order.asc().nullslast(), Todo.due_date.asc().nullslast())
    else:
        query = query.order_by(Todo.due_date.asc().nullslast())

    todos = query.limit(limit).all()
    return todos


@router.post("/todos", response_model=TodoResponse)
async def create_todo(
    todo: TodoCreate,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Create a new todo item."""
    try:
        # Parse due date
        due_date = None
        if todo.due_date:
            try:
                if " " in todo.due_date:
                    due_date = datetime.strptime(todo.due_date, "%Y-%m-%d %H:%M")
                else:
                    due_date = datetime.strptime(todo.due_date, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD or YYYY-MM-DD HH:MM")

        db_todo = Todo(
            user_id=user_id,
            title=todo.title,
            description=todo.description,
            due_date=due_date,
            priority=todo.priority or "none",
            category=todo.category,
            status=todo.status or "todo"
        )
        db.add(db_todo)
        db.commit()
        db.refresh(db_todo)

        return db_todo

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating todo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/todos/{todo_id}", response_model=TodoResponse)
async def get_todo(
    todo_id: int,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Get a specific todo by ID."""
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@router.put("/todos/{todo_id}", response_model=TodoResponse)
async def update_todo(
    todo_id: int,
    todo_update: TodoUpdate,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Update a todo item."""
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    try:
        if todo_update.title is not None:
            todo.title = todo_update.title
        if todo_update.description is not None:
            todo.description = todo_update.description
        if todo_update.priority is not None:
            todo.priority = todo_update.priority
        if todo_update.category is not None:
            todo.category = todo_update.category

        if todo_update.due_date is not None:
            if todo_update.due_date.lower() in ["none", "clear", ""]:
                todo.due_date = None
            else:
                try:
                    if " " in todo_update.due_date:
                        todo.due_date = datetime.strptime(todo_update.due_date, "%Y-%m-%d %H:%M")
                    else:
                        todo.due_date = datetime.strptime(todo_update.due_date, "%Y-%m-%d")
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid date format")

        if todo_update.status is not None:
            old_status = todo.status
            todo.status = todo_update.status
            if todo_update.status == "done" and old_status != "done":
                todo.completed_at = datetime.now(timezone.utc)
            elif todo_update.status != "done" and old_status == "done":
                todo.completed_at = None

        db.commit()
        db.refresh(todo)
        return todo

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating todo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/todos/{todo_id}")
async def delete_todo(
    todo_id: int,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Delete a todo item."""
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    try:
        # Detach attachments (SET NULL) — done in app layer because SQLite
        # doesn't enforce ON DELETE SET NULL without PRAGMA foreign_keys=ON
        db.query(Resume).filter(Resume.todo_id == todo_id).update(
            {Resume.todo_id: None}, synchronize_session="fetch"
        )
        db.delete(todo)
        db.commit()
        return {"status": "success", "message": f"Todo {todo_id} deleted"}
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting todo: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/todos/{todo_id}/comments", response_model=List[CommentResponse])
async def get_comments(
    todo_id: int,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Get all comments for a todo."""
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    comments = db.query(TodoComment).filter(TodoComment.todo_id == todo_id).order_by(TodoComment.created_at.asc()).all()
    return [CommentResponse.model_validate(c) for c in comments]


@router.post("/todos/{todo_id}/comments", response_model=CommentResponse)
async def add_comment(
    todo_id: int,
    body: CommentCreate,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Add a comment to a todo."""
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    comment = TodoComment(todo_id=todo_id, user_id=user_id, content=body.content)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentResponse.model_validate(comment)


@router.delete("/todos/{todo_id}/comments/{comment_id}")
async def delete_comment(
    todo_id: int,
    comment_id: int,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Delete a comment."""
    comment = db.query(TodoComment).filter(
        TodoComment.id == comment_id,
        TodoComment.todo_id == todo_id,
        TodoComment.user_id == user_id
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(comment)
    db.commit()
    return {"status": "success"}


# ==================== Task Attachment Endpoints ====================

def _attachment_to_response(attachment: Resume) -> dict:
    """Convert a Resume record (used as attachment) to AttachmentResponse dict."""
    return {
        "id": attachment.id,
        "todo_id": attachment.todo_id,
        "filename": attachment.filename,
        "original_filename": attachment.original_filename,
        "file_type": attachment.file_type,
        "file_size": attachment.file_size,
        "created_at": attachment.created_at,
        "url": attachment.url,
    }


@router.post("/todos/{todo_id}/attachments", response_model=AttachmentResponse)
async def upload_attachment(
    todo_id: int,
    file: UploadFile = File(...),
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Upload a file attachment to a task."""
    import uuid as uuid_mod

    # Verify the todo exists and belongs to user
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    # Validate file
    from backend.utils.file_validator import FileValidator
    contents, file_extension = await FileValidator.validate_attachment(file)
    file_extension = file_extension.lstrip('.')

    # Sanitize original filename (strip path components, prevent XSS in stored name)
    original_filename = os.path.basename(file.filename or "attachment")

    # Generate unique filename
    unique_filename = f"{uuid_mod.uuid4()}.{file_extension}"

    # Store attachments in dedicated directory
    if os.path.exists("/app/attachments"):
        base_dir = "/app/attachments"
    else:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'backend', 'attachments'))

    user_dir = os.path.join(base_dir, str(user_id))
    os.makedirs(user_dir, exist_ok=True)

    file_path = os.path.normpath(os.path.join(user_dir, unique_filename))

    # Security: ensure file path stays within user directory
    if not file_path.startswith(os.path.normpath(user_dir)):
        raise HTTPException(status_code=403, detail="Access denied")

    # Write file to disk
    with open(file_path, "wb") as f:
        f.write(contents)

    # Create Resume record with todo_id
    attachment = Resume(
        filename=unique_filename,
        original_filename=original_filename,
        file_path=file_path,
        file_type=file_extension,
        file_size=len(contents),
        user_id=user_id,
        todo_id=todo_id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)

    logger.info(f"Attachment uploaded: {file.filename} -> {unique_filename} for todo {todo_id}")
    return _attachment_to_response(attachment)


@router.get("/todos/{todo_id}/attachments", response_model=List[AttachmentResponse])
async def list_attachments(
    todo_id: int,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """List all attachments for a task."""
    attachments = db.query(Resume).filter(
        Resume.todo_id == todo_id,
        Resume.user_id == user_id
    ).order_by(Resume.created_at.desc()).all()
    return [_attachment_to_response(a) for a in attachments]


@router.delete("/todos/{todo_id}/attachments/{attachment_id}")
async def delete_attachment(
    todo_id: int,
    attachment_id: int,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Delete an attachment from a task."""
    attachment = db.query(Resume).filter(
        Resume.id == attachment_id,
        Resume.todo_id == todo_id,
        Resume.user_id == user_id
    ).first()
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")

    # Capture values before deleting — object expires after commit
    file_path = attachment.file_path
    original_filename = attachment.original_filename

    # Delete DB record first (reversible via rollback if something goes wrong)
    db.delete(attachment)
    db.commit()

    # Then delete file from disk (orphan file is less harmful than broken DB reference)
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except OSError as e:
            logger.warning(f"Failed to delete attachment file {file_path}: {e}")

    logger.info(f"Attachment deleted: {original_filename} (id={attachment_id}) from todo {todo_id}")
    return {"status": "success"}


@router.get("/files/attachments/{user_id}/{filename}")
async def serve_attachment_file(user_id: int, filename: str):
    """Serve attachment files — routed through /api/work proxy so no extra proxy config needed."""
    if os.path.exists("/app/attachments"):
        base_dir = "/app/attachments"
    else:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'backend', 'attachments'))
    file_path = os.path.normpath(os.path.join(base_dir, str(user_id), filename))
    if not file_path.startswith(os.path.normpath(base_dir)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_path)


@router.post("/todos/{todo_id}/complete", response_model=TodoResponse)
async def complete_todo(
    todo_id: int,
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """Mark a todo as completed."""
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    if todo.status == "done":
        return todo

    todo.status = "done"
    todo.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(todo)
    return todo


# ==================== Task Extraction from Email ====================

@router.get("/tasks/extract/status")
async def get_extraction_status(
    user_id: int = Query(default=1, description="User ID"),
):
    """Check if a background extraction is running for this user."""
    info = _bg_extraction.get(user_id)
    if not info:
        return {"status": "idle", "progress": None}
    return {
        "status": info.get("status", "idle"),
        "progress": info.get("progress"),
        "new_tasks_count": info.get("new_tasks_count", 0),
        "started_at": info.get("started_at"),
    }


@router.get("/tasks/extracted")
async def get_extracted_tasks(
    user_id: int = Query(default=1),
    start_date: Optional[str] = Query(default=None, description="Filter tasks with source_date >= this date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(default=None, description="Filter tasks with source_date <= this date (YYYY-MM-DD)"),
    page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(default=10, ge=1, le=100, description="Items per page (max 100)"),
    db: Session = Depends(get_db)
):
    """
    Get pending/added extracted tasks for a user with pagination.

    When start_date and end_date are provided, only tasks whose source_date
    falls within the range are returned. This matches the extraction settings
    date range so triage shows only tasks from the selected period.
    """
    # Show pending AND added tasks so users can see which items they've already processed
    query = db.query(ExtractedTaskModel).filter(
        ExtractedTaskModel.user_id == user_id,
        ExtractedTaskModel.status.in_(["pending", "added"])
    )
    query = _apply_date_filter(query, start_date, end_date)

    # Get total and pending counts with the same date filter
    count_query = db.query(ExtractedTaskModel).filter(
        ExtractedTaskModel.user_id == user_id,
        ExtractedTaskModel.status.in_(["pending", "added"])
    )
    count_query = _apply_date_filter(count_query, start_date, end_date)
    counts = count_query.with_entities(
        func.count().label('total'),
        func.sum(case((ExtractedTaskModel.status == 'pending', 1), else_=0)).label('pending')
    ).first()
    total = int(counts.total or 0)
    pending_count = int(counts.pending or 0)
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    # Apply pagination - pending tasks first, then added; newest source date first
    offset = (page - 1) * page_size
    tasks = query.order_by(
        case((ExtractedTaskModel.status == 'pending', 0), else_=1),
        ExtractedTaskModel.source_date.desc().nullslast()
    ).offset(offset).limit(page_size).all()

    return {
        "items": [task.to_dict() for task in tasks],
        "total": total,
        "pending_count": pending_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1,
    }


@router.post("/tasks/extracted/{task_id}/add")
async def add_extracted_task_to_todos(
    task_id: int,
    user_id: int = Query(default=1),
    db: Session = Depends(get_db)
):
    """Convert an extracted task to a real todo item."""
    task = db.query(ExtractedTaskModel).filter(
        ExtractedTaskModel.id == task_id,
        ExtractedTaskModel.user_id == user_id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Extracted task not found")

    if task.status == "added":
        return {"success": True, "todo_id": task.added_todo_id, "todo": None, "already_added": True}

    # Create a new Todo from the extracted task
    # Use "none" priority — LLM's extraction-time guess should not count as real prioritization
    # When AI summary exists, use it as description so both fields are strictly aligned
    if task.ai_summary:
        desc = "\n".join(f"• {b}" for b in task.ai_summary)
    else:
        desc = task.description or f"Source: {task.source_type} - {task.source_subject or ''}"
    new_todo = Todo(
        user_id=user_id,
        title=task.title,
        description=desc,
        ai_summary=task.ai_summary,  # Copy AI summary from triage
        status="none",  # No status until user explicitly assigns one
        priority="none",
        due_date=None,  # Source dates are not real deadlines; user sets their own
        category=task.source_type,
        external_source=f"ai_extracted_{task.source_type}",
        external_id=task.source_id,
    )
    db.add(new_todo)
    db.flush()

    # Mark extracted task as added
    task.status = "added"
    task.added_todo_id = new_todo.id
    task.processed_at = datetime.now(timezone.utc)
    db.commit()

    return {"success": True, "todo_id": new_todo.id, "todo": new_todo.to_dict()}


@router.post("/tasks/extracted/revert/{todo_id}")
async def revert_extracted_task(
    todo_id: int,
    user_id: int = Query(default=1),
    db: Session = Depends(get_db)
):
    """Revert an added extracted task: delete the Todo and restore the ExtractedTask to pending."""
    # Find the extracted task that was added as this todo
    extracted = db.query(ExtractedTaskModel).filter(
        ExtractedTaskModel.added_todo_id == todo_id,
        ExtractedTaskModel.user_id == user_id,
        ExtractedTaskModel.status == "added"
    ).first()

    if not extracted:
        raise HTTPException(status_code=404, detail="No extracted task linked to this todo")

    # Delete the todo (detach attachments first — SQLite doesn't enforce ON DELETE SET NULL)
    todo = db.query(Todo).filter(Todo.id == todo_id, Todo.user_id == user_id).first()
    if todo:
        db.query(Resume).filter(Resume.todo_id == todo_id).update(
            {Resume.todo_id: None}, synchronize_session="fetch"
        )
        db.delete(todo)

    # Restore extracted task to pending
    extracted.status = "pending"
    extracted.added_todo_id = None
    extracted.processed_at = None
    db.commit()

    return {"success": True, "extracted_task_id": extracted.id}


@router.post("/tasks/extracted/{task_id}/dismiss")
async def dismiss_extracted_task(
    task_id: int,
    user_id: int = Query(default=1),
    db: Session = Depends(get_db)
):
    """Dismiss an extracted task (won't show again)."""
    task = db.query(ExtractedTaskModel).filter(
        ExtractedTaskModel.id == task_id,
        ExtractedTaskModel.user_id == user_id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Extracted task not found")

    task.status = "dismissed"
    task.processed_at = datetime.now(timezone.utc)
    db.commit()

    return {"success": True}


@router.post("/tasks/extracted/{task_id}/describe")
async def describe_extracted_task(
    task_id: int,
    user_id: int = Query(default=1),
    force: bool = Query(default=False, description="Force regeneration (ignore cached summary)"),
    db: Session = Depends(get_db)
):
    """
    Generate an LLM-powered description (3-5 bullet points) for an extracted task.

    Results are persisted to the ai_summary column so subsequent requests
    return instantly from DB without calling the LLM again.
    Use force=true to regenerate.
    """
    task = db.query(ExtractedTaskModel).filter(
        ExtractedTaskModel.id == task_id,
        ExtractedTaskModel.user_id == user_id
    ).first()

    if not task:
        raise HTTPException(status_code=404, detail="Extracted task not found")

    # Return cached summary if available (and not forcing regeneration)
    if not force and task.ai_summary and len(task.ai_summary) > 0:
        return {"success": True, "task_id": task_id, "bullets": task.ai_summary, "from_cache": True}

    # Build context from all available task fields
    context_parts = [f"Task title: {task.title}"]
    if task.description:
        context_parts.append(f"Existing description: {task.description}")
    if task.source_type:
        context_parts.append(f"Source type: {task.source_type}")
    if task.source_subject:
        context_parts.append(f"Source subject: {task.source_subject}")
    if task.source_account:
        context_parts.append(f"Source account: {task.source_account}")
    if task.priority:
        context_parts.append(f"Priority: {task.priority}")
    if task.due_date:
        context_parts.append(f"Due date: {task.due_date}")
    if task.confidence is not None:
        context_parts.append(f"Extraction confidence: {task.confidence}")

    context = "\n".join(context_parts)

    prompt = f"""Based on the following extracted task information, write 3-5 concise bullet points that describe the core details and action items of this task. Each bullet should be a single clear sentence. Focus on what needs to be done, why it matters, and any key context.

{context}

Return ONLY the bullet points, one per line, each starting with "• ". No headers, no preamble, no extra text."""

    try:
        import re
        import httpx as httpx_client

        vllm_base = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
        vllm_model = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")

        async with httpx_client.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{vllm_base}/chat/completions",
                json={
                    "model": vllm_model,
                    "messages": [
                        {"role": "system", "content": "You are a concise task analyst. Output only bullet points, no extra text."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 400
                }
            )

            if response.status_code != 200:
                logger.error(f"vLLM describe error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="AI description generation failed")

            result = response.json()
            description = result["choices"][0]["message"]["content"].strip()

            # Parse bullets into a list
            bullets = []
            for line in description.split("\n"):
                line = line.strip()
                if not line:
                    continue
                # Normalize bullet prefix
                for prefix in ["• ", "- ", "* ", "· "]:
                    if line.startswith(prefix):
                        line = line[len(prefix):]
                        break
                # Remove numbered prefixes like "1. " or "1) "
                line = re.sub(r'^\d+[\.\)]\s*', '', line)
                if line:
                    bullets.append(line)

            bullets = bullets[:5]

            # Persist to DB so subsequent requests are instant
            # Keep description strictly aligned with ai_summary
            task.ai_summary = bullets
            formatted_desc = "\n".join(f"• {b}" for b in bullets)
            task.description = formatted_desc
            # Bidirectional sync: if task was added to todos, update the linked todo too
            if task.added_todo_id:
                linked_todo = db.query(Todo).filter(
                    Todo.id == task.added_todo_id,
                    Todo.user_id == user_id
                ).first()
                if linked_todo:
                    linked_todo.ai_summary = bullets
                    linked_todo.description = formatted_desc
            db.commit()

            return {"success": True, "task_id": task_id, "bullets": bullets, "from_cache": False}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Task description generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/todos/{todo_id}/describe")
async def describe_todo(
    todo_id: int,
    user_id: int = Query(default=1),
    force: bool = Query(default=False, description="Force regeneration (ignore cached summary)"),
    db: Session = Depends(get_db)
):
    """
    Generate an LLM-powered description (3-5 bullet points) for a todo.

    Checks linked ExtractedTask first for existing summary.
    Results are persisted to both todo.ai_summary and linked ExtractedTask
    so subsequent requests return instantly from DB.
    Use force=true to regenerate.
    """
    todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.user_id == user_id
    ).first()

    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")

    # Return cached summary if available (and not forcing regeneration)
    if not force and todo.ai_summary and len(todo.ai_summary) > 0:
        return {"success": True, "todo_id": todo_id, "bullets": todo.ai_summary, "from_cache": True}

    # Check linked ExtractedTask for existing summary
    linked_task = db.query(ExtractedTaskModel).filter(
        ExtractedTaskModel.added_todo_id == todo_id,
        ExtractedTaskModel.user_id == user_id
    ).first()

    if not force and linked_task and linked_task.ai_summary and len(linked_task.ai_summary) > 0:
        # Copy from linked ExtractedTask
        todo.ai_summary = linked_task.ai_summary
        db.commit()
        return {"success": True, "todo_id": todo_id, "bullets": linked_task.ai_summary, "from_cache": True}

    # Build context from todo fields
    context_parts = [f"Task title: {todo.title}"]
    if todo.description:
        import re
        # Strip HTML tags from description to avoid polluting LLM prompt
        clean_desc = re.sub(r'<[^>]+>', ' ', todo.description)
        clean_desc = re.sub(r'\s+', ' ', clean_desc).strip()
        if clean_desc:
            context_parts.append(f"Existing description: {clean_desc[:2000]}")
    if todo.category:
        context_parts.append(f"Category: {todo.category}")
    if todo.priority:
        context_parts.append(f"Priority: {todo.priority}")
    if todo.due_date:
        context_parts.append(f"Due date: {todo.due_date}")
    # Add source info from linked extracted task if available
    if linked_task:
        if linked_task.source_type:
            context_parts.append(f"Source type: {linked_task.source_type}")
        if linked_task.source_subject:
            context_parts.append(f"Source subject: {linked_task.source_subject}")
        if linked_task.source_account:
            context_parts.append(f"Source account: {linked_task.source_account}")

    context = "\n".join(context_parts)

    prompt = f"""Based on the following task information, write 3-5 concise bullet points that describe the core details and action items of this task. Each bullet should be a single clear sentence. Focus on what needs to be done, why it matters, and any key context.

{context}

Return ONLY the bullet points, one per line, each starting with "• ". No headers, no preamble, no extra text."""

    try:
        import re
        import httpx as httpx_client

        vllm_base = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
        vllm_model = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")

        async with httpx_client.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{vllm_base}/chat/completions",
                json={
                    "model": vllm_model,
                    "messages": [
                        {"role": "system", "content": "You are a concise task analyst. Output only bullet points, no extra text."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 400
                }
            )

            if response.status_code != 200:
                logger.error(f"vLLM describe error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="AI description generation failed")

            result = response.json()
            description = result["choices"][0]["message"]["content"].strip()

            # Parse bullets into a list
            bullets = []
            for line in description.split("\n"):
                line = line.strip()
                if not line:
                    continue
                for prefix in ["• ", "- ", "* ", "· "]:
                    if line.startswith(prefix):
                        line = line[len(prefix):]
                        break
                line = re.sub(r'^\d+[\.\)]\s*', '', line)
                if line:
                    bullets.append(line)

            bullets = bullets[:5]

            # Persist to DB — keep description strictly aligned with ai_summary
            todo.ai_summary = bullets
            todo.description = "\n".join(f"• {b}" for b in bullets)
            # Bidirectional sync: update linked ExtractedTask too
            if linked_task:
                linked_task.ai_summary = bullets
            db.commit()

            return {"success": True, "todo_id": todo_id, "bullets": bullets, "from_cache": False}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Todo description generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/sync-status", response_model=SyncStatusResponse)
async def get_extraction_sync_status(
    user_id: int = Query(default=1, description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Get the sync status for task extraction (database-first check).

    Use this endpoint BEFORE calling /tasks/extract to:
    - Check if cached tasks exist in the database
    - Determine if new extraction is needed
    - Get counts of processed sources

    This implements the database-first approach:
    1. Frontend calls this endpoint first
    2. If needs_extraction=False, use cached data from /tasks/extracted
    3. Only call /tasks/extract when needs_extraction=True
    """
    from sqlalchemy import func

    # Count cached tasks by status
    total_cached = db.query(func.count(ExtractedTaskModel.id)).filter(
        ExtractedTaskModel.user_id == user_id
    ).scalar() or 0

    pending_count = db.query(func.count(ExtractedTaskModel.id)).filter(
        ExtractedTaskModel.user_id == user_id,
        ExtractedTaskModel.status == "pending"
    ).scalar() or 0

    # Get last extraction time
    last_extraction = db.query(func.max(ExtractedTaskModel.extracted_at)).filter(
        ExtractedTaskModel.user_id == user_id
    ).scalar()

    # Count processed sources by type
    processed_counts = db.query(
        ProcessedSource.source_type,
        func.count(ProcessedSource.id)
    ).filter(
        ProcessedSource.user_id == user_id
    ).group_by(ProcessedSource.source_type).all()

    processed_sources = {source_type: count for source_type, count in processed_counts}

    # Determine if extraction is needed
    # Extraction is needed if:
    # 1. No cached tasks exist, OR
    # 2. Last extraction was more than 1 hour ago
    needs_extraction = True
    if total_cached > 0 and last_extraction:
        now = datetime.now(timezone.utc)
        # Make last_extraction timezone-aware if it isn't
        if last_extraction.tzinfo is None:
            last_extraction = last_extraction.replace(tzinfo=timezone.utc)
        hours_since = (now - last_extraction).total_seconds() / 3600
        needs_extraction = hours_since > 1.0  # Re-extract if > 1 hour old

    return SyncStatusResponse(
        user_id=user_id,
        last_extraction_at=last_extraction,
        total_cached_tasks=total_cached,
        pending_tasks=pending_count,
        processed_sources=processed_sources,
        needs_extraction=needs_extraction
    )


# In-memory cache for extraction cooldown (avoids repeated external API calls)
# Key: (user_id, email_start, email_end, sources)
# Value: timestamp of last extraction
_extraction_cache = {}
EXTRACTION_COOLDOWN_SECONDS = 120  # 2 minutes


def _get_extraction_cache_key(user_id: int, request: "TaskExtractRequest") -> tuple:
    """Generate cache key for extraction request."""
    return (
        user_id,
        request.email_start_date or "",
        request.email_end_date or "",
        tuple(sorted(request.sources)) if request.sources else (),
        tuple(sorted(request.email_account_ids)) if request.email_account_ids else (),
    )


def _is_extraction_on_cooldown(cache_key: tuple) -> bool:
    """Check if extraction for this request is on cooldown."""
    if cache_key not in _extraction_cache:
        return False
    last_extraction = _extraction_cache[cache_key]
    return (time.time() - last_extraction) < EXTRACTION_COOLDOWN_SECONDS


def _update_extraction_cache(cache_key: tuple):
    """Update the extraction cache with current timestamp."""
    _extraction_cache[cache_key] = time.time()
    # Clean up old entries (older than 1 hour)
    cutoff = time.time() - 3600
    keys_to_remove = [k for k, v in _extraction_cache.items() if v < cutoff]
    for k in keys_to_remove:
        del _extraction_cache[k]


# ==================== Date Range Filtering ====================

def _apply_date_filter(query, start_date_str: str = None, end_date_str: str = None):
    """Apply source_date range filter to extracted tasks query.

    Filters tasks to only those whose source_date falls within [start_date, end_date] inclusive.
    Tasks with NULL source_date are excluded when a date range is specified.
    """
    if start_date_str and end_date_str:
        start_dt = datetime.strptime(start_date_str, "%Y-%m-%d")
        # end_date is inclusive: use < end_date + 1 day
        end_dt = datetime.strptime(end_date_str, "%Y-%m-%d") + timedelta(days=1)
        query = query.filter(
            ExtractedTaskModel.source_date.isnot(None),
            ExtractedTaskModel.source_date >= start_dt,
            ExtractedTaskModel.source_date < end_dt,
        )
    return query


# ==================== Scanned Date Range Tracking (DB-persisted) ====================
# Tracks which date ranges have been fully scanned per (user_id, account, source_type).
# Persisted to DB so optimization survives server restarts.
# On overlapping extraction requests, only the uncovered portion is queried from APIs.
#
# Key invariant: past emails are immutable — no one can send emails dated yesterday.
# Therefore past date ranges are cached permanently. Today is ALWAYS re-scanned
# because new emails arrive throughout the day. This eliminates the need for
# manual "Force Refresh": past = instant from DB, today = always fresh from Gmail.


def _record_scanned_range(db, user_id: int, account_email: str, source_type: str,
                          start_date, end_date):
    """Record a successfully scanned date range. Merges overlapping/adjacent ranges in DB.

    Records the full range including today. The "today is always uncovered" invariant
    is enforced by _get_uncovered_ranges (which caps scan_end at yesterday), NOT here.
    This ensures that when today becomes yesterday, it's already in the DB as covered.
    """
    try:
        from backend.models.extracted_task import ScannedDateRange

        # Convert date to datetime for DB storage
        start_dt = datetime.combine(start_date, datetime.min.time()) if not isinstance(start_date, datetime) else start_date
        end_dt = datetime.combine(end_date, datetime.min.time()) if not isinstance(end_date, datetime) else end_date

        # Load existing ranges for this (user, account, source_type)
        existing = db.query(ScannedDateRange).filter(
            ScannedDateRange.user_id == user_id,
            ScannedDateRange.account_email == account_email,
            ScannedDateRange.source_type == source_type,
        ).all()

        # Merge all ranges (existing + new) into compacted non-overlapping list
        all_ranges = [(r.start_date, r.end_date) for r in existing]
        all_ranges.append((start_dt, end_dt))
        all_ranges.sort()

        merged = [list(all_ranges[0])]
        for s, e in all_ranges[1:]:
            if s <= merged[-1][1] + timedelta(days=1):
                merged[-1][1] = max(merged[-1][1], e)
            else:
                merged.append([s, e])

        # Skip write if merged result is identical to existing (common case: re-scanning same range)
        existing_set = {(r.start_date, r.end_date) for r in existing}
        merged_set = {(s, e) for s, e in merged}
        if existing_set == merged_set:
            return  # No change needed

        # Replace old rows with merged result (delete+add are staged, committed by caller)
        for r in existing:
            db.delete(r)
        for s, e in merged:
            db.add(ScannedDateRange(
                user_id=user_id, account_email=account_email, source_type=source_type,
                start_date=s, end_date=e,
            ))
    except Exception as e:
        logger.warning(f"Failed to record scanned range: {e}")


def _get_uncovered_ranges(db, user_id: int, account_email: str, source_type: str,
                          req_start, req_end) -> list:
    """
    Compute which portions of (req_start, req_end) haven't been scanned yet.

    Today is ALWAYS treated as uncovered (new emails arrive throughout the day).
    Past dates use DB-persisted scanned ranges for instant cache hits.

    Returns:
        List of (start_date, end_date) tuples for uncovered portions.
        Empty list means the entire range is already covered.
    """
    try:
        from backend.models.extracted_task import ScannedDateRange
        from datetime import date as date_type

        today = date_type.today()
        yesterday = today - timedelta(days=1)

        req_start_dt = datetime.combine(req_start, datetime.min.time()) if not isinstance(req_start, datetime) else req_start
        req_end_dt = datetime.combine(req_end, datetime.min.time()) if not isinstance(req_end, datetime) else req_end

        # Query ranges that overlap with requested range
        rows = db.query(ScannedDateRange).filter(
            ScannedDateRange.user_id == user_id,
            ScannedDateRange.account_email == account_email,
            ScannedDateRange.source_type == source_type,
            ScannedDateRange.start_date <= req_end_dt,
            ScannedDateRange.end_date >= req_start_dt,
        ).order_by(ScannedDateRange.start_date).all()

        if not rows:
            return [(req_start, req_end)]

        # Walk through scanned ranges and find gaps within [req_start, req_end]
        uncovered = []
        cursor = req_start
        for row in rows:
            scan_start = row.start_date.date() if isinstance(row.start_date, datetime) else row.start_date
            scan_end = row.end_date.date() if isinstance(row.end_date, datetime) else row.end_date
            # Cap scanned range at yesterday — today always needs fresh scan
            scan_end = min(scan_end, yesterday)
            if scan_end < scan_start:
                continue  # Range was entirely today/future — ignore
            if cursor > req_end:
                break
            if scan_start > cursor:
                gap_end = min(scan_start - timedelta(days=1), req_end)
                if gap_end >= cursor:
                    uncovered.append((cursor, gap_end))
            cursor = max(cursor, scan_end + timedelta(days=1))

        if cursor <= req_end:
            uncovered.append((cursor, req_end))

        return uncovered
    except Exception as e:
        logger.warning(f"Failed to check scanned ranges: {e}")
        return [(req_start, req_end)]  # Fallback: treat as uncovered


# ==================== Parallel Account Processing ====================


@dataclass
class AccountResult:
    """Result from processing a single account."""
    emails: list = field(default_factory=list)
    gtasks: list = field(default_factory=list)  # ExtractedTaskModel instances
    gtask_sources: list = field(default_factory=list)  # ProcessedSource instances
    stats: dict = field(default_factory=dict)
    missing_tasks_scope: bool = False
    account_email: str = ""
    error: str = None
    # ALL source IDs seen from APIs — used for stale task cleanup.
    # None = not queried / error / truncated results (skip cleanup for this type).
    # set() = queried successfully, these are ALL live IDs.
    live_email_ids: set | None = None
    live_gtask_ids: set | None = None


async def _process_account_emails(
    token, credentials, request, processed_sources: Set[tuple], user_id: int = 0, db=None
) -> tuple[list, dict, set]:
    """Fetch emails from a single account. Returns (new_emails, stats, all_email_ids)."""
    from modules.agents.work.src.services.google_oauth import GmailService

    emails = []
    stats = {"emails": 0, "new_emails": 0, "skipped_scanned": 0}
    all_email_ids = None

    try:
        gmail_service = GmailService(credentials)

        # Build date query
        # Gmail 'after:' and 'before:' operators:
        #   after:YYYY/MM/DD  → INCLUSIVE: emails from that date onwards
        #   before:YYYY/MM/DD → EXCLUSIVE: emails before that date (not including it)
        # To include both start_date and end_date:
        #   after:{start_date}       — includes start_date (inclusive)
        #   before:{end_date + 1day} — includes end_date (because before is exclusive)
        if request.email_start_date and request.email_end_date:
            req_start = datetime.strptime(request.email_start_date, "%Y-%m-%d").date()
            req_end = datetime.strptime(request.email_end_date, "%Y-%m-%d").date()

            # Compute which portions of the date range haven't been scanned yet
            uncovered = _get_uncovered_ranges(
                db, user_id, token.account_email, "email", req_start, req_end
            )

            if not uncovered:
                # Entire range already scanned — skip Gmail API call
                logger.info(f"Gmail skip: {token.account_email} range {req_start}~{req_end} fully scanned")
                stats["skipped_scanned"] = 1
                # Return None for all_email_ids to signal "we didn't query" (prevents stale cleanup)
                return emails, stats, None

            # Narrow query to the bounding box of uncovered ranges
            narrow_start = min(r[0] for r in uncovered)
            narrow_end = max(r[1] for r in uncovered)
            after_date = narrow_start.strftime("%Y/%m/%d")
            before_date = (narrow_end + timedelta(days=1)).strftime("%Y/%m/%d")
            query = f"after:{after_date} before:{before_date}"

            range_was_narrowed = (narrow_start, narrow_end) != (req_start, req_end)
            if range_was_narrowed:
                logger.info(f"Gmail narrowed: {token.account_email} requested {req_start}~{req_end} → querying {narrow_start}~{narrow_end} (overlap skipped)")
            else:
                logger.info(f"Gmail date query: {token.account_email} {req_start}~{req_end}, query=after:{after_date} before:{before_date}")

            start_dt = datetime.combine(req_start, datetime.min.time())
            end_dt = datetime.combine(req_end, datetime.min.time())
        else:
            range_was_narrowed = False
            after_date = (datetime.now() - timedelta(days=request.email_days_back)).strftime("%Y/%m/%d")
            query = f"after:{after_date}"
            start_dt = datetime.now() - timedelta(days=request.email_days_back)
            end_dt = datetime.now()

        gmail_query = query

        # Paginate through ALL matching emails (Gmail returns max 500 per page).
        # For task extraction we need the complete set — a truncated fetch means
        # older emails in the date range are silently ignored.
        PAGE_SIZE = 200  # emails per Gmail API page (batch-fetched with metadata)
        MAX_TOTAL = 2000  # safety cap to avoid runaway fetches
        messages = []
        page_token = None
        page_num = 0
        while True:
            page_num += 1
            result = await asyncio.to_thread(
                gmail_service.get_messages,
                max_results=PAGE_SIZE,
                query=gmail_query,
                page_token=page_token,
            )
            page_messages = result.get("messages", [])
            messages.extend(page_messages)
            page_token = result.get("nextPageToken")
            logger.info(f"Gmail page {page_num}: {len(page_messages)} emails (total so far: {len(messages)})")
            if not page_token or len(messages) >= MAX_TOTAL:
                break

        stats["emails"] = len(messages)
        truncated = len(messages) >= MAX_TOTAL

        # Collect ALL email IDs for stale task cleanup.
        # Only reliable when: 1) fetched all emails (not truncated), AND
        # 2) queried the full requested range (not narrowed by scanned-range optimization).
        if range_was_narrowed:
            all_email_ids = None  # Narrowed query — incomplete for stale cleanup
        elif not truncated:
            all_email_ids = {msg.get("id", "") for msg in messages if msg.get("id")}
        else:
            all_email_ids = None  # Truncated results — can't reliably detect stale tasks

        # Filter to only NEW emails
        for msg in messages:
            msg_id = msg.get("id", "")
            if ("email", msg_id) not in processed_sources:
                msg['account_email'] = token.account_email
                emails.append(msg)
                stats["new_emails"] += 1

    except Exception as e:
        logger.warning(f"Error fetching emails from {token.account_email}: {e}")
        all_email_ids = None

    return emails, stats, all_email_ids


async def _process_account_gtasks(
    token, credentials, processed_sources: Set[tuple], user_id: int
) -> tuple[list, list, dict, bool, set | None]:
    """Fetch Google Tasks from a single account. Returns (tasks, sources, stats, missing_scope, all_gtask_ids)."""
    from modules.agents.work.src.services.google_oauth import TasksService

    tasks = []
    sources = []
    stats = {"google_tasks": 0}
    missing_scope = False

    # Check if token has tasks scope
    token_scopes = token.get_scopes() if hasattr(token, 'get_scopes') else []
    has_tasks_scope = any('tasks' in scope.lower() for scope in token_scopes)

    if not has_tasks_scope:
        logger.info(f"Account {token.account_email} missing Tasks scope")
        return tasks, sources, stats, True, None

    try:
        tasks_service = TasksService(credentials)

        # Run sync API call in thread pool
        google_tasks = await asyncio.to_thread(
            tasks_service.get_all_tasks,
            show_completed=False,
            max_results=100
        )

        logger.info(f"Fetched {len(google_tasks)} Google Tasks from {token.account_email}")
        stats["google_tasks"] = len(google_tasks)

        # Collect ALL task IDs for stale task cleanup.
        # Only reliable when we fetched all tasks (count < max_results).
        if len(google_tasks) < 100:
            all_gtask_ids = {gtask.get("id", "") for gtask in google_tasks if gtask.get("id")}
        else:
            all_gtask_ids = None  # Truncated — can't reliably detect stale tasks

        for gtask in google_tasks:
            task_id = gtask.get("id", "")
            if ("gtask", task_id) not in processed_sources:
                # Parse due date
                due_date = None
                if gtask.get("due"):
                    try:
                        due_date = datetime.fromisoformat(gtask["due"].replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        pass

                source_date = due_date
                if not source_date and gtask.get("updated"):
                    try:
                        source_date = datetime.fromisoformat(gtask["updated"].replace("Z", "+00:00"))
                    except (ValueError, TypeError):
                        pass

                # Build ai_summary from task metadata (avoids LLM call on detail view)
                gtask_bullets = []
                gtask_notes = (gtask.get("notes") or "").strip()
                if gtask_notes:
                    gtask_bullets.append(gtask_notes[:300])
                gtask_list_name = gtask.get("tasklist_title", "")
                if gtask_list_name:
                    gtask_bullets.append(f"List: {gtask_list_name}")
                if due_date:
                    gtask_bullets.append(f"Due: {due_date.strftime('%b %d, %Y')}")

                tasks.append(ExtractedTaskModel(
                    user_id=user_id,
                    title=gtask.get("title", "Untitled Task"),
                    description=gtask_notes[:500] if gtask_notes else "",
                    priority="medium",
                    due_date=due_date,
                    confidence=1.0,
                    ai_summary=gtask_bullets if gtask_bullets else None,
                    source_type="gtask",
                    source_id=task_id,
                    source_subject=gtask_list_name or "Google Tasks",
                    source_account=token.account_email,
                    source_date=source_date,
                ))

                sources.append(ProcessedSource(
                    user_id=user_id,
                    source_type="gtask",
                    source_id=task_id,
                    source_account=token.account_email,
                    tasks_extracted=1
                ))

    except Exception as e:
        logger.warning(f"Error fetching Google Tasks from {token.account_email}: {e}")
        all_gtask_ids = None

    return tasks, sources, stats, missing_scope, all_gtask_ids


async def _process_single_account(
    token, db, request, processed_sources: Set[tuple], user_id: int
) -> AccountResult:
    """Process a single account: fetch emails and Google Tasks in parallel."""
    result = AccountResult(account_email=token.account_email)

    if token.is_revoked:
        result.error = "Token revoked"
        return result

    try:
        await refresh_token_if_expired(token, db)
        credentials = google_oauth_service.get_credentials(
            token.get_access_token(),
            token.get_refresh_token()
        )

        # Process email and tasks in parallel for this account
        async def empty_email_result():
            return [], {}, None

        tasks_to_run = [
            _process_account_emails(token, credentials, request, processed_sources, user_id, db) if "email" in request.sources else empty_email_result(),
            _process_account_gtasks(token, credentials, processed_sources, user_id)
        ]

        # Run both in parallel
        results = await asyncio.gather(*tasks_to_run, return_exceptions=True)

        # Unpack email results
        if isinstance(results[0], Exception):
            logger.warning(f"Email fetch failed for {token.account_email}: {results[0]}")
        else:
            result.emails, email_stats, result.live_email_ids = results[0]
            result.stats.update(email_stats)

        # Unpack gtasks results
        if isinstance(results[1], Exception):
            logger.warning(f"Google Tasks fetch failed for {token.account_email}: {results[1]}")
        else:
            result.gtasks, result.gtask_sources, gtask_stats, result.missing_tasks_scope, result.live_gtask_ids = results[1]
            result.stats.update(gtask_stats)

    except TokenRefreshError as e:
        result.error = f"Token refresh failed: {e}"
        logger.warning(f"Token refresh failed for {token.account_email}: {e}")
    except Exception as e:
        result.error = str(e)
        logger.error(f"Error processing account {token.account_email}: {e}")

    return result


@router.post("/tasks/extract", response_model=TaskExtractResponse)
async def extract_tasks_from_sources(
    request: TaskExtractRequest = Body(default=TaskExtractRequest()),
    user_id: int = Query(default=1, description="User ID"),
    force_refresh: bool = Query(default=False, description="Deprecated — no-op. Today is always re-scanned automatically."),
    db: Session = Depends(get_db)
):
    """
    Extract actionable tasks from emails using LLM.

    Supports incremental extraction:
    - First call extracts from all sources and saves to DB
    - Subsequent calls only process NEW emails (incremental)
    - Past dates are permanently cached (emails are immutable). Today is always re-scanned.
    - Extraction is cached for 2 minutes to avoid repeated external API calls

    Returns all pending extracted tasks (including previously extracted ones).
    """
    from backend.models.oauth_token import OAuthToken

    start_time = time.time()
    logger.info(f"Extract request: user={user_id}, "
                f"email_dates={request.email_start_date} to {request.email_end_date}")

    # Check if this extraction is on cooldown (skip external API calls)
    cache_key = _get_extraction_cache_key(user_id, request)
    if _is_extraction_on_cooldown(cache_key):
        logger.info(f"Extraction on cooldown for user {user_id}, returning cached results from DB")
        # Return paginated results directly from database (filtered by requested date range)
        query = db.query(ExtractedTaskModel).filter(
            ExtractedTaskModel.user_id == user_id,
            ExtractedTaskModel.status == "pending"
        )
        query = _apply_date_filter(query, request.email_start_date, request.email_end_date)
        total = query.count()
        page_size = 10
        total_pages = math.ceil(total / page_size) if total > 0 else 1
        first_page = query.order_by(ExtractedTaskModel.source_date.desc().nullslast()).limit(page_size).all()

        return TaskExtractResponse(
            tasks=[ExtractedTask(
                id=t.id,
                title=t.title,
                description=t.description,
                source_type=t.source_type,
                source_id=t.source_id,
                source_subject=t.source_subject,
                source_account=t.source_account,
                source_date=t.source_date.isoformat() if t.source_date else None,
                priority=t.priority,
                due_date=t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
                confidence=t.confidence,
                ai_summary=t.ai_summary,
            ) for t in first_page],
            sources_analyzed={"emails": 0, "new_emails": 0, "google_tasks": 0},
            extraction_time=round(time.time() - start_time, 2),
            new_tasks_count=0,
            from_cache=True,
            total=total,
            pending_count=total,
            page=1,
            page_size=page_size,
            total_pages=total_pages
        )

    # Fast path: if the requested email date range is fully covered by previously scanned
    # ranges, skip all API calls and return existing DB results instantly.
    # Today is always treated as uncovered (new emails arrive), so this fast path
    # only triggers for purely historical ranges. For ranges including today,
    # only today is re-scanned while past dates are served from DB.
    if request.email_start_date and request.email_end_date and "email" in (request.sources or []):
        req_start = datetime.strptime(request.email_start_date, "%Y-%m-%d").date()
        req_end = datetime.strptime(request.email_end_date, "%Y-%m-%d").date()
        # Check if all user's Google accounts have this range fully scanned
        account_emails_query = db.query(OAuthToken.account_email).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.provider == "google",
            OAuthToken.is_revoked == 0
        )
        if request.email_account_ids:
            account_id_ints = [int(aid) for aid in request.email_account_ids if aid.isdigit()]
            if account_id_ints:
                account_emails_query = account_emails_query.filter(OAuthToken.id.in_(account_id_ints))
        account_emails = [row[0] for row in account_emails_query.all() if row[0]]

        if account_emails and all(
            not _get_uncovered_ranges(db, user_id, email, "email", req_start, req_end)
            for email in account_emails
        ):
            logger.info(f"Range {req_start}~{req_end} fully covered by scanned ranges for all {len(account_emails)} accounts — returning DB results")
            query = db.query(ExtractedTaskModel).filter(
                ExtractedTaskModel.user_id == user_id,
                ExtractedTaskModel.status == "pending"
            )
            query = _apply_date_filter(query, request.email_start_date, request.email_end_date)
            total = query.count()
            page_size = 10
            total_pages = math.ceil(total / page_size) if total > 0 else 1
            first_page = query.order_by(ExtractedTaskModel.source_date.desc().nullslast()).limit(page_size).all()

            return TaskExtractResponse(
                tasks=[ExtractedTask(
                    id=t.id, title=t.title, description=t.description,
                    source_type=t.source_type, source_id=t.source_id,
                    source_subject=t.source_subject, source_account=t.source_account,
                    source_date=t.source_date.isoformat() if t.source_date else None,
                    priority=t.priority,
                    due_date=t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
                    confidence=t.confidence, ai_summary=t.ai_summary,
                ) for t in first_page],
                sources_analyzed={"emails": 0, "new_emails": 0, "google_tasks": 0},
                extraction_time=round(time.time() - start_time, 2),
                new_tasks_count=0, from_cache=True,
                total=total, pending_count=total, page=1, page_size=page_size, total_pages=total_pages
            )

    new_tasks_count = 0
    google_tasks_count = 0
    sources_analyzed = {"emails": 0, "new_emails": 0, "google_tasks": 0}
    accounts_missing_tasks_scope = []  # Track accounts that need re-authorization
    email_filter_stats = None  # 3-stage filtering pipeline stats

    # Get already processed source IDs for this user (incremental extraction)
    processed = db.query(ProcessedSource.source_type, ProcessedSource.source_id).filter(
        ProcessedSource.user_id == user_id
    ).all()
    processed_sources = {(p.source_type, p.source_id) for p in processed}

    # Get OAuth tokens for the user (optionally filtered by account IDs)
    token_query = db.query(OAuthToken).filter(
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    )
    if request.email_account_ids:
        # Filter to specific accounts (IDs come as strings from frontend)
        account_id_ints = []
        for aid in request.email_account_ids:
            try:
                account_id_ints.append(int(aid))
            except (ValueError, TypeError):
                pass
        if account_id_ints:
            token_query = token_query.filter(OAuthToken.id.in_(account_id_ints))
    tokens = token_query.all()

    if not tokens:
        # Return existing pending tasks even if no tokens (filtered by date range, with pagination)
        query = db.query(ExtractedTaskModel).filter(
            ExtractedTaskModel.user_id == user_id,
            ExtractedTaskModel.status == "pending"
        )
        query = _apply_date_filter(query, request.email_start_date, request.email_end_date)
        total = query.count()
        page_size = 10
        total_pages = math.ceil(total / page_size) if total > 0 else 1
        first_page = query.order_by(ExtractedTaskModel.source_date.desc().nullslast()).limit(page_size).all()

        return TaskExtractResponse(
            tasks=[ExtractedTask(
                id=t.id,
                title=t.title,
                description=t.description,
                source_type=t.source_type,
                source_id=t.source_id,
                source_subject=t.source_subject,
                source_account=t.source_account,
                source_date=t.source_date.isoformat() if t.source_date else None,
                priority=t.priority,
                due_date=t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
                confidence=t.confidence,
                ai_summary=t.ai_summary,
            ) for t in first_page],
            sources_analyzed=sources_analyzed,
            extraction_time=round(time.time() - start_time, 2),
            new_tasks_count=0,
            from_cache=True,
            total=total,
            pending_count=total,
            page=1,
            page_size=page_size,
            total_pages=total_pages
        )

    # ==================== PARALLEL ACCOUNT PROCESSING ====================
    # Pre-refresh all tokens sequentially to avoid concurrent db.commit() on shared session
    for token in tokens:
        if not token.is_revoked:
            try:
                await refresh_token_if_expired(token, db)
            except Exception as e:
                logger.warning(f"Token refresh failed for {token.account_email}: {e}")

    # Process all accounts in parallel for 3-5x speedup
    logger.info(f"Processing {len(tokens)} accounts in parallel...")

    account_tasks = [
        _process_single_account(token, db, request, processed_sources, user_id)
        for token in tokens
    ]
    account_results = await asyncio.gather(*account_tasks)

    # Merge results from all accounts (with deduplication and batch operations)
    new_emails = []
    all_gtasks = []
    all_gtask_sources = []
    seen_gtask_ids = set()

    for result in account_results:
        # Log per-account results for debugging
        logger.info(f"Account {result.account_email}: {len(result.emails)} emails, "
                     f"error={result.error}, stats={result.stats}")
        # Collect emails
        new_emails.extend(result.emails)

        # Collect Google Tasks with cross-account deduplication
        for task in result.gtasks:
            if task.source_id not in seen_gtask_ids:
                all_gtasks.append(task)
                seen_gtask_ids.add(task.source_id)
        for source in result.gtask_sources:
            # Only add source if: 1) we added the task, 2) not already processed
            if source.source_id in seen_gtask_ids and (source.source_type, source.source_id) not in processed_sources:
                all_gtask_sources.append(source)
                processed_sources.add((source.source_type, source.source_id))

        # Track accounts missing tasks scope
        if result.missing_tasks_scope:
            accounts_missing_tasks_scope.append(result.account_email)

        # Aggregate stats
        for key, value in result.stats.items():
            sources_analyzed[key] = sources_analyzed.get(key, 0) + value

    # Batch add gtask items (more efficient than individual db.add())
    if all_gtasks:
        db.add_all(all_gtasks)
        google_tasks_count = len(all_gtasks)
    if all_gtask_sources:
        db.add_all(all_gtask_sources)

    logger.info(f"Parallel processing complete: {len(new_emails)} new emails, "
                f"{google_tasks_count} Google Tasks")

    # Extract tasks only from NEW emails using LLM with 3-stage pipeline:
    # Stage 1: Rule-based pre-filtering (blacklist domains, sender patterns)
    # 2-stage pipeline: Stage 1 blacklist → body fetch → LLM (classify + extract)
    # No regex-based Stage 2 — LLM handles both classification and extraction in one pass.
    # Regex can't understand semantic actionability ("contract expires March 1st"),
    # but the LLM can. The extraction prompt already includes skip rules, making
    # a separate regex classifier redundant and a source of false negatives.
    if new_emails:
        # Stage 1: Rule-based blacklist filtering (fast, no API calls)
        from modules.agents.work.src.services.email_filter import filter_emails_stage1
        stage1_emails, stage1_results = filter_emails_stage1(new_emails)
        stage1_filtered = len(new_emails) - len(stage1_emails)
        logger.info(f"Stage 1 blacklist: {len(new_emails)} → {len(stage1_emails)} emails ({stage1_filtered} filtered)")

        # Fetch full body for Stage 1 survivors
        # Cost: ~2-3 Gmail batch requests (~1s) — gives LLM real content instead of snippets
        account_tokens = {t.account_email: t for t in tokens}
        filtered_emails = stage1_emails  # All Stage 1 survivors go to LLM
        if filtered_emails:
            ids_by_account = {}
            for email in filtered_emails:
                acct = email.get("account_email", "")
                ids_by_account.setdefault(acct, []).append(email.get("id"))

            full_body_map = {}
            fetch_tasks = []
            for acct_email, ids in ids_by_account.items():
                token_obj = account_tokens.get(acct_email)
                if token_obj:
                    fetch_tasks.append(_fetch_full_bodies(token_obj, db, ids))
            if fetch_tasks:
                results = await asyncio.gather(*fetch_tasks, return_exceptions=True)
                for result in results:
                    if not isinstance(result, Exception):
                        full_body_map.update(result)

            for email in filtered_emails:
                email['body_text'] = full_body_map.get(email.get("id"), "")

            logger.info(f"Fetched full body for {len(full_body_map)} of {len(filtered_emails)} emails")

        email_filter_stats = {
            "total_input": len(new_emails),
            "stage1_filtered": stage1_filtered,
            "final_for_llm": len(filtered_emails),
        }

        logger.info(f"Sending {len(filtered_emails)} emails to LLM for classification + extraction")
        sources_analyzed["emails_filtered"] = stage1_filtered

        # ---- ASYNC BACKGROUND EXTRACTION for large batches ----
        # Cloudflare times out at ~100s. If we have many emails, the LLM pipeline
        # will take several minutes. Instead, fire off extraction in the background,
        # return cached results immediately, and let frontend poll for completion.
        BG_THRESHOLD = 50  # emails; below this, run inline (fast enough)
        bg_already_running = _bg_extraction.get(user_id, {}).get("status") == "running"
        if len(filtered_emails) > BG_THRESHOLD and bg_already_running:
            # Background extraction already running — return status without launching another
            logger.info(f"Background extraction already running for user {user_id}, returning in-progress status")
            query = db.query(ExtractedTaskModel).filter(
                ExtractedTaskModel.user_id == user_id,
                ExtractedTaskModel.status == "pending"
            )
            query = _apply_date_filter(query, request.email_start_date, request.email_end_date)
            total = query.count()
            page_size = 10
            total_pages = math.ceil(total / page_size) if total > 0 else 1
            first_page = query.order_by(ExtractedTaskModel.source_date.desc().nullslast()).limit(page_size).all()
            return TaskExtractResponse(
                tasks=[ExtractedTask(
                    id=t.id, title=t.title, description=t.description,
                    source_type=t.source_type, source_id=t.source_id,
                    source_subject=t.source_subject, source_account=t.source_account,
                    source_date=t.source_date.isoformat() if t.source_date else None,
                    priority=t.priority,
                    due_date=t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
                    confidence=t.confidence, ai_summary=t.ai_summary,
                ) for t in first_page],
                sources_analyzed=sources_analyzed,
                extraction_time=round(time.time() - start_time, 2),
                filter_stats=email_filter_stats,
                new_tasks_count=0,
                from_cache=False,
                extraction_in_progress=True,
                total=total, pending_count=total,
                page=1, page_size=page_size, total_pages=total_pages,
            )
        if len(filtered_emails) > BG_THRESHOLD:
            logger.info(f"Large batch ({len(filtered_emails)} emails > {BG_THRESHOLD}): "
                         f"launching background extraction")

            # Mark all fetched emails as processed NOW (so next poll doesn't re-fetch them)
            email_source_ids_bg = [email.get("id", "") for email in new_emails if email.get("id")]
            existing_processed_bg = set()
            if email_source_ids_bg:
                existing_records = db.query(ProcessedSource.source_id).filter(
                    ProcessedSource.user_id == user_id,
                    ProcessedSource.source_type == "email",
                    ProcessedSource.source_id.in_(email_source_ids_bg)
                ).all()
                existing_processed_bg = {r.source_id for r in existing_records}
            new_sources_bg = []
            for email in new_emails:
                source_id = email.get("id", "")
                if source_id and source_id not in existing_processed_bg:
                    new_sources_bg.append(ProcessedSource(
                        user_id=user_id,
                        source_type="email",
                        source_id=source_id,
                        source_account=email.get("account_email"),
                        tasks_extracted=0
                    ))
            if new_sources_bg:
                db.add_all(new_sources_bg)

            # Record scanned ranges NOW so next poll sees them
            if "email" in request.sources and request.email_start_date and request.email_end_date:
                for result in account_results:
                    if result.error:
                        continue
                    _record_scanned_range(
                        db, user_id, result.account_email, "email",
                        datetime.strptime(request.email_start_date, "%Y-%m-%d").date(),
                        datetime.strptime(request.email_end_date, "%Y-%m-%d").date()
                    )

            db.commit()
            _update_extraction_cache(cache_key)

            # Prepare data for background task (deep copy what's needed; DB session is NOT thread-safe)
            bg_emails = filtered_emails[:]  # shallow copy of list
            bg_new_emails = new_emails[:]
            bg_user_id = user_id
            bg_account_results = account_results
            bg_request = request

            async def _run_bg_extraction():
                """Background extraction — streaming pipeline, saves tasks INCREMENTALLY.

                Instead of summarizing ALL emails first then extracting, this processes
                one summarize batch at a time: summarize batch → extract actionable → save.
                First tasks can appear after ~20-30s instead of waiting for all summaries.
                """
                from backend.db.database import SessionLocal
                bg_db = SessionLocal()
                total_saved = 0
                try:
                    _bg_extraction[bg_user_id] = {
                        "status": "running",
                        "progress": f"Analyzing {len(bg_emails)} emails...",
                        "started_at": time.time(),
                        "new_tasks_count": 0,
                    }

                    # Build mappings once (used when saving tasks)
                    source_to_account = {e.get("id", ""): e.get("account_email", "") for e in bg_new_emails}
                    source_to_subject = {e.get("id", ""): e.get("subject", "")[:200] for e in bg_new_emails}
                    source_to_date = {}
                    for email_item in bg_new_emails:
                        eid = email_item.get("id", "")
                        edate = email_item.get("date") or email_item.get("internalDate")
                        if edate:
                            try:
                                if isinstance(edate, str) and edate.isdigit():
                                    source_to_date[eid] = datetime.fromtimestamp(int(edate) / 1000, tz=timezone.utc)
                                elif isinstance(edate, str):
                                    source_to_date[eid] = datetime.fromisoformat(edate.replace("Z", "+00:00"))
                            except (ValueError, TypeError):
                                pass
                    valid_source_ids = {e.get("id", "") for e in bg_emails if e.get("id")}

                    import httpx

                    SUMMARIZE_BATCH = 10
                    EXTRACT_BATCH = 5
                    vllm_base = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
                    vllm_model = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")
                    llm_semaphore = asyncio.Semaphore(5)

                    # Pre-build email metadata maps
                    email_subject_map = {e.get("id", ""): e.get("subject", "")[:120] for e in bg_emails}
                    email_from_map = {}
                    for e in bg_emails:
                        sender = e.get("from", {})
                        if isinstance(sender, dict):
                            email_from_map[e.get("id", "")] = (sender.get('name', '') or sender.get('email', ''))[:60]
                        else:
                            email_from_map[e.get("id", "")] = str(sender)[:60]

                    # Track already-existing source_ids to skip duplicates
                    existing_sids = set()
                    all_candidate_sids = [e.get("id", "") for e in bg_emails if e.get("id")]
                    if all_candidate_sids:
                        existing_records = bg_db.query(ExtractedTaskModel.source_id).filter(
                            ExtractedTaskModel.user_id == bg_user_id,
                            ExtractedTaskModel.source_id.in_(all_candidate_sids),
                            ExtractedTaskModel.status == "pending"
                        ).all()
                        existing_sids = {r.source_id for r in existing_records}

                    # Summarize response schema (same as _extract_tasks_with_llm_summarize_only)
                    SUMMARIZE_RESPONSE_SCHEMA = {
                        "type": "object",
                        "properties": {
                            "summaries": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "id": {"type": "string"},
                                        "summary": {"type": "string"},
                                        "actionable": {"type": "boolean"},
                                    },
                                    "required": ["id", "summary", "actionable"],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["summaries"],
                        "additionalProperties": False,
                    }

                    def _prepare_summarize_data(email_batch):
                        data = []
                        for email in email_batch:
                            sender = email.get("from", {})
                            if isinstance(sender, dict):
                                sender_str = sender.get('name', '') or sender.get('email', '')
                            else:
                                sender_str = str(sender)
                            body = email.get("body_text") or email.get("body_plain") or email.get("snippet", "")
                            body = _strip_quoted_replies(body)
                            data.append({
                                "id": email.get("id", ""),
                                "subject": email.get("subject", "")[:120],
                                "from": sender_str[:60],
                                "body": body[:600],
                            })
                        return data

                    async def _call_summarize_batch(email_data, client):
                        today = datetime.now().strftime("%Y-%m-%d")
                        prompt = f"""Summarize each email in 2-3 sentences. Mark if it requires action.
Today's date: {today}

EMAILS:
{json.dumps(email_data, separators=(',', ':'))}

IMPORTANT: Pay close attention to the subject line — it often signals intent directly (e.g., "ACTION REQUIRED:", "RE: Deadline extension", "FYI:", "Invitation:").

For each email, return:
- id: exact id from above
- summary: 2-3 sentences. Sentence 1: who sent it and the core request/information. Sentence 2: key details (deadlines, amounts, names, specifics). Sentence 3 (if needed): any conditions or context that affects urgency.
- actionable: true if the recipient needs to DO something (reply, review, approve, attend, prepare, submit, sign, decide, etc.), false if purely informational (FYI, newsletter, receipt, confirmation, greeting, auto-notification, shipping update)

Return a JSON object: {{"summaries": [{{...}}, ...]}}"""

                        async with llm_semaphore:
                            response = await client.post(
                                f"{vllm_base}/chat/completions",
                                json={
                                    "model": vllm_model,
                                    "messages": [
                                        {"role": "system", "content": "Summarize emails. Return JSON only."},
                                        {"role": "user", "content": prompt}
                                    ],
                                    "temperature": 0.1,
                                    "max_tokens": 800,
                                    "response_format": {
                                        "type": "json_schema",
                                        "json_schema": {
                                            "name": "email_summaries",
                                            "strict": True,
                                            "schema": SUMMARIZE_RESPONSE_SCHEMA,
                                        }
                                    },
                                }
                            )

                        if response.status_code != 200:
                            logger.error(f"BG Summarize LLM error: {response.status_code} - {response.text[:200]}")
                            raise RuntimeError(f"Summarize LLM returned HTTP {response.status_code}")

                        choices = response.json().get("choices") or []
                        if not choices:
                            raise RuntimeError("Summarize LLM returned empty choices")
                        content = choices[0].get("message", {}).get("content", "{}")

                        try:
                            parsed = json.loads(content)
                        except json.JSONDecodeError:
                            return []

                        if isinstance(parsed, dict) and "summaries" in parsed:
                            return parsed["summaries"]
                        elif isinstance(parsed, list):
                            return parsed
                        return []

                    def _is_actionable(s):
                        if not isinstance(s, dict):
                            return False
                        val = s.get("actionable")
                        return val is True or val == "true" or val == "yes" or val == 1

                    # --- Overlapping streaming pipeline ---
                    # Run SUMMARIZE_CONCURRENT summarize batches concurrently, then extract
                    # from each group as it completes. This gives fast first-task (~20-30s)
                    # AND near-original total throughput.
                    SUMMARIZE_CONCURRENT = 3
                    summarize_batches = [bg_emails[i:i + SUMMARIZE_BATCH]
                                         for i in range(0, len(bg_emails), SUMMARIZE_BATCH)]
                    total_batches = len(summarize_batches)
                    summary_map = {}  # accumulate for ai_summary field

                    logger.info(f"BG streaming pipeline: {len(bg_emails)} emails in {total_batches} summarize batches (concurrency={SUMMARIZE_CONCURRENT})")

                    async with httpx.AsyncClient(timeout=90.0) as client:
                        for group_start in range(0, total_batches, SUMMARIZE_CONCURRENT):
                            group = summarize_batches[group_start:group_start + SUMMARIZE_CONCURRENT]
                            group_end = min(group_start + SUMMARIZE_CONCURRENT, total_batches)
                            _bg_extraction[bg_user_id]["progress"] = (
                                f"Summarizing batches {group_start + 1}-{group_end}/{total_batches}... "
                                f"({total_saved} tasks found so far)"
                            )

                            # 1) Summarize group concurrently
                            summarize_coros = [
                                _call_summarize_batch(_prepare_summarize_data(eb), client)
                                for eb in group
                            ]
                            summarize_results = await asyncio.gather(*summarize_coros, return_exceptions=True)

                            # 2) Collect actionable items from all results in this group
                            actionable_items = []
                            for idx, sr in enumerate(summarize_results):
                                batch_num = group_start + idx + 1
                                if isinstance(sr, Exception):
                                    logger.error(f"BG summarize batch {batch_num} failed: {sr}")
                                    continue
                                for s in sr:
                                    sid = s.get("id", "")
                                    text = (s.get("summary") or "").strip()
                                    if sid and text:
                                        summary_map[sid] = text
                                    if _is_actionable(s) and sid and sid not in existing_sids:
                                        actionable_items.append({
                                            "id": sid,
                                            "subject": email_subject_map.get(sid, ""),
                                            "from": email_from_map.get(sid, ""),
                                            "summary": text[:200],
                                        })

                            if not actionable_items:
                                logger.info(f"BG batches {group_start + 1}-{group_end}: no actionable emails, skipping extract")
                                continue

                            # 3) Extract tasks from actionable emails
                            _bg_extraction[bg_user_id]["progress"] = (
                                f"Extracting from {len(actionable_items)} actionable (batches {group_start + 1}-{group_end})... "
                                f"({total_saved} tasks found so far)"
                            )

                            extract_batches = [actionable_items[i:i + EXTRACT_BATCH]
                                               for i in range(0, len(actionable_items), EXTRACT_BATCH)]

                            coros = [_call_extract_standalone(eb, vllm_base, vllm_model, llm_semaphore, client)
                                     for eb in extract_batches]
                            results = await asyncio.gather(*coros, return_exceptions=True)

                            # 4) Save extracted tasks immediately
                            batch_tasks = []
                            for result in results:
                                if isinstance(result, Exception):
                                    logger.error(f"BG extract (batches {group_start + 1}-{group_end}) failed: {result}")
                                    continue
                                for t in result:
                                    if t.source_id in existing_sids or t.source_id not in valid_source_ids:
                                        continue
                                    existing_sids.add(t.source_id)
                                    due_date = None
                                    if t.due_date:
                                        try:
                                            due_date = datetime.strptime(t.due_date, "%Y-%m-%d")
                                        except ValueError:
                                            pass
                                    pass1_summary = summary_map.get(t.source_id)
                                    ai_summary = [pass1_summary] if pass1_summary else None
                                    batch_tasks.append(ExtractedTaskModel(
                                        user_id=bg_user_id,
                                        title=t.title,
                                        description=t.description,
                                        priority=t.priority,
                                        due_date=due_date,
                                        confidence=t.confidence,
                                        ai_summary=ai_summary,
                                        source_type=t.source_type,
                                        source_id=t.source_id,
                                        source_subject=source_to_subject.get(t.source_id) or t.source_subject or "",
                                        source_account=source_to_account.get(t.source_id, ""),
                                        source_date=source_to_date.get(t.source_id),
                                    ))

                            if batch_tasks:
                                bg_db.add_all(batch_tasks)
                                bg_db.commit()
                                total_saved += len(batch_tasks)
                                _bg_extraction[bg_user_id]["new_tasks_count"] = total_saved
                                logger.info(f"BG batches {group_start + 1}-{group_end}: saved {len(batch_tasks)} tasks (total: {total_saved})")

                    logger.info(f"Background extraction complete: {total_saved} tasks from {len(bg_emails)} emails")
                    _bg_extraction[bg_user_id] = {
                        "status": "done",
                        "progress": f"Done! Extracted {total_saved} tasks from {len(bg_emails)} emails",
                        "new_tasks_count": total_saved,
                        "started_at": _bg_extraction[bg_user_id].get("started_at"),
                    }
                except Exception as e:
                    logger.error(f"Background extraction failed: {type(e).__name__}: {e}")
                    _bg_extraction[bg_user_id] = {
                        "status": "error",
                        "progress": f"Extraction failed: {str(e)[:100]}",
                        "new_tasks_count": total_saved,
                    }
                    bg_db.rollback()
                finally:
                    bg_db.close()

            asyncio.create_task(_run_bg_extraction())

            # Return existing cached results immediately with extraction_in_progress=True
            query = db.query(ExtractedTaskModel).filter(
                ExtractedTaskModel.user_id == user_id,
                ExtractedTaskModel.status == "pending"
            )
            query = _apply_date_filter(query, request.email_start_date, request.email_end_date)
            total = query.count()
            page_size = 10
            total_pages = math.ceil(total / page_size) if total > 0 else 1
            first_page = query.order_by(ExtractedTaskModel.source_date.desc().nullslast()).limit(page_size).all()

            return TaskExtractResponse(
                tasks=[ExtractedTask(
                    id=t.id, title=t.title, description=t.description,
                    source_type=t.source_type, source_id=t.source_id,
                    source_subject=t.source_subject, source_account=t.source_account,
                    source_date=t.source_date.isoformat() if t.source_date else None,
                    priority=t.priority,
                    due_date=t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
                    confidence=t.confidence, ai_summary=t.ai_summary,
                ) for t in first_page],
                sources_analyzed=sources_analyzed,
                extraction_time=round(time.time() - start_time, 2),
                filter_stats=email_filter_stats,
                new_tasks_count=0,
                from_cache=False,
                extraction_in_progress=True,
                total=total, pending_count=total,
                page=1, page_size=page_size, total_pages=total_pages,
            )
        # ---- END ASYNC BACKGROUND EXTRACTION ----

        # LLM extraction — handles classification (skip/extract) and task extraction in one pass
        new_extracted, summary_map = await _extract_tasks_with_llm(filtered_emails)

        # Create mappings for source_id to account, subject, and date
        source_to_account = {email.get("id", ""): email.get("account_email", "") for email in new_emails}
        source_to_subject = {email.get("id", ""): email.get("subject", "")[:200] for email in new_emails}
        source_to_date = {}
        for email in new_emails:
            email_id = email.get("id", "")
            email_date = email.get("date") or email.get("internalDate")
            if email_date:
                try:
                    # Handle different date formats
                    if isinstance(email_date, str) and email_date.isdigit():
                        # internalDate is in milliseconds since epoch (UTC)
                        source_to_date[email_id] = datetime.fromtimestamp(int(email_date) / 1000, tz=timezone.utc)
                    elif isinstance(email_date, str):
                        source_to_date[email_id] = datetime.fromisoformat(email_date.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass

        # Batch check which source_ids already exist (1 query instead of N)
        existing_source_ids = set()
        if new_extracted:
            source_ids_to_check = [t.source_id for t in new_extracted]
            existing_records = db.query(ExtractedTaskModel.source_id).filter(
                ExtractedTaskModel.user_id == user_id,
                ExtractedTaskModel.source_id.in_(source_ids_to_check),
                ExtractedTaskModel.status == "pending"
            ).all()
            existing_source_ids = {r.source_id for r in existing_records}

        # Valid source_ids from filtered emails only (LLM only sees these)
        valid_source_ids = {email.get("id", "") for email in filtered_emails if email.get("id")}

        # Save new extracted tasks (batch)
        new_tasks_to_add = []
        skipped_invalid = 0
        for task_data in new_extracted:
            # Skip if already exists in DB
            if task_data.source_id in existing_source_ids:
                continue
            # Skip if LLM hallucinated an invalid source_id
            if task_data.source_id not in valid_source_ids:
                skipped_invalid += 1
                continue

            # Parse due date
            due_date = None
            if task_data.due_date:
                try:
                    due_date = datetime.strptime(task_data.due_date, "%Y-%m-%d")
                except ValueError:
                    pass

            # Use Pass 1 summary as ai_summary (avoids extra LLM call when user views task)
            pass1_summary = summary_map.get(task_data.source_id)
            ai_summary = [pass1_summary] if pass1_summary else None

            new_tasks_to_add.append(ExtractedTaskModel(
                user_id=user_id,
                title=task_data.title,
                description=task_data.description,
                priority=task_data.priority,
                due_date=due_date,
                confidence=task_data.confidence,
                ai_summary=ai_summary,
                source_type=task_data.source_type,
                source_id=task_data.source_id,
                source_subject=source_to_subject.get(task_data.source_id) or task_data.source_subject or "",
                source_account=source_to_account.get(task_data.source_id, ""),
                source_date=source_to_date.get(task_data.source_id),
            ))

        if new_tasks_to_add:
            db.add_all(new_tasks_to_add)
            new_tasks_count = len(new_tasks_to_add)

        # Batch check and add processed sources (1 query instead of N)
        email_source_ids = [email.get("id", "") for email in new_emails if email.get("id")]
        existing_processed = set()
        if email_source_ids:
            existing_records = db.query(ProcessedSource.source_id).filter(
                ProcessedSource.user_id == user_id,
                ProcessedSource.source_type == "email",
                ProcessedSource.source_id.in_(email_source_ids)
            ).all()
            existing_processed = {r.source_id for r in existing_records}

        new_sources_to_add = []
        for email in new_emails:
            source_id = email.get("id", "")
            if source_id and source_id not in existing_processed:
                new_sources_to_add.append(ProcessedSource(
                    user_id=user_id,
                    source_type="email",
                    source_id=source_id,
                    source_account=email.get("account_email"),
                    tasks_extracted=0
                ))

        if new_sources_to_add:
            db.add_all(new_sources_to_add)

        if skipped_invalid > 0:
            logger.warning(f"Skipped {skipped_invalid} tasks with invalid source_ids (LLM hallucination)")
        logger.info(f"Prepared {new_tasks_count} new AI-extracted tasks from emails")

    # ==================== STALE TASK CLEANUP ====================
    # Auto-dismiss pending extracted tasks whose source no longer exists in the APIs.
    # This handles: deleted emails, completed Google Tasks.
    # Zero extra API calls — reuses source IDs already fetched above.
    live_source_ids = {
        "email": set(),
        "gtask": set(),
    }
    accounts_fetched = {"email": set(), "gtask": set()}
    for result in account_results:
        if result.error:
            continue
        # Only mark source types that were actually queried and returned complete results.
        # None means: error, truncated, or not queried — skip stale cleanup for that type.
        if "email" in request.sources and result.live_email_ids is not None:
            live_source_ids["email"].update(result.live_email_ids)
            accounts_fetched["email"].add(result.account_email)
        if result.live_gtask_ids is not None:
            live_source_ids["gtask"].update(result.live_gtask_ids)
            accounts_fetched["gtask"].add(result.account_email)

    # Compute the date ranges we actually queried (to avoid false positives on older tasks)
    # Only check tasks whose source_date falls within the queried range
    email_range_start = None
    email_range_end = None
    if request.email_start_date and request.email_end_date:
        email_range_start = datetime.strptime(request.email_start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        email_range_end = (datetime.strptime(request.email_end_date, "%Y-%m-%d") + timedelta(days=1)).replace(tzinfo=timezone.utc)
    elif request.email_days_back:
        email_range_start = (datetime.now(timezone.utc) - timedelta(days=request.email_days_back))
        email_range_end = datetime.now(timezone.utc) + timedelta(days=1)

    def _is_in_queried_range(task) -> bool:
        """Check if task's source_date falls within the date range we queried from the API."""
        if not task.source_date:
            return False  # No date → can't verify, skip to avoid false dismissal
        sd = task.source_date
        if sd.tzinfo is None:
            sd = sd.replace(tzinfo=timezone.utc)
        if task.source_type == "email" and email_range_start and email_range_end:
            return email_range_start <= sd <= email_range_end
        elif task.source_type == "gtask":
            return True  # Google Tasks API returns ALL incomplete tasks (no date range)
        return False  # Unknown type or no range → skip

    # Find pending tasks from accounts we successfully fetched
    stale_dismissed = 0
    if any(accounts_fetched.values()):
        pending_tasks = db.query(ExtractedTaskModel).filter(
            ExtractedTaskModel.user_id == user_id,
            ExtractedTaskModel.status == "pending"
        ).all()

        for task in pending_tasks:
            src_type = task.source_type
            src_account = task.source_account or ""
            # Only check tasks from accounts we actually fetched (avoid false positives)
            if src_account not in accounts_fetched.get(src_type, set()):
                continue
            # Only check tasks within the date range we queried (avoid dismissing older tasks)
            if not _is_in_queried_range(task):
                continue
            # If this task's source_id is not in the live set, it was deleted/cancelled
            if task.source_id not in live_source_ids.get(src_type, set()):
                task.status = "dismissed"
                task.processed_at = datetime.now(timezone.utc)
                stale_dismissed += 1

        if stale_dismissed > 0:
            logger.info(f"Auto-dismissed {stale_dismissed} stale tasks (source deleted/cancelled)")
            sources_analyzed["stale_dismissed"] = stale_dismissed

    # Single commit for all changes (atomic operation)
    has_changes = new_emails or google_tasks_count > 0 or stale_dismissed > 0
    if has_changes:
        db.commit()
        logger.info(f"Committed: {new_tasks_count} email tasks, "
                     f"{google_tasks_count} Google Tasks, {stale_dismissed} stale dismissed")
    else:
        logger.info("No new sources to process - returning cached tasks")

    # Return pending extracted tasks filtered by the requested date range
    query = db.query(ExtractedTaskModel).filter(
        ExtractedTaskModel.user_id == user_id,
        ExtractedTaskModel.status == "pending"
    )
    query = _apply_date_filter(query, request.email_start_date, request.email_end_date)

    # Get total count before pagination
    total = query.count()
    page_size = 10  # Match frontend EXTRACTED_TASKS_PAGE_SIZE
    total_pages = math.ceil(total / page_size) if total > 0 else 1

    # Return first page only (paginated)
    first_page = query.order_by(ExtractedTaskModel.source_date.desc().nullslast()).limit(page_size).all()
    logger.info(f"Returning page 1 of {total_pages} ({len(first_page)} of {total} total pending tasks)")

    # Record successfully scanned date ranges (for overlap optimization on next extraction)
    # _record_scanned_range deduplicates and compacts, so safe to call on every extraction.
    if "email" in request.sources and request.email_start_date and request.email_end_date:
        try:
            for result in account_results:
                if result.error:
                    continue
                _record_scanned_range(
                    db, user_id, result.account_email, "email",
                    datetime.strptime(request.email_start_date, "%Y-%m-%d").date(),
                    datetime.strptime(request.email_end_date, "%Y-%m-%d").date()
                )
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Failed to commit scanned ranges: {e}")

    # Determine if results are from cache (no new extraction happened)
    from_cache = (not new_emails or len(new_emails) == 0) and google_tasks_count == 0 and stale_dismissed == 0

    # Update extraction cache to prevent repeated external API calls
    _update_extraction_cache(cache_key)

    return TaskExtractResponse(
        tasks=[ExtractedTask(
            id=t.id,  # Include DB ID for add/dismiss operations
            title=t.title,
            description=t.description,
            source_type=t.source_type,
            source_id=t.source_id,
            source_subject=t.source_subject,
            source_account=t.source_account,
            source_date=t.source_date.isoformat() if t.source_date else None,
            priority=t.priority,
            due_date=t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
            confidence=t.confidence,
            ai_summary=t.ai_summary,
        ) for t in first_page],
        sources_analyzed=sources_analyzed,
        extraction_time=round(time.time() - start_time, 2),
        accounts_missing_tasks_scope=accounts_missing_tasks_scope,
        filter_stats=email_filter_stats,
        new_tasks_count=new_tasks_count + google_tasks_count,
        from_cache=from_cache,
        # Pagination info for frontend to use directly
        total=total,
        pending_count=total,
        page=1,
        page_size=page_size,
        total_pages=total_pages
    )


def _strip_quoted_replies(text: str) -> str:
    """Strip quoted reply chains, keeping only the latest message."""
    if not text:
        return ""
    separators = [
        r'\nOn .+ wrote:\s*\n',           # Gmail
        r'\n-+\s*Original Message\s*-+',   # Outlook
        r'\nFrom:.+\nSent:.+\nTo:',        # Outlook headers
    ]
    for sep in separators:
        match = re.search(sep, text, re.IGNORECASE)
        if match:
            text = text[:match.start()]
    # Also strip lines starting with > (quoted text)
    lines = text.split('\n')
    lines = [l for l in lines if not l.strip().startswith('>')]
    return '\n'.join(lines).strip()


async def _fetch_full_bodies(token, db, email_ids: List[str]) -> dict:
    """Fetch full body text for a list of email IDs. Returns {email_id: body_plain}."""
    from modules.agents.work.src.services.google_oauth import GmailService

    try:
        await refresh_token_if_expired(token, db)
        credentials = google_oauth_service.get_credentials(
            token.get_access_token(),
            token.get_refresh_token()
        )
        gmail_service = GmailService(credentials)
        full_messages = await asyncio.to_thread(
            gmail_service.get_messages_by_ids, email_ids, "full"
        )
        result = {}
        for msg in full_messages:
            msg_id = msg.get("id", "")
            # Prefer plain text for LLM (no HTML tags)
            body = msg.get("body_plain") or msg.get("body", "") or ""
            # Strip HTML tags and decode entities if we got HTML content
            if "<" in body and ">" in body:
                body = re.sub(r'<[^>]+>', ' ', body)
                body = html_module.unescape(body)  # Decode &amp; &nbsp; &#39; etc.
                body = re.sub(r'\s+', ' ', body).strip()
            result[msg_id] = body
        return result
    except Exception as e:
        logger.warning(f"Error fetching full bodies: {e}")
        return {}


async def _extract_tasks_with_llm(emails: list) -> tuple:
    """
    Two-pass LLM pipeline for task extraction.

    Returns:
        Tuple of (tasks: List[ExtractedTask], summary_map: Dict[str, str])
        summary_map maps source_id → Pass 1 summary text (for pre-populating ai_summary)

    Pass 1 (Summarize): Distill each email to a 2-3 sentence summary + actionable flag.
    Pass 2 (Extract):   Extract structured tasks from actionable summaries only.
    """
    import httpx

    SUMMARIZE_BATCH = 10  # emails per summarize call (body[:600] ≈ 150 tokens × 10 = 1500, well within 8K context)
    EXTRACT_BATCH = 5     # emails per extract call — LLM outputs email_index, we map to source_id

    vllm_base = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
    vllm_model = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")
    llm_semaphore = asyncio.Semaphore(5)  # vLLM handles concurrency well via PagedAttention

    # ------------------------------------------------------------------
    # JSON Schemas for vLLM guided generation (strict: True)
    # Root must be "type": "object" for OpenAI-compatible structured outputs
    # ------------------------------------------------------------------
    SUMMARIZE_RESPONSE_SCHEMA = {
        "type": "object",
        "properties": {
            "summaries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "summary": {"type": "string"},
                        "actionable": {"type": "boolean"},
                    },
                    "required": ["id", "summary", "actionable"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["summaries"],
        "additionalProperties": False,
    }

    # source_id is NOT in the schema — LLM outputs email_index (0-based),
    # we map it back to the correct source_id from the input batch.
    EXTRACT_RESPONSE_SCHEMA = {
        "type": "object",
        "properties": {
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "email_index": {"type": "integer"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"]},
                        "due_date": {"type": ["string", "null"]},
                        "confidence": {"type": "number"},
                    },
                    "required": ["email_index", "title", "description", "priority", "due_date", "confidence"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["tasks"],
        "additionalProperties": False,
    }

    # ==================== Pass 1: Batch Summarize ====================
    def _prepare_summarize_data(email_batch):
        data = []
        for email in email_batch:
            sender = email.get("from", {})
            if isinstance(sender, dict):
                sender_str = sender.get('name', '') or sender.get('email', '')
            else:
                sender_str = str(sender)
            body = email.get("body_text") or email.get("body_plain") or email.get("snippet", "")
            body = _strip_quoted_replies(body)
            data.append({
                "id": email.get("id", ""),
                "subject": email.get("subject", "")[:120],
                "from": sender_str[:60],
                "body": body[:600],  # ~150 tokens per email; 10 × 150 + prompt ≈ 2500 input tokens (safe for 8K context)
            })
        return data

    async def _call_summarize(email_data, client):
        today = datetime.now().strftime("%Y-%m-%d")
        prompt = f"""Summarize each email in 2-3 sentences. Mark if it requires action.
Today's date: {today}

EMAILS:
{json.dumps(email_data, separators=(',', ':'))}

IMPORTANT: Pay close attention to the subject line — it often signals intent directly (e.g., "ACTION REQUIRED:", "RE: Deadline extension", "FYI:", "Invitation:").

For each email, return:
- id: exact id from above
- summary: 2-3 sentences. Sentence 1: who sent it and the core request/information. Sentence 2: key details (deadlines, amounts, names, specifics). Sentence 3 (if needed): any conditions or context that affects urgency.
- actionable: true if the recipient needs to DO something (reply, review, approve, attend, prepare, submit, sign, decide, etc.), false if purely informational (FYI, newsletter, receipt, confirmation, greeting, auto-notification, shipping update)

Return a JSON object: {{"summaries": [{{...}}, ...]}}"""

        async with llm_semaphore:
            response = await client.post(
                f"{vllm_base}/chat/completions",
                json={
                    "model": vllm_model,
                    "messages": [
                        {"role": "system", "content": "Summarize emails. Return JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 800,  # 10 summaries × ~60-80 tokens each ≈ 600-800
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "email_summaries",
                            "strict": True,
                            "schema": SUMMARIZE_RESPONSE_SCHEMA,
                        }
                    },
                }
            )

        if response.status_code != 200:
            logger.error(f"Summarize LLM error: {response.status_code} - {response.text[:200]}")
            raise RuntimeError(f"Summarize LLM returned HTTP {response.status_code}")

        choices = response.json().get("choices") or []
        if not choices:
            raise RuntimeError("Summarize LLM returned empty choices")
        content = choices[0].get("message", {}).get("content", "{}")

        # With strict schema, output is guaranteed valid JSON object
        # Parse and unwrap {"summaries": [...]} wrapper
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            # Fallback: try legacy array parsing if schema enforcement failed
            logger.warning(f"Summarize: strict JSON parse failed, trying fallback: {content[:200]}")
            summaries = _parse_json_array(content)
            if not summaries and email_data:
                raise RuntimeError(f"Summarize LLM returned 0 parseable summaries for {len(email_data)} emails")
            return summaries

        # Unwrap object wrapper or accept raw array for backward compat
        if isinstance(parsed, dict) and "summaries" in parsed:
            summaries = parsed["summaries"]
        elif isinstance(parsed, list):
            summaries = parsed
        else:
            summaries = []

        if not summaries and email_data:
            logger.warning(f"Summarize LLM returned 0 summaries for {len(email_data)} emails: {content[:200]}")
            raise RuntimeError(f"Summarize LLM returned 0 parseable summaries for {len(email_data)} emails")
        return summaries

    # ==================== Pass 2: Batch Extract ====================
    async def _call_extract(batch, client):
        """Extract tasks from a batch of email summaries.

        LLM outputs email_index (0-based) for each task.
        We map it back to the correct source_id/source_subject from the batch.
        """
        today = datetime.now().strftime("%Y-%m-%d")

        # Build numbered list (no IDs exposed to LLM)
        email_lines = []
        for i, item in enumerate(batch):
            email_lines.append(f"[{i}] Subject: {item.get('subject','')}\n    From: {item.get('from','')}\n    Summary: {item.get('summary','')}")
        emails_str = "\n".join(email_lines)

        prompt = f"""Extract actionable tasks from these emails.
Today's date: {today}

EMAILS:
{emails_str}

For each task:
- email_index: the [index] number of the source email (0-based integer)
- title: MUST be specific and descriptive. Start with a strong action verb, include the specific WHAT and WHO/FROM.
  GOOD: "Reply to Sarah Chen with updated Q3 revenue projections by Friday"
  BAD: "Review document" / "Reply to email" (too vague!)
- description: 1-2 sentences of context
- priority: "urgent" (deadline <24h or ASAP) / "high" (deadline <1 week) / "medium" (standard) / "low" (nice-to-have)
- due_date: "YYYY-MM-DD" or null
- confidence: 0.9+ (explicit action) / 0.7-0.9 (implied) / 0.5-0.7 (unclear)

Return a JSON object: {{"tasks": [{{...}}, ...]}}
If no tasks found, return: {{"tasks": []}}"""

        async with llm_semaphore:
            response = await client.post(
                f"{vllm_base}/chat/completions",
                json={
                    "model": vllm_model,
                    "messages": [
                        {"role": "system", "content": "Extract tasks from emails. Return JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 1500,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "extracted_tasks",
                            "strict": True,
                            "schema": EXTRACT_RESPONSE_SCHEMA,
                        }
                    },
                }
            )

        if response.status_code != 200:
            logger.error(f"Extract LLM error: {response.status_code} - {response.text[:200]}")
            raise RuntimeError(f"Extract LLM returned HTTP {response.status_code}")

        choices = response.json().get("choices") or []
        if not choices:
            raise RuntimeError("Extract LLM returned empty choices")
        content = choices[0].get("message", {}).get("content", "{}")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            logger.warning(f"Extract: strict JSON parse failed, trying fallback: {content[:200]}")
            # Fallback: if only 1 email in batch, assign all tasks to it
            if len(batch) == 1:
                return _parse_llm_tasks(content, source_id=batch[0]["id"], source_subject=batch[0].get("subject", ""))
            return []

        if isinstance(parsed, dict) and "tasks" in parsed:
            task_list = parsed["tasks"]
        elif isinstance(parsed, list):
            task_list = parsed
        else:
            task_list = []

        # Map email_index → source_id/source_subject
        result = []
        for t in task_list:
            if not isinstance(t, dict) or not t.get("title"):
                continue
            idx = t.get("email_index", 0)
            # Coerce to int (handles float like 0.0 or string "0" from non-strict fallback)
            try:
                idx = int(idx)
            except (ValueError, TypeError):
                idx = -1
            if idx < 0 or idx >= len(batch):
                # Fallback: if batch has 1 email, use it; otherwise skip
                if len(batch) == 1:
                    idx = 0
                else:
                    logger.warning(f"LLM returned invalid email_index={idx} for batch size={len(batch)}, skipping task '{t.get('title','')[:50]}'")
                    continue
            src = batch[idx]
            try:
                confidence = min(1.0, max(0.0, float(t.get("confidence", 0.8))))
            except (ValueError, TypeError):
                confidence = 0.8
            if confidence < 0.5:
                continue
            result.append(ExtractedTask(
                title=t.get("title", "Untitled task")[:200],
                description=(t.get("description") or "")[:500],
                source_type="email",
                source_id=src["id"],
                source_subject=src.get("subject", ""),
                priority=t.get("priority", "medium") if t.get("priority") in ["urgent", "high", "medium", "low"] else "medium",
                due_date=t.get("due_date"),
                confidence=confidence
            ))
        return result

    # ==================== JSON Parsing Helpers ====================
    def _parse_json_array(content):
        """Parse JSON array from LLM response with fallback strategies."""
        # Pre-process: fix trailing commas (common LLM mistake, invalid in JSON)
        content = re.sub(r',\s*([}\]])', r'\1', content)

        # Method 1: Direct parse
        try:
            result = json.loads(content)
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

        # Method 2: Extract JSON array from surrounding text
        first_bracket = content.find('[')
        last_bracket = content.rfind(']')
        if first_bracket != -1 and last_bracket > first_bracket:
            try:
                result = json.loads(content[first_bracket:last_bracket + 1])
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass

        # Method 3: Fix incomplete JSON
        if content.strip().startswith('['):
            try:
                test = content.strip()
                if not test.endswith(']'):
                    last_brace = test.rfind('}')
                    if last_brace > 0:
                        test = test[:last_brace + 1] + ']'
                result = json.loads(test)
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass

        return []

    def _parse_llm_tasks_from_list(task_data: list, source_id: str = "", source_subject: str = ""):
        """Build ExtractedTask objects from a pre-parsed list of task dicts.

        source_id and source_subject are injected by us (not from LLM output)
        to guarantee correctness.
        """
        result = []
        for t in task_data:
            if not isinstance(t, dict) or not t.get("title"):
                continue
            try:
                confidence = min(1.0, max(0.0, float(t.get("confidence", 0.8))))
            except (ValueError, TypeError):
                confidence = 0.8
            if confidence < 0.5:
                continue
            result.append(ExtractedTask(
                title=t.get("title", "Untitled task")[:200],
                description=(t.get("description") or "")[:500],
                source_type="email",
                source_id=source_id,
                source_subject=source_subject,
                priority=t.get("priority", "medium") if t.get("priority") in ["urgent", "high", "medium", "low"] else "medium",
                due_date=t.get("due_date"),
                confidence=confidence
            ))
        return result

    def _parse_llm_tasks(content, source_id: str = "", source_subject: str = ""):
        """Parse task JSON string from LLM response and build ExtractedTask objects."""
        task_data = _parse_json_array(content)
        return _parse_llm_tasks_from_list(task_data, source_id=source_id, source_subject=source_subject)

    # ==================== Main Pipeline ====================
    if not emails:
        logger.info("No emails to analyze for task extraction")
        return [], {}

    tasks = []
    summary_map = {}
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:

            # --- Pass 1: Batch Summarize ---
            email_batches = [emails[i:i + SUMMARIZE_BATCH] for i in range(0, len(emails), SUMMARIZE_BATCH)]
            logger.info(f"Pass 1 (Summarize): {len(emails)} emails in {len(email_batches)} batch(es)")

            summarize_coros = []
            for batch in email_batches:
                email_data = _prepare_summarize_data(batch)
                summarize_coros.append(_call_summarize(email_data, client))

            summarize_results = await asyncio.gather(*summarize_coros, return_exceptions=True)

            # Collect all summaries, filter to actionable only
            all_summaries = []
            failed_batch_emails = []  # Track emails from failed batches for fallback
            for idx, result in enumerate(summarize_results):
                if isinstance(result, Exception):
                    logger.error(f"Summarize batch {idx+1} failed: {type(result).__name__}: {result}")
                    # Fallback: treat failed batch emails as actionable (don't silently drop)
                    failed_batch_emails.extend(email_batches[idx])
                else:
                    all_summaries.extend(result)

            # Bug fix: LLM may return "true" (string) or 1 instead of boolean true
            def _is_actionable(s):
                if not isinstance(s, dict):
                    return False
                val = s.get("actionable")
                return val is True or val == "true" or val == "yes" or val == 1

            # Deduplicate by ID (LLM may return duplicate summaries for same email)
            seen_ids = set()
            actionable_summaries = []
            for s in all_summaries:
                sid = s.get("id", "")
                if _is_actionable(s) and sid and sid not in seen_ids:
                    actionable_summaries.append(s)
                    seen_ids.add(sid)

            logger.info(f"Pass 1 complete: {len(all_summaries)} summaries, "
                         f"{len(actionable_summaries)} actionable, "
                         f"{len(all_summaries) - len(actionable_summaries)} skipped, "
                         f"{len(failed_batch_emails)} from failed batches (fallback)")

            # Build summary_map: source_id → summary text (from ALL summaries, not just actionable)
            summary_map = {}
            for s in all_summaries:
                sid = s.get("id", "")
                text = (s.get("summary") or "").strip()
                if sid and text:
                    summary_map[sid] = text

            if not actionable_summaries and not failed_batch_emails:
                logger.info("No actionable emails — skipping Pass 2")
                return [], summary_map

            # --- Pass 2: Batch Extract from actionable summaries ---
            # Build lookups from ORIGINAL emails (don't rely on LLM echoing fields back)
            email_subject_map = {
                email.get("id", ""): email.get("subject", "")[:120]
                for email in emails
            }
            email_from_map = {}
            for email in emails:
                sender = email.get("from", {})
                if isinstance(sender, dict):
                    email_from_map[email.get("id", "")] = (sender.get('name', '') or sender.get('email', ''))[:60]
                else:
                    email_from_map[email.get("id", "")] = str(sender)[:60]

            # Prepare compact summary data for extraction
            summary_items = []
            for s in actionable_summaries:
                sid = s.get("id", "")
                summary_items.append({
                    "id": sid,
                    "subject": email_subject_map.get(sid, ""),
                    "from": email_from_map.get(sid, ""),
                    "summary": (s.get("summary") or "")[:200],
                })

            # Fallback: add failed-batch emails as summary items (use subject as summary)
            for email in failed_batch_emails:
                eid = email.get("id", "")
                if eid and eid not in seen_ids:
                    body = email.get("body_text") or email.get("snippet", "")
                    summary_items.append({
                        "id": eid,
                        "subject": email_subject_map.get(eid, ""),
                        "from": email_from_map.get(eid, ""),
                        "summary": _strip_quoted_replies(body)[:200],
                    })
                    seen_ids.add(eid)

            # Batch extract — LLM outputs email_index, we map to source_id
            summary_batches = [summary_items[i:i + EXTRACT_BATCH]
                               for i in range(0, len(summary_items), EXTRACT_BATCH)]
            logger.info(f"Pass 2 (Extract): {len(summary_items)} emails in "
                         f"{len(summary_batches)} batch(es), concurrency={llm_semaphore._value}")

            extract_coros = [_call_extract(batch, client) for batch in summary_batches]
            extract_results = await asyncio.gather(*extract_coros, return_exceptions=True)

            for idx, result in enumerate(extract_results):
                if isinstance(result, Exception):
                    logger.error(f"Extract batch {idx+1} failed: {type(result).__name__}: {result}")
                else:
                    logger.info(f"Extract batch {idx+1}: {len(result)} tasks")
                    tasks.extend(result)

    except Exception as e:
        logger.error(f"Error in LLM task extraction: {type(e).__name__}: {e}")

    # Sort by priority and due date
    priority_order = {"urgent": 0, "high": 1, "medium": 2, "low": 3}
    tasks.sort(key=lambda x: (priority_order.get(x.priority, 2), x.due_date or "9999-99-99"))

    logger.info(f"Total extracted: {len(tasks)} tasks from {len(emails)} emails (2-pass pipeline)")
    return tasks, summary_map


async def _extract_tasks_with_llm_summarize_only(emails: list):
    """Run only Pass 1 (Summarize) and return actionable summaries + summary_map.

    Used by background extraction to split summarize and extract into separate phases,
    allowing incremental DB saves after each extract batch.

    Returns: (actionable_summaries: list[dict], summary_map: dict)
    """
    import httpx

    SUMMARIZE_BATCH = 10
    vllm_base = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
    vllm_model = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")
    llm_semaphore = asyncio.Semaphore(5)

    SUMMARIZE_RESPONSE_SCHEMA = {
        "type": "object",
        "properties": {
            "summaries": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {"type": "string"},
                        "summary": {"type": "string"},
                        "actionable": {"type": "boolean"},
                    },
                    "required": ["id", "summary", "actionable"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["summaries"],
        "additionalProperties": False,
    }

    def _prepare_data(email_batch):
        data = []
        for email in email_batch:
            sender = email.get("from", {})
            if isinstance(sender, dict):
                sender_str = sender.get('name', '') or sender.get('email', '')
            else:
                sender_str = str(sender)
            body = email.get("body_text") or email.get("body_plain") or email.get("snippet", "")
            body = _strip_quoted_replies(body)
            data.append({
                "id": email.get("id", ""),
                "subject": email.get("subject", "")[:120],
                "from": sender_str[:60],
                "body": body[:600],
            })
        return data

    async def _call_summarize(email_data, client):
        today = datetime.now().strftime("%Y-%m-%d")
        prompt = f"""Summarize each email in 2-3 sentences. Mark if it requires action.
Today's date: {today}

EMAILS:
{json.dumps(email_data, separators=(',', ':'))}

IMPORTANT: Pay close attention to the subject line — it often signals intent directly (e.g., "ACTION REQUIRED:", "RE: Deadline extension", "FYI:", "Invitation:").

For each email, return:
- id: exact id from above
- summary: 2-3 sentences. Sentence 1: who sent it and the core request/information. Sentence 2: key details (deadlines, amounts, names, specifics). Sentence 3 (if needed): any conditions or context that affects urgency.
- actionable: true if the recipient needs to DO something (reply, review, approve, attend, prepare, submit, sign, decide, etc.), false if purely informational (FYI, newsletter, receipt, confirmation, greeting, auto-notification, shipping update)

Return a JSON object: {{"summaries": [{{...}}, ...]}}"""

        async with llm_semaphore:
            response = await client.post(
                f"{vllm_base}/chat/completions",
                json={
                    "model": vllm_model,
                    "messages": [
                        {"role": "system", "content": "Summarize emails. Return JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.1,
                    "max_tokens": 800,
                    "response_format": {
                        "type": "json_schema",
                        "json_schema": {
                            "name": "email_summaries",
                            "strict": True,
                            "schema": SUMMARIZE_RESPONSE_SCHEMA,
                        }
                    },
                }
            )

        if response.status_code != 200:
            logger.error(f"BG Summarize LLM error: {response.status_code} - {response.text[:200]}")
            raise RuntimeError(f"Summarize LLM returned HTTP {response.status_code}")

        choices = response.json().get("choices") or []
        if not choices:
            raise RuntimeError("Summarize LLM returned empty choices")
        content = choices[0].get("message", {}).get("content", "{}")

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            return []

        if isinstance(parsed, dict) and "summaries" in parsed:
            return parsed["summaries"]
        elif isinstance(parsed, list):
            return parsed
        return []

    # Run summarize pipeline
    if not emails:
        return [], {}

    async with httpx.AsyncClient(timeout=90.0) as client:
        email_batches = [emails[i:i + SUMMARIZE_BATCH] for i in range(0, len(emails), SUMMARIZE_BATCH)]
        logger.info(f"BG Pass 1 (Summarize): {len(emails)} emails in {len(email_batches)} batch(es)")

        coros = [_call_summarize(_prepare_data(batch), client) for batch in email_batches]
        results = await asyncio.gather(*coros, return_exceptions=True)

        all_summaries = []
        for idx, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"BG Summarize batch {idx+1} failed: {result}")
            else:
                all_summaries.extend(result)

        # Filter actionable, deduplicate
        def _is_actionable(s):
            if not isinstance(s, dict):
                return False
            val = s.get("actionable")
            return val is True or val == "true" or val == "yes" or val == 1

        seen_ids = set()
        actionable = []
        for s in all_summaries:
            sid = s.get("id", "")
            if _is_actionable(s) and sid and sid not in seen_ids:
                actionable.append(s)
                seen_ids.add(sid)

        # Build summary_map
        summary_map = {}
        for s in all_summaries:
            sid = s.get("id", "")
            text = (s.get("summary") or "").strip()
            if sid and text:
                summary_map[sid] = text

        logger.info(f"BG Pass 1 done: {len(all_summaries)} summaries, {len(actionable)} actionable")
        return actionable, summary_map


async def _call_extract_standalone(batch, vllm_base, vllm_model, llm_semaphore, client):
    """Standalone extract function for background extraction (no closure dependency)."""
    today = datetime.now().strftime("%Y-%m-%d")

    email_lines = []
    for i, item in enumerate(batch):
        email_lines.append(f"[{i}] Subject: {item.get('subject','')}\n    From: {item.get('from','')}\n    Summary: {item.get('summary','')}")
    emails_str = "\n".join(email_lines)

    prompt = f"""Extract actionable tasks from these emails.
Today's date: {today}

EMAILS:
{emails_str}

For each task:
- email_index: the [index] number of the source email (0-based integer)
- title: MUST be specific and descriptive. Start with a strong action verb, include the specific WHAT and WHO/FROM.
  GOOD: "Reply to Sarah Chen with updated Q3 revenue projections by Friday"
  BAD: "Review document" / "Reply to email" (too vague!)
- description: 1-2 sentences of context
- priority: "urgent" (deadline <24h or ASAP) / "high" (deadline <1 week) / "medium" (standard) / "low" (nice-to-have)
- due_date: "YYYY-MM-DD" or null
- confidence: 0.9+ (explicit action) / 0.7-0.9 (implied) / 0.5-0.7 (unclear)

Return a JSON object: {{"tasks": [{{...}}, ...]}}
If no tasks found, return: {{"tasks": []}}"""

    EXTRACT_RESPONSE_SCHEMA = {
        "type": "object",
        "properties": {
            "tasks": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "email_index": {"type": "integer"},
                        "title": {"type": "string"},
                        "description": {"type": "string"},
                        "priority": {"type": "string", "enum": ["urgent", "high", "medium", "low"]},
                        "due_date": {"type": ["string", "null"]},
                        "confidence": {"type": "number"},
                    },
                    "required": ["email_index", "title", "description", "priority", "due_date", "confidence"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["tasks"],
        "additionalProperties": False,
    }

    async with llm_semaphore:
        response = await client.post(
            f"{vllm_base}/chat/completions",
            json={
                "model": vllm_model,
                "messages": [
                    {"role": "system", "content": "Extract tasks from emails. Return JSON only."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.2,
                "max_tokens": 1500,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "extracted_tasks",
                        "strict": True,
                        "schema": EXTRACT_RESPONSE_SCHEMA,
                    }
                },
            }
        )

    if response.status_code != 200:
        logger.error(f"BG Extract LLM error: {response.status_code} - {response.text[:200]}")
        raise RuntimeError(f"Extract LLM returned HTTP {response.status_code}")

    choices = response.json().get("choices") or []
    if not choices:
        return []
    content = choices[0].get("message", {}).get("content", "{}")

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return []

    if isinstance(parsed, dict) and "tasks" in parsed:
        task_list = parsed["tasks"]
    elif isinstance(parsed, list):
        task_list = parsed
    else:
        return []

    # Map email_index → source_id
    result = []
    for t in task_list:
        if not isinstance(t, dict) or not t.get("title"):
            continue
        idx = t.get("email_index", 0)
        try:
            idx = int(idx)
        except (ValueError, TypeError):
            idx = -1
        if idx < 0 or idx >= len(batch):
            if len(batch) == 1:
                idx = 0
            else:
                continue
        src = batch[idx]
        try:
            confidence = min(1.0, max(0.0, float(t.get("confidence", 0.8))))
        except (ValueError, TypeError):
            confidence = 0.8
        if confidence < 0.5:
            continue
        result.append(ExtractedTask(
            title=t.get("title", "Untitled task")[:200],
            description=(t.get("description") or "")[:500],
            source_type="email",
            source_id=src["id"],
            source_subject=src.get("subject", ""),
            priority=t.get("priority", "medium") if t.get("priority") in ["urgent", "high", "medium", "low"] else "medium",
            due_date=t.get("due_date"),
            confidence=confidence
        ))
    return result


# ==================== Health Check ====================

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        service="work-agent",
        version="1.0.0"
    )


# ==================== OAuth Endpoints ====================

from fastapi.responses import RedirectResponse
from backend.models.oauth_token import OAuthToken
from modules.agents.work.src.services.google_oauth import google_oauth_service, GmailService, CalendarService

# OAuth state: encode user_id + timestamp into signed state parameter
# This avoids in-memory storage issues with multiple gunicorn workers
_OAUTH_STATE_MAX_AGE_SECONDS = 600  # 10 minutes
_OAUTH_STATE_SECRET = os.getenv("OAUTH_ENCRYPTION_KEY", "fallback-oauth-state-secret-key")

def _encode_oauth_state(user_id: int) -> str:
    """Encode user_id and timestamp into a signed state string."""
    import hmac, hashlib, base64, json
    payload = json.dumps({"uid": user_id, "ts": datetime.now(timezone.utc).isoformat()})
    payload_b64 = base64.urlsafe_b64encode(payload.encode()).decode()
    sig = hmac.new(_OAUTH_STATE_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload_b64}.{sig}"

def _decode_oauth_state(state: str) -> dict:
    """Decode and verify a signed state string. Returns {"uid": int, "ts": str} or raises."""
    import hmac, hashlib, base64, json
    parts = state.rsplit(".", 1)
    if len(parts) != 2:
        raise ValueError("Invalid state format")
    payload_b64, sig = parts
    expected_sig = hmac.new(_OAUTH_STATE_SECRET.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()[:16]
    if not hmac.compare_digest(sig, expected_sig):
        raise ValueError("Invalid state signature")
    payload = json.loads(base64.urlsafe_b64decode(payload_b64).decode())
    created_at = datetime.fromisoformat(payload["ts"])
    if (datetime.now(timezone.utc) - created_at).total_seconds() > _OAUTH_STATE_MAX_AGE_SECONDS:
        raise ValueError("State expired")
    return payload


class TokenRefreshError(Exception):
    """Raised when token refresh fails and token should be marked as revoked."""
    pass


async def refresh_token_if_expired(token: OAuthToken, db: Session) -> str:
    """
    Check if token is expired and refresh if needed.
    Returns the current valid access token.
    Raises TokenRefreshError if refresh fails (token will be marked as revoked).
    """
    # Check if token is already revoked
    if token.is_revoked:
        raise TokenRefreshError(f"Token for {token.account_email} is revoked: {token.revoked_reason}")

    access_token = token.get_access_token()

    if token.is_expired() and token.get_refresh_token():
        logger.info(f"Refreshing expired token for {token.account_email}")
        try:
            new_tokens = await google_oauth_service.refresh_access_token(
                token.get_refresh_token()
            )
            token.set_access_token(new_tokens["access_token"])
            token.expires_at = new_tokens["expires_at"]
            db.commit()
            access_token = new_tokens["access_token"]
            logger.info(f"Token refreshed successfully for {token.account_email}")
        except Exception as e:
            error_msg = str(e).lower()
            # Check for revocation indicators
            if any(x in error_msg for x in ["invalid_grant", "revoked", "expired", "invalid_token"]):
                token.mark_as_revoked("Access was revoked or token expired. Please reconnect.")
                db.commit()
                logger.warning(f"Token revoked for {token.account_email}: {e}")
                raise TokenRefreshError(f"Token revoked for {token.account_email}")
            raise

    return access_token


@router.get("/oauth/google/authorize")
async def google_oauth_authorize(
    user_id: int = Query(..., description="User ID initiating OAuth"),
):
    """
    Initiate Google OAuth flow.

    Returns the authorization URL to redirect the user to.
    """
    # Generate signed state containing user_id (no in-memory storage needed)
    state = _encode_oauth_state(user_id)

    # Generate authorization URL with our signed state
    result = google_oauth_service.get_authorization_url(state=state)

    return {
        "authorization_url": result["authorization_url"],
        "state": result["state"]
    }


@router.get("/oauth/google/callback")
async def google_oauth_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="State parameter for CSRF protection"),
    db: Session = Depends(get_db)
):
    """
    Handle Google OAuth callback.

    Exchanges authorization code for tokens and stores them securely.
    """
    # Verify and decode signed state (works across all workers, no shared memory needed)
    try:
        state_data = _decode_oauth_state(state)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid or expired state parameter: {e}")

    user_id = state_data["uid"]

    try:
        # Exchange code for tokens
        tokens = await google_oauth_service.exchange_code_for_tokens(code)

        # Check if account already connected
        existing = db.query(OAuthToken).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.provider == "google",
            OAuthToken.account_email == tokens["user_email"]
        ).first()

        if existing:
            # Update existing token and reactivate if it was revoked
            existing.set_access_token(tokens["access_token"])
            if tokens.get("refresh_token"):
                existing.set_refresh_token(tokens["refresh_token"])
            existing.expires_at = tokens["expires_at"]
            existing.set_scopes(tokens["scope"])
            existing.account_name = tokens["user_name"]
            existing.reactivate()  # Clear revoked status on re-authorization
            db.commit()
            oauth_token = existing
        else:
            # Create new token entry
            oauth_token = OAuthToken(
                user_id=user_id,
                provider="google",
                account_email=tokens["user_email"],
                account_name=tokens["user_name"],
            )
            oauth_token.set_access_token(tokens["access_token"])
            if tokens.get("refresh_token"):
                oauth_token.set_refresh_token(tokens["refresh_token"])
            oauth_token.expires_at = tokens["expires_at"]
            oauth_token.set_scopes(tokens["scope"])
            oauth_token.set_metadata({"picture": tokens.get("user_picture")})

            db.add(oauth_token)
            db.commit()
            db.refresh(oauth_token)

        # Redirect to frontend with success
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:1000")
        from urllib.parse import quote
        return RedirectResponse(
            url=f"{frontend_url}/dashboard?oauth=success&provider=google&email={quote(tokens['user_email'])}"
        )

    except Exception as e:
        logger.error(f"OAuth callback error: {str(e)}")
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:1000")
        from urllib.parse import quote
        return RedirectResponse(
            url=f"{frontend_url}/dashboard?oauth=error&message={quote(str(e))}"
        )


@router.get("/oauth/accounts")
async def get_connected_accounts(
    user_id: int = Query(..., description="User ID"),
    provider: Optional[str] = Query(None, description="Filter by provider (google, microsoft, etc.)"),
    db: Session = Depends(get_db)
):
    """Get all connected OAuth accounts for a user."""
    query = db.query(OAuthToken).filter(OAuthToken.user_id == user_id)

    if provider:
        query = query.filter(OAuthToken.provider == provider)

    accounts = query.all()
    return [account.to_dict() for account in accounts]


@router.delete("/oauth/accounts/{account_id}")
async def disconnect_account(
    account_id: int,
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Disconnect an OAuth account."""
    account = db.query(OAuthToken).filter(
        OAuthToken.id == account_id,
        OAuthToken.user_id == user_id
    ).first()

    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    db.delete(account)
    db.commit()

    return {"status": "success", "message": "Account disconnected"}


# ==================== Gmail Endpoints ====================

@router.get("/gmail/messages")
async def get_gmail_messages(
    user_id: int = Query(..., description="User ID"),
    account_id: Optional[int] = Query(None, description="Specific OAuth account ID"),
    max_results: int = Query(default=20, le=50, description="Maximum messages to return"),
    query: Optional[str] = Query(None, description="Gmail search query"),
    label_ids: Optional[str] = Query(None, description="Gmail label IDs (comma-separated: INBOX,SENT,DRAFT,TRASH,SPAM,STARRED,IMPORTANT)"),
    page_token: Optional[str] = Query(None, description="Pagination token from previous response"),
    page_tokens: Optional[str] = Query(None, description="JSON object mapping account_id to page_token for multi-account pagination"),
    db: Session = Depends(get_db)
):
    """
    Fetch messages from connected Gmail accounts with pagination support.

    Search query examples:
    - is:unread
    - from:someone@example.com
    - subject:important
    - after:2024/01/01

    Pagination:
    - Single account: Use 'nextPageToken' from response as 'page_token' parameter
    - All accounts: Use 'accountPageTokens' from response as 'page_tokens' parameter (JSON string)
    """
    import asyncio
    import json
    import concurrent.futures
    
    # Get OAuth tokens for Google
    token_query = db.query(OAuthToken).filter(
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    )

    if account_id:
        token_query = token_query.filter(OAuthToken.id == account_id)

    tokens = token_query.all()

    if not tokens:
        return {"messages": [], "accounts": [], "error": "No Gmail accounts connected"}

    # Parse per-account page tokens if provided (for multi-account pagination)
    account_page_tokens = {}
    if page_tokens:
        try:
            account_page_tokens = json.loads(page_tokens)
        except json.JSONDecodeError:
            logger.warning(f"Invalid page_tokens JSON: {page_tokens}")

    # Parse label_ids once
    label_list = label_ids.split(',') if label_ids else None
    
    # For multi-account mode, calculate messages per account to get a balanced result
    # Request slightly more to ensure we have enough after merging and sorting
    messages_per_account = max_results if account_id else max(10, max_results // len(tokens) + 5)

    async def fetch_account_messages(token):
        """Fetch messages for a single account (runs in thread pool for I/O)."""
        try:
            # Use the centralized refresh function
            access_token = await refresh_token_if_expired(token, db)

            # Create credentials and Gmail service
            credentials = google_oauth_service.get_credentials(
                access_token,
                token.get_refresh_token()
            )
            gmail_service = GmailService(credentials)

            # Determine page token for this account
            account_page_token = page_token if account_id else account_page_tokens.get(str(token.id))

            # Fetch messages with pagination support
            result = await asyncio.to_thread(
                gmail_service.get_messages,
                max_results=messages_per_account,
                query=query,
                label_ids=label_list,
                page_token=account_page_token
            )

            messages = result.get("messages", [])
            next_page_token = result.get("nextPageToken")

            # Add account info to each message
            for msg in messages:
                msg["account_id"] = token.id
                msg["account_email"] = token.account_email

            return {
                "id": token.id,
                "email": token.account_email,
                "name": token.account_name,
                "messages": messages,
                "message_count": len(messages),
                "nextPageToken": next_page_token,
                "hasMore": next_page_token is not None,
                "error": None,
                "is_revoked": False
            }

        except TokenRefreshError as e:
            logger.warning(f"Token revoked for {token.account_email}: {e}")
            return {
                "id": token.id,
                "email": token.account_email,
                "name": token.account_name,
                "messages": [],
                "message_count": 0,
                "nextPageToken": None,
                "hasMore": False,
                "error": "Account access revoked. Please reconnect.",
                "is_revoked": True
            }

        except Exception as e:
            logger.error(f"Error fetching Gmail for {token.account_email}: {str(e)}", exc_info=True)
            return {
                "id": token.id,
                "email": token.account_email,
                "name": token.account_name,
                "messages": [],
                "message_count": 0,
                "nextPageToken": None,
                "hasMore": False,
                "error": str(e),
                "is_revoked": False
            }

    # Fetch from all accounts in PARALLEL (major performance improvement!)
    results = await asyncio.gather(*[fetch_account_messages(token) for token in tokens])

    # Collect messages and account info
    all_messages = []
    account_info = []
    account_page_tokens_response = {}  # For next pagination request
    has_more_messages = False  # Whether any account has more messages

    for result in results:
        all_messages.extend(result["messages"])
        account_info.append({
            "id": result["id"],
            "email": result["email"],
            "name": result["name"],
            "message_count": result["message_count"],
            "nextPageToken": result["nextPageToken"],
            "hasMore": result["hasMore"],
            "error": result["error"],
            "is_revoked": result.get("is_revoked", False)
        })
        # Track pagination tokens for each account
        if result["nextPageToken"]:
            account_page_tokens_response[str(result["id"])] = result["nextPageToken"]
            has_more_messages = True

    # Sort by timestamp (newest first)
    all_messages.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    # For single account, limit to max_results (only on first page)
    # For multi-account, limit combined results
    if not page_token and not page_tokens:
        all_messages = all_messages[:max_results]

    # Determine global nextPageToken
    # For single account: use the account's token directly
    # For multi-account: serialize all account tokens as JSON
    global_next_page_token = None
    if account_id and account_info and account_info[0].get("nextPageToken"):
        global_next_page_token = account_info[0]["nextPageToken"]

    return {
        "messages": all_messages,
        "accounts": account_info,
        "total": len(all_messages),
        "nextPageToken": global_next_page_token,  # For single account pagination
        "accountPageTokens": account_page_tokens_response if has_more_messages else None,  # For multi-account pagination
        "hasMore": has_more_messages  # Easy check if more messages available
    }


async def _get_gmail_service(account_id: int, user_id: int, db: Session) -> GmailService:
    """Look up token, refresh if expired, return authenticated GmailService.

    Raises HTTPException(404) if account not found,
    HTTPException(401) if token is revoked/unrefreshable.
    """
    token = db.query(OAuthToken).filter(
        OAuthToken.id == account_id,
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        access_token = await refresh_token_if_expired(token, db)
    except TokenRefreshError:
        raise HTTPException(
            status_code=401,
            detail="Account disconnected. Please reconnect your Google account."
        )

    credentials = google_oauth_service.get_credentials(
        access_token, token.get_refresh_token()
    )
    return GmailService(credentials)


@router.post("/gmail/messages/{message_id}/read")
async def mark_message_as_read(
    message_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Mark a Gmail message as read."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        success = gmail_service.mark_as_read(message_id)

        if success:
            return {"status": "success", "message": "Marked as read"}
        else:
            raise HTTPException(status_code=500, detail="Failed to mark as read")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error marking message as read: {e}")
        raise HTTPException(status_code=500, detail="Failed to mark message as read")


@router.post("/gmail/messages/{message_id}/archive")
async def archive_message(
    message_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Archive a Gmail message."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        success = gmail_service.archive_message(message_id)

        if success:
            return {"status": "success", "message": "Message archived"}
        else:
            raise HTTPException(status_code=500, detail="Failed to archive message")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error archiving message: {e}")
        raise HTTPException(status_code=500, detail="Failed to archive message")


@router.post("/gmail/messages/{message_id}/star")
async def star_message(
    message_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    star: bool = Query(default=True, description="True to star, False to unstar"),
    db: Session = Depends(get_db)
):
    """Star or unstar a Gmail message."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        success = gmail_service.star_message(message_id, star)

        if success:
            return {"status": "success", "message": f"Message {'starred' if star else 'unstarred'}"}
        else:
            raise HTTPException(status_code=500, detail="Failed to update star status")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starring message: {e}")
        raise HTTPException(status_code=500, detail="Failed to update star status")


@router.post("/gmail/messages/{message_id}/trash")
async def trash_message(
    message_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Move a Gmail message to trash."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        success = gmail_service.trash_message(message_id)

        if success:
            return {"status": "success", "message": "Message moved to trash"}
        else:
            raise HTTPException(status_code=500, detail="Failed to trash message")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error trashing message: {e}")
        raise HTTPException(status_code=500, detail="Failed to trash message")


@router.post("/gmail/messages/{message_id}/untrash")
async def untrash_message(
    message_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Restore a Gmail message from trash."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        success = gmail_service.untrash_message(message_id)

        if success:
            return {"status": "success", "message": "Message restored from trash"}
        else:
            raise HTTPException(status_code=500, detail="Failed to restore message")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring message: {e}")
        raise HTTPException(status_code=500, detail="Failed to restore message")


@router.delete("/gmail/messages/{message_id}")
async def delete_message_permanently(
    message_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Permanently delete a Gmail message (cannot be undone)."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        success = gmail_service.delete_message_permanently(message_id)

        if success:
            return {"status": "success", "message": "Message permanently deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete message")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting message: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete message")


@router.get("/gmail/messages/{message_id}")
async def get_message(
    message_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Get a single Gmail message by ID."""
    token = db.query(OAuthToken).filter(
        OAuthToken.id == account_id,
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        try:
            access_token = await refresh_token_if_expired(token, db)
        except TokenRefreshError:
            raise HTTPException(
                status_code=401,
                detail="Account disconnected. Please reconnect your Google account."
            )

        credentials = google_oauth_service.get_credentials(
            access_token, token.get_refresh_token()
        )
        gmail_service = GmailService(credentials)
        message = gmail_service.get_message(message_id)

        if message:
            message["account_id"] = token.id
            message["account_email"] = token.account_email
            return message
        else:
            raise HTTPException(status_code=404, detail="Message not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get message")


@router.get("/gmail/messages/{message_id}/attachments/{attachment_id}")
async def get_attachment(
    message_id: str,
    attachment_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Get attachment data by ID."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        attachment = gmail_service.get_attachment(message_id, attachment_id)

        if attachment:
            return attachment
        else:
            raise HTTPException(status_code=404, detail="Attachment not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting attachment: {e}")
        raise HTTPException(status_code=500, detail="Failed to get attachment")


# ==================== Gmail Send/Reply Endpoints ====================

from pydantic import BaseModel


class AttachmentData(BaseModel):
    """Attachment data for sending emails."""
    filename: str
    mime_type: str
    data: str  # Base64 encoded content


class SendEmailRequest(BaseModel):
    to: str
    subject: str = ""
    body: str = ""
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None

    @validator('to', 'subject', pre=True)
    def strip_newlines(cls, v):
        if isinstance(v, str):
            return v.replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ') if '\n' in v or '\r' in v else v
        return v
    html: bool = False
    reply_to_message_id: Optional[str] = None
    thread_id: Optional[str] = None
    attachments: Optional[List[AttachmentData]] = None


@router.post("/gmail/messages/send")
async def send_email(
    request: SendEmailRequest,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Send a new email or reply with optional attachments."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)

        # Convert attachment models to dicts for Gmail service
        attachments_data = None
        if request.attachments:
            attachments_data = [
                {
                    "filename": att.filename,
                    "mime_type": att.mime_type,
                    "data": att.data
                }
                for att in request.attachments
            ]

        result = gmail_service.send_email(
            to=request.to,
            subject=request.subject,
            body=request.body,
            cc=request.cc,
            bcc=request.bcc,
            html=request.html,
            reply_to_message_id=request.reply_to_message_id,
            thread_id=request.thread_id,
            attachments=attachments_data
        )

        return {
            "status": "success",
            "message": "Email sent successfully",
            "message_id": result.get("id"),
            "thread_id": result.get("threadId")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send email")


# ==================== Gmail Draft Endpoints ====================

class DraftRequest(BaseModel):
    to: str = ""
    subject: str = ""
    body: str = ""
    cc: Optional[List[str]] = None
    bcc: Optional[List[str]] = None
    thread_id: Optional[str] = None
    reply_to_message_id: Optional[str] = None

    @validator('to', 'subject', pre=True)
    def strip_newlines(cls, v):
        if isinstance(v, str):
            return v.replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ') if '\n' in v or '\r' in v else v
        return v


@router.get("/gmail/drafts")
async def get_drafts(
    user_id: int = Query(..., description="User ID"),
    account_id: Optional[int] = Query(None, description="Specific OAuth account ID"),
    max_results: int = Query(default=20, le=50),
    db: Session = Depends(get_db)
):
    """Get all drafts from connected Gmail accounts."""
    token_query = db.query(OAuthToken).filter(
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    )

    if account_id:
        token_query = token_query.filter(OAuthToken.id == account_id)

    tokens = token_query.all()

    if not tokens:
        return {"drafts": [], "accounts": []}

    all_drafts = []
    account_info = []

    for token in tokens:
        try:
            access_token = await refresh_token_if_expired(token, db)
            credentials = google_oauth_service.get_credentials(
                access_token,
                token.get_refresh_token()
            )
            gmail_service = GmailService(credentials)
            drafts = gmail_service.get_drafts(max_results=max_results)

            for draft in drafts:
                draft["account_id"] = token.id
                draft["account_email"] = token.account_email
                all_drafts.append(draft)

            account_info.append({
                "id": token.id,
                "email": token.account_email,
                "draft_count": len(drafts)
            })

        except TokenRefreshError:
            logger.warning(f"Token revoked for {token.account_email} during draft fetch")
            account_info.append({
                "id": token.id,
                "email": token.account_email,
                "error": "Account disconnected. Please reconnect."
            })
        except Exception as e:
            logger.error(f"Error fetching drafts for {token.account_email}: {e}")
            account_info.append({
                "id": token.id,
                "email": token.account_email,
                "error": "Failed to fetch drafts"
            })

    return {
        "drafts": all_drafts,
        "accounts": account_info,
        "total": len(all_drafts)
    }


@router.post("/gmail/drafts")
async def create_draft(
    request: DraftRequest,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Create a new draft."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        draft = gmail_service.create_draft(
            to=request.to,
            subject=request.subject,
            body=request.body,
            cc=request.cc,
            bcc=request.bcc,
            thread_id=request.thread_id,
            reply_to_message_id=request.reply_to_message_id
        )

        return {
            "status": "success",
            "draft_id": draft.get("id"),
            "message": "Draft created successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating draft: {e}")
        raise HTTPException(status_code=500, detail="Failed to create draft")


@router.put("/gmail/drafts/{draft_id}")
async def update_draft(
    draft_id: str,
    request: DraftRequest,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Update an existing draft."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        draft = gmail_service.update_draft(
            draft_id=draft_id,
            to=request.to,
            subject=request.subject,
            body=request.body,
            cc=request.cc,
            bcc=request.bcc,
            thread_id=request.thread_id,
            reply_to_message_id=request.reply_to_message_id
        )

        return {
            "status": "success",
            "draft_id": draft.get("id"),
            "message": "Draft updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating draft: {e}")
        raise HTTPException(status_code=500, detail="Failed to update draft")


@router.delete("/gmail/drafts/{draft_id}")
async def delete_draft(
    draft_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Delete a draft."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        success = gmail_service.delete_draft(draft_id)

        if success:
            return {"status": "success", "message": "Draft deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete draft")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting draft: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete draft")


@router.post("/gmail/drafts/{draft_id}/send")
async def send_draft(
    draft_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Send an existing draft."""
    try:
        gmail_service = await _get_gmail_service(account_id, user_id, db)
        result = gmail_service.send_draft(draft_id)

        return {
            "status": "success",
            "message": "Draft sent successfully",
            "message_id": result.get("id"),
            "thread_id": result.get("threadId")
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending draft: {e}")
        raise HTTPException(status_code=500, detail="Failed to send draft")


# ==================== Google Calendar Endpoints ====================

@router.get("/calendar/calendars")
async def get_calendars(
    user_id: int = Query(..., description="User ID"),
    account_id: Optional[int] = Query(None, description="Specific OAuth account ID"),
    db: Session = Depends(get_db)
):
    """Get all calendars for connected Google accounts."""
    token_query = db.query(OAuthToken).filter(
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    )

    if account_id:
        token_query = token_query.filter(OAuthToken.id == account_id)

    tokens = token_query.all()

    if not tokens:
        return {"calendars": [], "accounts": [], "total": 0}

    all_calendars = []
    account_info = []

    async def fetch_account_calendars(token):
        """Fetch calendars for a single account with token refresh support."""
        try:
            access_token = await refresh_token_if_expired(token, db)
            credentials = google_oauth_service.get_credentials(
                access_token, token.get_refresh_token()
            )
            calendar_service = CalendarService(credentials)
            calendars = calendar_service.get_calendars()

            for cal in calendars:
                cal["account_id"] = token.id
                cal["account_email"] = token.account_email

            return {
                "calendars": calendars,
                "account": {
                    "id": token.id,
                    "email": token.account_email,
                    "calendar_count": len(calendars)
                },
                "error": None
            }

        except TokenRefreshError:
            logger.warning(f"Token revoked for {token.account_email} during calendar fetch")
            return {
                "calendars": [],
                "account": {
                    "id": token.id,
                    "email": token.account_email,
                    "error": "Account disconnected. Please reconnect."
                },
                "error": "Account disconnected"
            }
        except Exception as e:
            logger.error(f"Error fetching calendars for {token.account_email}: {e}")
            return {
                "calendars": [],
                "account": {
                    "id": token.id,
                    "email": token.account_email,
                    "error": "Failed to fetch calendars"
                },
                "error": "Failed to fetch calendars"
            }

    # Fetch calendars from all accounts concurrently
    import asyncio
    results = await asyncio.gather(*[fetch_account_calendars(token) for token in tokens])

    for result in results:
        all_calendars.extend(result["calendars"])
        account_info.append(result["account"])

    return {
        "calendars": all_calendars,
        "accounts": account_info,
        "total": len(all_calendars)
    }


@router.get("/calendar/events")
async def get_calendar_events(
    user_id: int = Query(..., description="User ID"),
    account_id: Optional[int] = Query(None, description="Specific OAuth account ID"),
    calendar_id: str = Query(default="primary", description="Calendar ID"),
    time_min: Optional[str] = Query(None, description="Start time filter (ISO format)"),
    time_max: Optional[str] = Query(None, description="End time filter (ISO format)"),
    max_results: int = Query(default=250, le=2500, description="Maximum events to return (Google Calendar API max is 2500)"),
    single_events: bool = Query(default=True, description="Expand recurring events into instances"),
    order_by: str = Query(default="startTime", description="Order by 'startTime' or 'updated'"),
    db: Session = Depends(get_db)
):
    """
    Get calendar events from connected Google accounts.

    Time filters use ISO 8601 format (e.g., "2024-01-01T00:00:00Z").
    If time_min is not specified, defaults to current time.
    """
    token_query = db.query(OAuthToken).filter(
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    )

    if account_id:
        token_query = token_query.filter(OAuthToken.id == account_id)

    tokens = token_query.all()

    if not tokens:
        return {"events": [], "accounts": [], "total": 0}

    all_events = []
    account_info = []

    async def fetch_account_events(token):
        """Fetch events for a single account with token refresh support."""
        try:
            access_token = await refresh_token_if_expired(token, db)
            credentials = google_oauth_service.get_credentials(
                access_token, token.get_refresh_token()
            )
            calendar_service = CalendarService(credentials)
            events = calendar_service.get_events(
                calendar_id=calendar_id,
                time_min=time_min,
                time_max=time_max,
                max_results=max_results,
                single_events=single_events,
                order_by=order_by
            )

            # Add account info to each event
            for event in events:
                event["account_id"] = token.id
                event["account_email"] = token.account_email

            return {
                "events": events,
                "account": {
                    "id": token.id,
                    "email": token.account_email,
                    "event_count": len(events)
                },
                "error": None
            }

        except TokenRefreshError:
            logger.warning(f"Token revoked for {token.account_email} during event fetch")
            return {
                "events": [],
                "account": {
                    "id": token.id,
                    "email": token.account_email,
                    "error": "Account disconnected. Please reconnect."
                },
                "error": "Account disconnected"
            }
        except Exception as e:
            logger.error(f"Error fetching events for {token.account_email}: {e}")
            return {
                "events": [],
                "account": {
                    "id": token.id,
                    "email": token.account_email,
                    "error": "Failed to fetch events"
                },
                "error": "Failed to fetch events"
            }

    # Fetch events from all accounts concurrently
    import asyncio
    results = await asyncio.gather(*[fetch_account_events(token) for token in tokens])

    for result in results:
        all_events.extend(result["events"])
        account_info.append(result["account"])

    # Sort by start time
    all_events.sort(key=lambda x: x.get("start", ""))

    return {
        "events": all_events,
        "accounts": account_info,
        "total": len(all_events)
    }


@router.get("/calendar/events/{event_id}")
async def get_calendar_event(
    event_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    calendar_id: str = Query(default="primary", description="Calendar ID"),
    db: Session = Depends(get_db)
):
    """Get a single calendar event by ID."""
    token = db.query(OAuthToken).filter(
        OAuthToken.id == account_id,
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        # Refresh token if expired
        access_token = await refresh_token_if_expired(token, db)

        credentials = google_oauth_service.get_credentials(
            access_token,
            token.get_refresh_token()
        )
        calendar_service = CalendarService(credentials)
        event = calendar_service.get_event(event_id, calendar_id)

        if event:
            event["account_id"] = token.id
            event["account_email"] = token.account_email
            return event
        else:
            raise HTTPException(status_code=404, detail="Event not found")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class CreateEventRequest(BaseModel):
    summary: str
    start: str
    end: str
    description: str = ""
    location: str = ""
    attendees: Optional[List[str]] = None
    is_all_day: bool = False
    timezone: Optional[str] = None
    calendar_id: str = "primary"


@router.post("/calendar/events")
async def create_calendar_event(
    request: CreateEventRequest,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Create a new calendar event."""
    token = db.query(OAuthToken).filter(
        OAuthToken.id == account_id,
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        # Refresh token if expired
        access_token = await refresh_token_if_expired(token, db)

        credentials = google_oauth_service.get_credentials(
            access_token,
            token.get_refresh_token()
        )
        calendar_service = CalendarService(credentials)
        event = calendar_service.create_event(
            summary=request.summary,
            start=request.start,
            end=request.end,
            description=request.description,
            location=request.location,
            attendees=request.attendees,
            calendar_id=request.calendar_id,
            is_all_day=request.is_all_day,
            timezone=request.timezone
        )

        return {
            "status": "success",
            "message": "Event created successfully",
            "event": event
        }

    except Exception as e:
        logger.error(f"Error creating event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


class UpdateEventRequest(BaseModel):
    summary: Optional[str] = None
    start: Optional[str] = None
    end: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    calendar_id: str = "primary"


@router.put("/calendar/events/{event_id}")
async def update_calendar_event(
    event_id: str,
    request: UpdateEventRequest,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """Update an existing calendar event."""
    token = db.query(OAuthToken).filter(
        OAuthToken.id == account_id,
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        # Refresh token if expired
        access_token = await refresh_token_if_expired(token, db)

        credentials = google_oauth_service.get_credentials(
            access_token,
            token.get_refresh_token()
        )
        calendar_service = CalendarService(credentials)
        event = calendar_service.update_event(
            event_id=event_id,
            summary=request.summary,
            start=request.start,
            end=request.end,
            description=request.description,
            location=request.location,
            calendar_id=request.calendar_id
        )

        return {
            "status": "success",
            "message": "Event updated successfully",
            "event": event
        }

    except Exception as e:
        logger.error(f"Error updating event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/calendar/events/{event_id}")
async def delete_calendar_event(
    event_id: str,
    account_id: int = Query(..., description="OAuth account ID"),
    user_id: int = Query(..., description="User ID"),
    calendar_id: str = Query(default="primary", description="Calendar ID"),
    db: Session = Depends(get_db)
):
    """Delete a calendar event."""
    token = db.query(OAuthToken).filter(
        OAuthToken.id == account_id,
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google"
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        # Refresh token if expired
        access_token = await refresh_token_if_expired(token, db)

        credentials = google_oauth_service.get_credentials(
            access_token,
            token.get_refresh_token()
        )
        calendar_service = CalendarService(credentials)
        success = calendar_service.delete_event(event_id, calendar_id)

        if success:
            return {"status": "success", "message": "Event deleted"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete event")

    except Exception as e:
        logger.error(f"Error deleting event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AI Task Solver Endpoints ====================

from modules.agents.work.src.services.task_solver_service import stream_solver_response, QUICK_ACTIONS


@router.post("/tasks/{task_id}/ai-solver/chat")
async def task_solver_chat(
    task_id: int,
    request: TaskSolverChatRequest = Body(...),
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """
    AI Task Solver — contextual chat for a specific task.
    Streams responses via Server-Sent Events (SSE).
    Supports free-form conversation and quick actions.
    Optionally persists messages when session_id is provided.
    """
    # Fetch the task with eager-loaded relationships for Level 0 context
    task = db.query(Todo).options(
        joinedload(Todo.comments),
        joinedload(Todo.attachments),
    ).filter(Todo.id == task_id, Todo.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Validate quick_action if provided
    if request.quick_action and request.quick_action not in QUICK_ACTIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid quick_action. Must be one of: {', '.join(QUICK_ACTIONS.keys())}"
        )

    session_id = request.session_id
    session = None

    # If session_id provided, validate ownership and persist user message
    if session_id:
        session = db.query(SolverSession).filter(
            SolverSession.id == session_id,
            SolverSession.todo_id == task_id,
            SolverSession.user_id == user_id,
        ).first()
        if not session:
            raise HTTPException(status_code=404, detail="Solver session not found")

        # Auto-title from first user message (check BEFORE adding)
        # Mirrors PA pattern: first 50 chars + '...' if truncated
        existing_count = db.query(SolverMessage).filter(
            SolverMessage.session_id == session_id
        ).count()
        if existing_count == 0:
            msg = request.message.strip()
            session.title = (msg[:50] + '...') if len(msg) > 50 else msg

        # Save user message and touch session timestamp
        user_msg = SolverMessage(
            session_id=session_id,
            role="user",
            content=request.message,
            quick_action=request.quick_action,
        )
        db.add(user_msg)
        session.updated_at = datetime.now(timezone.utc)
        db.commit()

    # If conversation_history is empty but session_id is set, load from DB
    history = [{"role": m.role, "content": m.content} for m in request.conversation_history]
    if not history and session_id:
        db_messages = db.query(SolverMessage).filter(
            SolverMessage.session_id == session_id,
        ).order_by(SolverMessage.created_at).all()
        # Exclude the just-saved user message (last one) — it'll be passed as user_message
        history = [{"role": m.role, "content": m.content} for m in db_messages[:-1]]

    async def event_generator():
        full_content = ""
        try:
            async for chunk in stream_solver_response(
                task=task,
                user_message=request.message,
                conversation_history=history,
                quick_action=request.quick_action,
                user_id=user_id,
            ):
                if chunk.get("type") == "token":
                    full_content += chunk.get("content", "")
                yield {
                    "event": "message",
                    "data": json.dumps(chunk)
                }
                if chunk.get("type") in ["complete", "error"]:
                    break
        except Exception as e:
            logger.error(f"Task solver streaming error: {str(e)}")
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": str(e)})
            }

        # Persist assistant response after streaming completes
        if session_id and full_content:
            try:
                assistant_msg = SolverMessage(
                    session_id=session_id,
                    role="assistant",
                    content=full_content,
                )
                db.add(assistant_msg)
                # Touch session timestamp so it sorts to top
                db.query(SolverSession).filter(SolverSession.id == session_id).update(
                    {"updated_at": datetime.now(timezone.utc)}
                )
                db.commit()
            except Exception as e:
                logger.error(f"Failed to save assistant message: {e}")

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )


# ==================== Solver Session CRUD Endpoints ====================

@router.get("/tasks/{task_id}/solver/sessions")
async def list_solver_sessions(
    task_id: int,
    user_id: int = Query(...),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """List all solver sessions for a task."""
    # Use subquery count to avoid N+1 lazy-loading of messages
    msg_count = (
        db.query(SolverMessage.session_id, func.count(SolverMessage.id).label("cnt"))
        .group_by(SolverMessage.session_id)
        .subquery()
    )
    query = (
        db.query(SolverSession, func.coalesce(msg_count.c.cnt, 0).label("message_count"))
        .outerjoin(msg_count, SolverSession.id == msg_count.c.session_id)
        .filter(
            SolverSession.todo_id == task_id,
            SolverSession.user_id == user_id,
        )
    )
    if search:
        query = query.filter(SolverSession.title.ilike(f"%{search}%"))
    rows = query.order_by(SolverSession.updated_at.desc()).all()
    return [
        {
            "id": s.id,
            "todo_id": s.todo_id,
            "title": s.title,
            "message_count": cnt,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s, cnt in rows
    ]


@router.post("/tasks/{task_id}/solver/sessions")
async def create_solver_session(
    task_id: int,
    user_id: int = Query(...),
    body: SolverSessionCreate = Body(SolverSessionCreate()),
    db: Session = Depends(get_db),
):
    """Create a new solver session for a task."""
    # Verify task exists
    task = db.query(Todo).filter(Todo.id == task_id, Todo.user_id == user_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    session = SolverSession(
        todo_id=task_id,
        user_id=user_id,
        title=body.title or "New conversation",
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session.to_dict()


@router.get("/tasks/{task_id}/solver/sessions/{session_id}")
async def get_solver_session(
    task_id: int,
    session_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Get a solver session with all messages."""
    session = db.query(SolverSession).filter(
        SolverSession.id == session_id,
        SolverSession.todo_id == task_id,
        SolverSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        **session.to_dict(),
        "messages": [m.to_dict() for m in session.messages],
    }


@router.delete("/tasks/{task_id}/solver/sessions/{session_id}")
async def delete_solver_session(
    task_id: int,
    session_id: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Delete a solver session and all its messages."""
    session = db.query(SolverSession).filter(
        SolverSession.id == session_id,
        SolverSession.todo_id == task_id,
        SolverSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return {"success": True}


@router.delete("/tasks/{task_id}/solver/sessions/{session_id}/messages/from/{message_index}")
async def delete_solver_messages_from_index(
    task_id: int,
    session_id: int,
    message_index: int,
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Delete all solver messages from a specific index (0-based, inclusive). Used by edit-message to truncate.

    Unlike PA which updates the message at index + deletes after, we delete FROM the index
    because the streaming endpoint will recreate the user message with the edited content.
    """
    session = db.query(SolverSession).filter(
        SolverSession.id == session_id,
        SolverSession.todo_id == task_id,
        SolverSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Get all messages ordered by created_at, then delete from the index (inclusive)
    messages = db.query(SolverMessage).filter(
        SolverMessage.session_id == session_id
    ).order_by(SolverMessage.created_at.asc()).all()

    if message_index < 0 or message_index >= len(messages):
        return {"deleted_count": 0}

    messages_to_delete = messages[message_index:]
    deleted_count = 0
    for msg in messages_to_delete:
        db.delete(msg)
        deleted_count += 1

    if deleted_count > 0:
        session.updated_at = datetime.now(timezone.utc)
        db.commit()

    return {"deleted_count": deleted_count}


@router.patch("/tasks/{task_id}/solver/sessions/{session_id}")
async def rename_solver_session(
    task_id: int,
    session_id: int,
    body: SolverSessionRename = Body(...),
    user_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Rename a solver session."""
    session = db.query(SolverSession).filter(
        SolverSession.id == session_id,
        SolverSession.todo_id == task_id,
        SolverSession.user_id == user_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.title = body.title
    db.commit()
    return session.to_dict()


# ==================== Email AI Endpoints ====================

from modules.agents.work.src.services.email_ai_service import email_ai_service
from pydantic import BaseModel


class EmailSummarizeRequest(BaseModel):
    """Request model for email summarization."""
    content: str
    sender: Optional[str] = None
    subject: Optional[str] = None


class EmailTranslateRequest(BaseModel):
    """Request model for email translation."""
    content: str
    target_language: str
    subject: Optional[str] = None


@router.post("/email/analyze/summarize")
async def summarize_email(request: EmailSummarizeRequest):
    """
    Summarize an email using AI.
    
    Returns:
    - summary: 1-2 sentence summary
    - key_points: 3-5 key points with type (action, deadline, info)
    - sentiment: Sender's sentiment (professional, friendly, urgent, neutral, frustrated)
    """
    try:
        result = await email_ai_service.summarize_email(
            email_content=request.content,
            sender=request.sender or "",
            subject=request.subject or ""
        )
        return {
            "status": "success",
            **result
        }
    except Exception as e:
        logger.error(f"Email summarization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/email/analyze/summarize/stream")
async def summarize_email_stream(
    content: str = Query(..., description="Email content to summarize"),
    sender: Optional[str] = Query(None, description="Email sender"),
    subject: Optional[str] = Query(None, description="Email subject")
):
    """
    Summarize an email using AI with streaming response.
    
    Uses GET request with query parameters to enable EventSource (browser-native SSE).
    This matches the personal assistant chat streaming pattern for true real-time streaming.
    
    Returns Server-Sent Events with:
    - type: 'token' - streaming tokens as they are generated
    - type: 'complete' - final parsed result with summary, key_points, sentiment
    - type: 'error' - error message if something fails
    """
    async def event_generator():
        try:
            async for chunk in email_ai_service.summarize_email_stream(
                email_content=content,
                sender=sender or "",
                subject=subject or ""
            ):
                yield {
                    "event": "message",
                    "data": json.dumps(chunk)
                }
                if chunk.get("type") in ["complete", "error"]:
                    break
        except Exception as e:
            logger.error(f"Email summarization streaming error: {str(e)}")
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": str(e)})
            }
    
    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )


@router.get("/email/analyze/translate/stream")
async def translate_email_stream(
    content: str = Query(..., description="Email content to translate"),
    target_language: str = Query(..., description="Target language code"),
    subject: Optional[str] = Query(None, description="Email subject")
):
    """
    Translate an email to a target language using AI with streaming response.
    
    Uses GET request with query parameters to enable EventSource (browser-native SSE).
    
    Returns Server-Sent Events with:
    - type: 'token' - streaming tokens as they are generated
    - type: 'complete' - final parsed result with translated content
    - type: 'error' - error message if something fails
    """
    async def event_generator():
        try:
            async for chunk in email_ai_service.translate_email_stream(
                email_content=content,
                target_language=target_language,
                subject=subject or ""
            ):
                yield {
                    "event": "message",
                    "data": json.dumps(chunk)
                }
                if chunk.get("type") in ["complete", "error"]:
                    break
        except Exception as e:
            logger.error(f"Email translation streaming error: {str(e)}")
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": str(e)})
            }
    
    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )


@router.post("/email/analyze/translate")
async def translate_email(request: EmailTranslateRequest):
    """
    Translate an email to a target language using AI.
    
    Supported languages: en, zh, zh-TW, es, fr, de, ja, ko, pt, ru, ar, it, nl, vi, th
    
    Returns:
    - translated_content: Translated email body
    - translated_subject: Translated subject (if provided)
    - detected_language: Detected source language
    - target_language: Target language name
    """
    try:
        result = await email_ai_service.translate_email(
            email_content=request.content,
            target_language=request.target_language,
            subject=request.subject or ""
        )
        return {
            "status": "success",
            **result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Email translation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/email/analyze/languages")
async def get_supported_languages():
    """Get list of supported languages for email translation."""
    return {
        "languages": email_ai_service.get_supported_languages()
    }

class GenerateTaskRequest(BaseModel):
    description: str
    current_status: Optional[str] = "todo"

class DraftEmailRequest(BaseModel):
    instructions: str
    context: Optional[str] = None
    sender_name: Optional[str] = None
    recipient_name: Optional[str] = None

class PolishEmailRequest(BaseModel):
    content: str
    tone: str = "professional"
    instruction: Optional[str] = None

@router.post("/tasks/generate/stream")
async def generate_task_stream(
    request: GenerateTaskRequest = Body(...)
):
    """
    Generate a structured task from a natural-language description.
    Returns Server-Sent Events (SSE) with generating → complete flow.
    """
    async def event_generator():
        try:
            yield {
                "event": "message",
                "data": json.dumps({"type": "generating", "content": ""})
            }
            result = await email_ai_service.generate_task_from_description(
                request.description, request.current_status
            )
            yield {
                "event": "message",
                "data": json.dumps({"type": "complete", "content": json.dumps(result)})
            }
        except Exception as e:
            logger.error(f"Task generation streaming error: {str(e)}")
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": str(e)})
            }

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )


@router.post("/email/draft/stream")
async def draft_email_stream(
    request: DraftEmailRequest = Body(...)
):
    """
    Draft an email based on instructions with streaming response.
    Returns Server-Sent Events (SSE).
    Using POST to avoid URL length limits with large context.
    """
    async def event_generator():
        try:
            async for chunk in email_ai_service.draft_email_stream(
                request.instructions, 
                request.context, 
                request.sender_name, 
                request.recipient_name
            ):
                yield {
                    "event": "message",
                    "data": json.dumps(chunk)
                }
                if chunk.get("type") in ["complete", "error"]:
                    break
        except Exception as e:
            logger.error(f"Email drafting streaming error: {str(e)}")
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": str(e)})
            }
            
    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )


@router.post("/email/analyze/subjects")
async def generate_reply_subjects(
    content: str = Body(..., embed=True),
    count: int = Body(3, embed=True)
):
    """
    Generate subject line suggestions for a reply.
    """
    try:
        subjects = await email_ai_service.generate_reply_subjects(email_content=content, count=count)
        return {"status": "success", "subjects": subjects}
    except Exception as e:
        logger.error(f"Subject generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/email/draft/polish/stream")
async def polish_email_stream(
    request: PolishEmailRequest = Body(...)
):
    """
    Polish/Refine email content with streaming response.
    Using POST to avoid URL length limits.
    """
    async def event_generator():
        try:
            async for chunk in email_ai_service.polish_email_stream(
                request.content, 
                request.tone, 
                request.instruction or ""
            ):
                yield {
                    "event": "message",
                    "data": json.dumps(chunk)
                }
                if chunk.get("type") in ["complete", "error"]:
                    break
        except Exception as e:
            logger.error(f"Email polishing streaming error: {str(e)}")
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": str(e)})
            }

    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*"
        }
    )


# ==================== Meeting Prep AI Endpoints ====================

from modules.agents.work.src.services.meeting_prep_service import get_meeting_prep_service
from modules.agents.work.src.services.calendar_analytics_service import (
    get_analytics_service, generate_calendar_recommendations
)


class MeetingPrepRequest(BaseModel):
    """Request model for meeting preparation."""
    event_id: str
    summary: str
    description: Optional[str] = None
    attendees: List[str] = []
    start: str
    end: str
    account_id: int


@router.post("/calendar/meeting-prep")
async def get_meeting_prep(
    request: MeetingPrepRequest,
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Generate AI-powered meeting preparation materials.

    Returns:
    - aiSummary: Brief AI summary of meeting context
    - discussionPoints: AI-generated discussion points
    - recentEmails: Recent emails with attendees
    - relatedDocs: Related documents (from email attachments)
    - meetingHistory: Previous meetings with same attendees
    """
    try:
        # Get OAuth token for fetching emails
        token = db.query(OAuthToken).filter(
            OAuthToken.id == request.account_id,
            OAuthToken.user_id == user_id,
            OAuthToken.provider == "google"
        ).first()

        recent_emails = []
        meeting_history = []
        related_docs = []
        email_context = ""

        token_warning = None

        if token:
            try:
                # Refresh token if expired
                access_token = await refresh_token_if_expired(token, db)

                credentials = google_oauth_service.get_credentials(
                    access_token,
                    token.get_refresh_token()
                )

                # Fetch recent emails with attendees (parallel per attendee)
                if request.attendees:
                    attendee_emails = [a for a in request.attendees if "@" in a][:3]  # Limit to 3
                    logger.info(f"Searching emails for attendees: {attendee_emails}")

                    async def _fetch_emails_for(attendee_email: str):
                        """Fetch emails for a single attendee (runs in thread pool)."""
                        try:
                            search_query = f"from:{attendee_email} OR to:{attendee_email}"
                            # Create GmailService per-thread — googleapiclient Resource
                            # objects use httplib2.Http which is NOT thread-safe
                            def _thread_fetch():
                                svc = GmailService(credentials)
                                return svc.get_messages(
                                    query=search_query,
                                    max_results=5,
                                    format="metadata",
                                )
                            result = await asyncio.to_thread(_thread_fetch)
                            emails_found = []
                            for email_data in result.get("messages", [])[:3]:
                                sender = email_data.get("sender_email", "")
                                if not sender:
                                    from_data = email_data.get("from", "")
                                    if isinstance(from_data, dict):
                                        sender = from_data.get("email", from_data.get("name", "Unknown"))
                                    else:
                                        sender = from_data or "Unknown"
                                emails_found.append({
                                    "subject": email_data.get("subject", "(No subject)"),
                                    "from": sender,
                                    "to": attendee_email,
                                    "date": email_data.get("date", ""),
                                    "snippet": email_data.get("snippet", "")[:200] if email_data.get("snippet") else "",
                                    "_context": f"\nEmail with {attendee_email}: {email_data.get('snippet', '')[:100]}",
                                })
                            logger.info(f"Found {len(result.get('messages', []))} emails for {attendee_email}")
                            return emails_found
                        except Exception as e:
                            logger.warning(f"Error fetching emails for {attendee_email}: {e}", exc_info=True)
                            return []

                    # Run all attendee email fetches in parallel
                    email_results = await asyncio.gather(
                        *[_fetch_emails_for(ae) for ae in attendee_emails],
                        return_exceptions=True,
                    )
                    for result_or_exc in email_results:
                        if isinstance(result_or_exc, Exception):
                            continue
                        for em in result_or_exc:
                            ctx = em.pop("_context", "")
                            recent_emails.append(em)
                            email_context += ctx

                # Fetch meeting history with same attendees (async)
                if request.attendees:
                    try:
                        calendar_service = CalendarService(credentials)
                        from datetime import timedelta
                        utc_now = datetime.now(timezone.utc)
                        past_date = (utc_now - timedelta(days=90)).isoformat()
                        now_str = utc_now.isoformat()

                        past_events = await asyncio.to_thread(
                            calendar_service.get_events,
                            time_min=past_date,
                            time_max=now_str,
                            max_results=100,
                        )
                        logger.info(f"Found {len(past_events)} past events to filter for meeting history")

                        attendee_set = set(a.lower() for a in request.attendees if "@" in a)

                        # Reverse so most recent meetings come first
                        for evt in reversed(past_events):
                            if evt.get("id") == request.event_id:
                                continue
                            evt_attendees = set(
                                a.get("email", "").lower()
                                for a in evt.get("attendees", [])
                                if a.get("email")
                            )
                            if attendee_set & evt_attendees:
                                meeting_history.append({
                                    "title": evt.get("summary", "(No title)"),
                                    "date": evt.get("start", ""),
                                    "summary": evt.get("description", "")[:200] if evt.get("description") else "",
                                })
                                if len(meeting_history) >= 5:
                                    break

                        logger.info(f"Meeting history result: {len(meeting_history)} meetings found")

                    except Exception as e:
                        logger.warning(f"Error fetching meeting history: {e}", exc_info=True)

            except TokenRefreshError as e:
                logger.warning(f"OAuth token invalid for meeting prep: {e}")
                # Don't return early — fall through to LLM generation so user
                # still gets AI discussion points from event title/description
                token_warning = "Google account access expired. Reconnect to include email and calendar history."
            except Exception as e:
                logger.warning(f"Error fetching context data: {e}")

        # Deduplicate emails across attendees (same email can appear for multiple attendees)
        seen_email_keys = set()
        unique_emails = []
        for em in recent_emails:
            key = (em.get("subject", ""), em.get("date", ""), em.get("from", ""))
            if key not in seen_email_keys:
                seen_email_keys.add(key)
                unique_emails.append(em)
        recent_emails = unique_emails

        # Generate AI discussion points and summary in parallel
        meeting_prep_service = get_meeting_prep_service()

        discussion_points, ai_summary = await asyncio.gather(
            meeting_prep_service.generate_discussion_points(
                meeting_title=request.summary,
                meeting_description=request.description,
                attendees=request.attendees,
                email_context=email_context if email_context else None
            ),
            meeting_prep_service.generate_meeting_summary(
                meeting_title=request.summary,
                attendees=request.attendees,
                email_count=len(recent_emails),
                has_history=len(meeting_history) > 0
            ),
        )

        result = {
            "status": "partial" if token_warning else "success",
            "aiSummary": ai_summary,
            "discussionPoints": discussion_points,
            "recentEmails": recent_emails,
            "relatedDocs": related_docs,  # TODO: Extract from email attachments
            "meetingHistory": meeting_history
        }
        if token_warning:
            result["warning"] = token_warning
        return result

    except Exception as e:
        logger.error(f"Meeting prep failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Calendar Analytics Endpoints ====================

class AnalyticsRequest(BaseModel):
    """Request model for calendar analytics."""
    days: int = Field(default=30, ge=7, le=90, description="Analysis period in days (7-90)")
    account_id: Optional[int] = Field(default=None, description="Specific account ID or all accounts")


@router.post("/calendar/analytics")
async def get_calendar_analytics(
    request: AnalyticsRequest,
    user_id: int = Query(..., description="User ID"),
    db: Session = Depends(get_db)
):
    """
    Get AI-powered calendar analytics for the specified period.

    Returns:
    - period: Analysis date range and work days count
    - summary: Total meetings, hours, focus time
    - meeting_vs_focus: Percentage breakdown of time usage
    - top_partners: Most frequent meeting attendees
    - daily_trends: Day-by-day meeting density
    - health_score: Work rhythm health score (0-100) with factors
    - recommendations: AI-generated productivity recommendations
    """
    try:
        from datetime import timedelta
        import asyncio

        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=request.days)

        # Get OAuth tokens for Google Calendar
        token_query = db.query(OAuthToken).filter(
            OAuthToken.user_id == user_id,
            OAuthToken.provider == "google"
        )

        if request.account_id:
            token_query = token_query.filter(OAuthToken.id == request.account_id)

        tokens = token_query.all()

        if not tokens:
            return {
                "status": "error",
                "error": "No Google accounts connected",
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": request.days
                }
            }

        # Fetch events from all accounts
        all_events = []

        async def fetch_account_events(token):
            """Fetch events for analytics from a single account."""
            try:
                access_token = await refresh_token_if_expired(token, db)

                credentials = google_oauth_service.get_credentials(
                    access_token,
                    token.get_refresh_token()
                )
                calendar_service = CalendarService(credentials)

                events = calendar_service.get_events(
                    calendar_id="primary",
                    time_min=start_date.isoformat() + "Z",
                    time_max=end_date.isoformat() + "Z",
                    max_results=1000,
                    single_events=True,
                    order_by="startTime"
                )

                # Add account info
                for evt in events:
                    evt["account_id"] = token.id
                    evt["account_email"] = token.account_email

                return events

            except Exception as e:
                logger.warning(f"Error fetching events for analytics from {token.account_email}: {e}")
                return []

        # Fetch from all accounts concurrently
        results = await asyncio.gather(*[fetch_account_events(token) for token in tokens])
        for result in results:
            all_events.extend(result)

        if not all_events:
            return {
                "status": "success",
                "period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": request.days,
                    "work_days": 0
                },
                "summary": {
                    "total_meetings": 0,
                    "meeting_hours": 0,
                    "focus_hours": 0,
                    "avg_meeting_duration": 0,
                    "total_work_hours": 0
                },
                "meeting_vs_focus": {
                    "meeting_hours": 0,
                    "meeting_percentage": 0,
                    "focus_hours": 0,
                    "focus_percentage": 100
                },
                "top_partners": [],
                "daily_trends": [],
                "health_score": {
                    "score": 100,
                    "status": "healthy",
                    "status_label": "Healthy",
                    "factors": []
                },
                "recommendations": [{
                    "title": "Start Scheduling",
                    "description": "No calendar events found in this period. Start adding meetings to get productivity insights.",
                    "priority": "low",
                    "impact": "focus_improved"
                }]
            }

        # Run analytics
        analytics_service = get_analytics_service()
        analytics_data = analytics_service.analyze(all_events, start_date, end_date)

        # Generate AI recommendations
        try:
            # Try to get LLM client for AI recommendations
            from langchain_openai import ChatOpenAI
            import os

            vllm_base = os.getenv("VLLM_API_BASE", "http://localhost:8888/v1")
            vllm_model = os.getenv("VLLM_MODEL", "Qwen/Qwen2.5-7B-Instruct")

            llm_client = ChatOpenAI(
                base_url=vllm_base,
                api_key="not-needed",
                model=vllm_model,
                temperature=0.7,
                max_tokens=1024
            )

            recommendations = await generate_calendar_recommendations(analytics_data, llm_client)
        except Exception as e:
            logger.warning(f"AI recommendations failed, using fallback: {e}")
            recommendations = await generate_calendar_recommendations(analytics_data, None)

        return {
            "status": "success",
            **analytics_data,
            "recommendations": recommendations
        }

    except Exception as e:
        logger.error(f"Calendar analytics failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AI Task Prioritization Endpoints ====================

# Shared constants for heuristic prioritization
_PRIORITY_RANK = {'urgent': 0, 'high': 1, 'medium': 2, 'low': 3, 'none': 4}
_RANK_TO_PRIORITY = {v: k for k, v in _PRIORITY_RANK.items()}  # reverse lookup: 0→'urgent', 1→'high', ...
_PRIORITY_SCORE_MAP = {'urgent': 0.9, 'high': 0.75, 'medium': 0.5, 'low': 0.25, 'none': 0.5}
_URGENT_KEYWORDS = {'urgent', 'asap', 'critical', 'blocker', 'blocking', 'emergency', 'immediately'}
_HIGH_KEYWORDS = {'important', 'deadline', 'required', 'must', 'needed'}
_QUICK_KEYWORDS = {'reply', 'respond', 'review', 'approve', 'confirm', 'rsvp', 'acknowledge', 'sign', 'forward'}
_MEETING_KEYWORDS = {'meeting', 'call', 'standup', 'sync'}
_CREATION_KEYWORDS = {'write', 'create', 'build', 'implement', 'develop', 'design'}

# --- Fine-grained time estimation categories (ordered by specificity) ---
# Each tuple: (keywords_list, minutes, label)
# More specific categories checked first; first match wins.
# Keywords use word-start boundary regex (\bkw) to prevent mid-word false positives
# (e.g., 'sign' won't match 'design') while preserving stem matches ('test' matches 'testing').
import re as _re

_TIME_CATEGORIES_RAW = [
    # Trivial actions (10 min)
    # Removed 'sign' (matches 'design'), 'star' (matches 'start'/'startup')
    (['rsvp', 'acknowledge', 'sign off', 'sign up', 'forward', 'archive',
      'label', 'tag', 'unsubscribe'],
     10, 'trivial action'),
    # Quick responses (15 min)
    (['reply', 'respond', 'confirm', 'approve', 'accept', 'decline', 'reject'],
     15, 'quick response'),
    # Administrative (20 min)
    # Removed 'file' (matches 'profile')
    (['schedule', 'book', 'register', 'enroll', 'file away', 'organize', 'tidy',
      'clean up', 'configure', 'set up', 'install', 'upgrade'],
     20, 'admin task'),
    # Short review (30 min)
    (['review', 'proofread', 'verify', 'validate', 'audit', 'inspect',
      'look over', 'go through', 'read through', 'skim'],
     30, 'review/check'),
    # Short meeting (30 min)
    # Removed 'daily' (too generic; "daily report" != meeting)
    # Removed 'retro' (matches 'retroactive'); kept 'retrospective'
    (['standup', 'stand-up', 'sync', 'huddle', 'check-in', 'check in',
      '1:1', 'one-on-one', 'scrum', 'retrospective', 'debrief'],
     30, 'short meeting'),
    # Standard meeting (60 min)
    (['meeting', 'call', 'interview', 'presentation', 'demo', 'workshop',
      'training', 'webinar', 'kickoff', 'kick-off', 'onboarding', 'offsite'],
     60, 'standard meeting'),
    # Research/analysis (45 min)
    (['research', 'investigate', 'analyze', 'explore', 'evaluate', 'assess',
      'benchmark', 'compare', 'study', 'look into', 'deep dive'],
     45, 'research/analysis'),
    # Documentation (45 min)
    (['document', 'documentation', 'wiki', 'readme', 'runbook', 'playbook',
      'changelog', 'release notes', 'update docs', 'write docs'],
     45, 'documentation'),
    # Planning (60 min)
    # Removed 'spec' (matches 'special'/'specific'); kept 'specification'
    (['plan', 'outline', 'scope', 'roadmap', 'strategy', 'brainstorm',
      'whiteboard', 'diagram', 'rfc', 'proposal', 'specification'],
     60, 'planning'),
    # Writing/content (60 min)
    # Removed 'memo' (matches 'memory'/'memorial')
    (['write', 'draft', 'compose', 'prepare', 'report', 'summary',
      'blog', 'article', 'newsletter', 'announcement'],
     60, 'writing/content'),
    # Small development (60 min)
    (['fix', 'patch', 'hotfix', 'tweak', 'adjust', 'update', 'modify',
      'rename', 'cleanup', 'lint', 'format'],
     60, 'small dev task'),
    # Testing (45 min)
    (['test', 'qa', 'debug', 'troubleshoot', 'diagnose', 'reproduce',
      'trace', 'monitor'],
     45, 'testing/debugging'),
    # Medium development (120 min)
    # Removed 'code' (matches 'barcode'), 'api' (matches 'capital'/'rapid')
    (['implement', 'develop', 'build', 'create', 'program', 'add feature',
      'integrate', 'connect', 'hook up', 'wire up', 'endpoint', 'codebase'],
     120, 'medium dev task'),
    # Large development (180 min)
    (['design', 'architect', 'refactor', 'rewrite', 'migrate', 'redesign',
      'overhaul', 'rebuild', 'rearchitect', 'optimize'],
     180, 'large dev task'),
]

# Pre-compile word-start boundary regex for each category (built once at import time).
# Uses \b before each keyword to anchor at word start — prevents "sign" matching "design"
# while allowing stem matches: "test" matches "testing", "review" matches "reviewing".
# Verbs ending in 'e' get auto-expanded: 'update' also generates 'updating' because
# English drops the 'e' before '-ing' (update→updating, not update+ing).
_TIME_CATEGORIES = []
for _kws, _mins, _lbl in _TIME_CATEGORIES_RAW:
    _expanded = list(_kws)
    for _kw in _kws:
        if _kw.endswith('e') and ' ' not in _kw and len(_kw) > 3:
            _expanded.append(_kw[:-1] + 'ing')  # update→updating, create→creating, migrate→migrating
    # Sort by length descending so longer phrases match before shorter prefixes
    _sorted_kws = sorted(set(_expanded), key=len, reverse=True)
    _pattern = _re.compile(r'\b(?:' + '|'.join(_re.escape(k) for k in _sorted_kws) + r')', _re.IGNORECASE)
    _TIME_CATEGORIES.append((_pattern, _mins, _lbl))


def _estimate_minutes(title: str, description: str = None, category: str = None) -> tuple:
    """
    Multi-signal heuristic time estimation.

    Analyzes title keywords (primary), description length (complexity signal),
    and category hint to produce a fine-grained estimate.

    Returns (estimated_minutes, label) where label explains the category matched.
    """
    text = (title or '').lower()
    desc_lower = (description or '').lower()

    # 1. Match against fine-grained categories (title is primary signal)
    matched_minutes = None
    matched_label = None
    for pattern, minutes, label in _TIME_CATEGORIES:
        if pattern.search(text):
            matched_minutes = minutes
            matched_label = label
            break

    # 2. If no title match, try description keywords (weaker signal)
    if matched_minutes is None and desc_lower:
        for pattern, minutes, label in _TIME_CATEGORIES:
            if pattern.search(desc_lower):
                matched_minutes = minutes
                matched_label = f'{label} (from description)'
                break

    # 3. Category-based fallback
    if matched_minutes is None and category:
        cat = category.lower()
        cat_map = {
            'meeting_prep': 45, 'meeting': 60, 'email': 20,
            'personal': 30, 'work': 60, 'development': 120,
            'planning': 60, 'research': 45, 'admin': 20,
        }
        for cat_key, mins in cat_map.items():
            if cat_key in cat:
                matched_minutes = mins
                matched_label = f'category: {category}'
                break

    # 4. Default fallback
    if matched_minutes is None:
        matched_minutes = 45  # neutral default (was 60, but most tasks are shorter)
        matched_label = 'default estimate'

    # 5. Description-length complexity adjustment (+/- 25%)
    #    Short desc (<50 chars) = simpler task, Long desc (>300 chars) = complex
    if desc_lower:
        desc_len = len(desc_lower)
        if desc_len > 300 and matched_minutes >= 30:
            # Complex: bump up by 25% (capped at +60 min)
            adjustment = min(int(matched_minutes * 0.25), 60)
            matched_minutes += adjustment
        elif desc_len < 50 and matched_minutes >= 30:
            # Simple: reduce by 15% (floor at 10 min)
            matched_minutes = max(int(matched_minutes * 0.85), 10)

    # 6. Round to nearest 5 minutes for cleaner display
    matched_minutes = max(5, 5 * round(matched_minutes / 5))

    return matched_minutes, matched_label


def _heuristic_all(todos: list) -> list:
    """
    Fast heuristic prioritization for ALL tasks. No LLM needed. <100ms.

    Uses due_date, title keywords, status, and existing priority to assign priority/order.
    Respects user-set priority: due_date analysis never downgrades it.
    """
    now_aware = datetime.now(timezone.utc)
    now_naive = datetime.now()

    results = []
    for t in todos:
        user_priority = t.priority or 'none'
        user_rank = _PRIORITY_RANK.get(user_priority, 4)
        priority = user_priority
        score = _PRIORITY_SCORE_MAP.get(user_priority, 0.5)
        reasoning_parts = []

        # 1. Due date analysis — never downgrades user-set priority
        due_days = None
        if t.due_date:
            try:
                due = t.due_date if hasattr(t.due_date, 'date') else datetime.fromisoformat(str(t.due_date).replace('Z', '+00:00'))
                now = now_aware if due.tzinfo else now_naive
                due_days = (due - now).days
                if due_days < 0:
                    due_priority, due_score = 'urgent', 0.95
                    reasoning_parts.append(f'overdue by {-due_days}d')
                elif due_days == 0:
                    due_priority, due_score = 'urgent', 0.9
                    reasoning_parts.append('due today')
                elif due_days <= 1:
                    due_priority, due_score = 'urgent', 0.85
                    reasoning_parts.append('due tomorrow')
                elif due_days <= 3:
                    due_priority, due_score = 'high', 0.75
                    reasoning_parts.append(f'due in {due_days}d')
                elif due_days <= 14:
                    due_priority, due_score = 'medium', 0.5
                    reasoning_parts.append(f'due in {due_days}d')
                else:
                    due_priority, due_score = 'low', 0.25
                    reasoning_parts.append(f'due in {due_days}d')

                # Fix 2: Take the higher priority between due-date and user-set
                due_rank = _PRIORITY_RANK.get(due_priority, 4)
                if due_rank <= user_rank:
                    # Due date suggests more urgent — use it
                    priority, score = due_priority, due_score
                else:
                    # User set a higher priority — keep it, use max score
                    priority = user_priority
                    score = max(score, due_score)
                    if user_priority != 'none':
                        reasoning_parts.append(f'user-set {user_priority} retained')
            except (ValueError, TypeError):
                pass
        else:
            reasoning_parts.append('no due date')

        # 2. Title keyword analysis
        title_lower = (t.title or '').lower()
        if any(kw in title_lower for kw in _URGENT_KEYWORDS):
            if _PRIORITY_RANK.get(priority, 2) > 0:
                priority, score = 'urgent', max(score, 0.85)
                reasoning_parts.append('urgent keyword in title')
        elif any(kw in title_lower for kw in _HIGH_KEYWORDS):
            if _PRIORITY_RANK.get(priority, 2) > 1:
                priority, score = 'high', max(score, 0.7)
                reasoning_parts.append('high-priority keyword')

        # 3. If still unprioritized after due-date and keywords, default to medium
        #    (must happen before in_progress boost so none→medium→high, not none→low)
        if priority == 'none':
            priority = 'medium'
            score = _PRIORITY_SCORE_MAP['medium']
            reasoning_parts.append('default (no signals)')

        # 4. Fix 3: in_progress tasks get a priority boost
        status = getattr(t, 'status', None) or 'todo'
        if status == 'in_progress':
            score = min(score + 0.1, 1.0)
            cur_rank = _PRIORITY_RANK.get(priority, 2)
            if cur_rank >= 1:  # high or lower → bump one level (high→urgent, medium→high, etc.)
                priority = _RANK_TO_PRIORITY.get(cur_rank - 1, priority)
            reasoning_parts.append('in-progress (boosted)')

        # 5. Multi-signal time estimation
        estimated_minutes, est_label = _estimate_minutes(
            t.title,
            description=getattr(t, 'description', None),
            category=getattr(t, 'category', None),
        )
        reasoning_parts.append(f'est: {est_label}')

        # 6. Use existing AI data if available (LLM estimate overrides heuristic)
        if t.ai_estimated_minutes:
            estimated_minutes = t.ai_estimated_minutes
        if t.ai_suggested_order and t.ai_last_analyzed:
            reasoning_parts.append('refined with prior AI data')

        results.append({
            'task_id': t.id,
            'task_type': 'todo',
            'title': t.title,
            'original_priority': t.priority or 'none',
            'suggested_priority': priority,
            'priority_score': round(score, 2),
            'reasoning': 'Heuristic: ' + ('; '.join(reasoning_parts) if reasoning_parts else 'default priority'),
            'estimated_minutes': estimated_minutes,
            'suggested_order': 0,
            '_due_days': due_days,  # internal: used for same-priority sorting
        })

    # Sort by priority rank, then score desc, then due_date asc (earlier deadline first)
    results.sort(key=lambda x: (
        _PRIORITY_RANK.get(x['suggested_priority'], 2),
        -x['priority_score'],
        x['_due_days'] if x['_due_days'] is not None else 9999,
    ))

    # Assign order and clean up internal fields
    for i, task in enumerate(results):
        task['suggested_order'] = i + 1
        task.pop('_due_days', None)

    return results


def _heuristic_insert(new_tasks: list, existing_tasks: list) -> list:
    """
    Heuristic-based priority assignment and insertion for new tasks.

    Assigns priority from due_date (respecting user-set priority), estimates minutes
    from title keywords, then inserts into existing sorted order by priority rank
    and due_date within the same rank.
    """
    now_aware = datetime.now(timezone.utc)
    now_naive = datetime.now()

    def _compute_due_days(t):
        """Compute days until due date, or None if no due date."""
        if not t.due_date:
            return None
        try:
            due = t.due_date if hasattr(t.due_date, 'date') else datetime.fromisoformat(str(t.due_date).replace('Z', '+00:00'))
            now = now_aware if due.tzinfo else now_naive
            return (due - now).days
        except (ValueError, TypeError):
            return None

    # Build ordered list from existing tasks (Fix 6: use _PRIORITY_SCORE_MAP, Fix 5: add _due_days)
    ordered = []
    for t in sorted(existing_tasks, key=lambda x: (x.ai_suggested_order or 999)):
        p = t.priority if t.priority and t.priority != 'none' else 'medium'
        ordered.append({
            'task_id': t.id,
            'task_type': 'todo',
            'title': t.title,
            'original_priority': t.priority or 'none',
            'suggested_priority': p,
            'priority_score': _PRIORITY_SCORE_MAP.get(p, 0.5),
            'reasoning': 'Previously analyzed',
            'estimated_minutes': t.ai_estimated_minutes or 60,
            'suggested_order': 0,
            '_due_days': _compute_due_days(t),
        })

    # Analyze and insert each new task
    for t in new_tasks:
        user_priority = t.priority or 'none'
        user_rank = _PRIORITY_RANK.get(user_priority, 4)
        priority = user_priority
        score = _PRIORITY_SCORE_MAP.get(user_priority, 0.5)
        reasoning_parts = []

        due_days = _compute_due_days(t)
        if due_days is not None:
            if due_days < 0:
                due_priority, due_score = 'urgent', 0.95
                reasoning_parts.append(f'overdue by {-due_days}d')
            elif due_days == 0:
                due_priority, due_score = 'urgent', 0.9
                reasoning_parts.append('due today')
            elif due_days <= 1:
                due_priority, due_score = 'urgent', 0.85
                reasoning_parts.append('due tomorrow')
            elif due_days <= 3:
                due_priority, due_score = 'high', 0.75
                reasoning_parts.append(f'due in {due_days}d')
            elif due_days <= 14:
                due_priority, due_score = 'medium', 0.5
                reasoning_parts.append(f'due in {due_days}d')
            else:
                due_priority, due_score = 'low', 0.25
                reasoning_parts.append(f'due in {due_days}d')

            # Take higher priority between due-date and user-set
            due_rank = _PRIORITY_RANK.get(due_priority, 4)
            if due_rank <= user_rank:
                priority, score = due_priority, due_score
            else:
                priority = user_priority
                score = max(score, due_score)
                if user_priority != 'none':
                    reasoning_parts.append(f'user-set {user_priority} retained')
        else:
            reasoning_parts.append('no due date')

        # Title keyword analysis (aligned with _heuristic_all)
        title_lower = (t.title or '').lower()
        if any(kw in title_lower for kw in _URGENT_KEYWORDS):
            if _PRIORITY_RANK.get(priority, 2) > 0:
                priority, score = 'urgent', max(score, 0.85)
                reasoning_parts.append('urgent keyword in title')
        elif any(kw in title_lower for kw in _HIGH_KEYWORDS):
            if _PRIORITY_RANK.get(priority, 2) > 1:
                priority, score = 'high', max(score, 0.7)
                reasoning_parts.append('high-priority keyword')

        # If still unprioritized, default to medium
        if priority == 'none':
            priority = 'medium'
            score = _PRIORITY_SCORE_MAP['medium']

        # in_progress tasks get a priority boost (aligned with _heuristic_all)
        status = getattr(t, 'status', None) or 'todo'
        if status == 'in_progress':
            score = min(score + 0.1, 1.0)
            cur_rank = _PRIORITY_RANK.get(priority, 2)
            if cur_rank >= 1:
                priority = _RANK_TO_PRIORITY.get(cur_rank - 1, priority)
            reasoning_parts.append('in-progress (boosted)')

        # Multi-signal time estimation (aligned with _heuristic_all)
        estimated_minutes, est_label = _estimate_minutes(
            t.title,
            description=getattr(t, 'description', None),
            category=getattr(t, 'category', None),
        )
        reasoning_parts.append(f'est: {est_label}')

        new_entry = {
            'task_id': t.id,
            'task_type': 'todo',
            'title': t.title,
            'original_priority': t.priority or 'none',
            'suggested_priority': priority,
            'priority_score': round(score, 2),
            'reasoning': 'Heuristic: ' + ('; '.join(reasoning_parts) if reasoning_parts else 'due-date based priority'),
            'estimated_minutes': estimated_minutes,
            'suggested_order': 0,
            '_due_days': due_days,
        }

        # Fix 5: Insert by priority rank; within same rank, by due_days (earlier first)
        new_rank = _PRIORITY_RANK.get(priority, 2)
        new_due = due_days if due_days is not None else 9999
        insert_idx = len(ordered)
        for i, task in enumerate(ordered):
            task_rank = _PRIORITY_RANK.get(task.get('suggested_priority', 'medium'), 2)
            if new_rank < task_rank:
                insert_idx = i
                break
            elif new_rank == task_rank:
                task_due = task.get('_due_days')
                task_due = task_due if task_due is not None else 9999
                if new_due < task_due:
                    insert_idx = i
                    break
        ordered.insert(insert_idx, new_entry)

    # Re-number suggested_order and clean up internal fields
    for i, task in enumerate(ordered):
        task['suggested_order'] = i + 1
        task.pop('_due_days', None)

    return ordered


def _save_priorities_to_db(db: Session, user_id: int, prioritized_tasks: list):
    """
    Persist priority results to DB in a single transaction.

    Updates priority, ai_suggested_order, ai_estimated_minutes, ai_last_analyzed
    for all affected todos.

    Uses a raw UPDATE for ai_last_analyzed to avoid triggering onupdate on updated_at,
    which would invalidate the cache immediately.
    """
    from sqlalchemy import update as sa_update

    todo_updates = {t['task_id']: t for t in prioritized_tasks if t.get('task_type') == 'todo'}

    if not todo_updates:
        return

    todos = db.query(Todo).filter(
        Todo.user_id == user_id,
        Todo.id.in_(todo_updates.keys())
    ).all()

    # Generic/fallback reasoning prefixes that should NOT be persisted
    _GENERIC_PREFIXES = ('Fallback', 'Previously', 'Heuristic', 'AI-analyzed')

    for todo in todos:
        update = todo_updates.get(todo.id)
        if update:
            todo.priority = update['suggested_priority']
            todo.ai_suggested_order = update['suggested_order']
            todo.ai_estimated_minutes = update['estimated_minutes']
            # Only persist genuine LLM reasoning on first prioritization
            reasoning = update.get('reasoning', '')
            is_genuine = reasoning and not reasoning.startswith(_GENERIC_PREFIXES)
            if not todo.ai_priority_reasoning and is_genuine:
                todo.ai_priority_reasoning = reasoning[:500]

    # Flush to persist ORM changes (triggers onupdate for updated_at)
    db.flush()

    # Set ai_last_analyzed via raw UPDATE to avoid re-triggering onupdate on updated_at
    now = datetime.now(timezone.utc)
    todo_ids = [tid for tid in todo_updates.keys()]
    if todo_ids:
        db.execute(
            sa_update(Todo)
            .where(Todo.id.in_(todo_ids), Todo.user_id == user_id)
            .values(ai_last_analyzed=now)
        )

    db.commit()


def _build_response_from_db(todos: list, calendar_events: list = None, method: str = "cached") -> TaskPrioritizeResponse:
    """
    Construct TaskPrioritizeResponse directly from existing Todo DB fields.
    """
    prioritized_tasks = []
    for idx, t in enumerate(sorted(todos, key=lambda x: (x.ai_suggested_order or 999))):
        p = t.priority if t.priority and t.priority != 'none' else 'medium'
        prioritized_tasks.append(PrioritizedTask(
            task_id=t.id,
            task_type='todo',
            title=t.title,
            original_priority=t.priority or 'none',
            suggested_priority=p,
            priority_score=_PRIORITY_SCORE_MAP.get(p, 0.5),
            reasoning=t.ai_priority_reasoning or 'Previously analyzed',
            estimated_minutes=t.ai_estimated_minutes or 60,
            suggested_order=t.ai_suggested_order or (idx + 1)
        ))

    # Build summary
    summary_counts = {'urgent': 0, 'high': 0, 'medium': 0, 'low': 0, 'none': 0}
    total_minutes = 0
    for pt in prioritized_tasks:
        if pt.suggested_priority in summary_counts:
            summary_counts[pt.suggested_priority] += 1
        total_minutes += pt.estimated_minutes

    calendar_events_response = []
    if calendar_events:
        calendar_events_response = [CalendarEvent(**evt) for evt in calendar_events]

    return TaskPrioritizeResponse(
        prioritized_tasks=prioritized_tasks,
        schedule={},
        calendar_events=calendar_events_response,
        warnings=[],
        summary=PrioritizationSummary(
            total_tasks=len(prioritized_tasks),
            urgent=summary_counts['urgent'],
            high=summary_counts['high'],
            medium=summary_counts['medium'],
            low=summary_counts['low'],
            none=summary_counts['none'],
            total_estimated_hours=round(total_minutes / 60, 1),
            scheduled_days=0
        ),
        method=method
    )


def _build_response_from_list(prioritized_tasks: list, calendar_events: list = None, method: str = "heuristic") -> TaskPrioritizeResponse:
    """
    Construct TaskPrioritizeResponse from a list of dicts (heuristic/insert results).
    """
    pt_objects = []
    for t in prioritized_tasks:
        pt_objects.append(PrioritizedTask(
            task_id=t['task_id'],
            task_type=t.get('task_type', 'todo'),
            title=t['title'],
            original_priority=t.get('original_priority', 'none'),
            suggested_priority=t['suggested_priority'],
            priority_score=t.get('priority_score', 0.5),
            reasoning=t.get('reasoning', 'Heuristic analysis'),
            estimated_minutes=t.get('estimated_minutes', 60),
            suggested_order=t['suggested_order']
        ))

    summary_counts = {'urgent': 0, 'high': 0, 'medium': 0, 'low': 0, 'none': 0}
    total_minutes = 0
    for pt in pt_objects:
        if pt.suggested_priority in summary_counts:
            summary_counts[pt.suggested_priority] += 1
        total_minutes += pt.estimated_minutes

    cal_response = []
    if calendar_events:
        cal_response = [CalendarEvent(**evt) for evt in calendar_events]

    return TaskPrioritizeResponse(
        prioritized_tasks=pt_objects,
        schedule={},
        calendar_events=cal_response,
        warnings=[],
        summary=PrioritizationSummary(
            total_tasks=len(pt_objects),
            urgent=summary_counts['urgent'],
            high=summary_counts['high'],
            medium=summary_counts['medium'],
            low=summary_counts['low'],
            none=summary_counts['none'],
            total_estimated_hours=round(total_minutes / 60, 1),
            scheduled_days=0
        ),
        method=method
    )


def _build_response_from_result(result: dict, calendar_events: list = None, method: str = "batch_llm") -> TaskPrioritizeResponse:
    """
    Construct TaskPrioritizeResponse from a service result dict (LLM paths).
    """
    pt_objects = []
    for t in result.get("prioritized_tasks", []):
        pt_objects.append(PrioritizedTask(
            task_id=t['task_id'],
            task_type=t.get('task_type', 'todo'),
            title=t.get('title', f'Task {t["task_id"]}'),
            original_priority=t.get('original_priority', 'none'),
            suggested_priority=t.get('suggested_priority', 'medium'),
            priority_score=t.get('priority_score', 0.5),
            reasoning=t.get('reasoning', 'AI analysis'),
            estimated_minutes=t.get('estimated_minutes', 60),
            suggested_order=t.get('suggested_order', 1)
        ))

    summary = result.get("summary", {})
    total_minutes = sum(pt.estimated_minutes for pt in pt_objects)

    cal_response = []
    if calendar_events:
        cal_response = [CalendarEvent(**evt) for evt in calendar_events]

    # Build warnings from result if present
    warnings = []
    for w in result.get("warnings", []):
        if isinstance(w, dict):
            warnings.append(PrioritizationWarning(**w))
        else:
            warnings.append(w)

    return TaskPrioritizeResponse(
        prioritized_tasks=pt_objects,
        schedule=result.get("schedule", {}),
        calendar_events=cal_response,
        warnings=warnings,
        summary=PrioritizationSummary(
            total_tasks=len(pt_objects),
            urgent=summary.get('urgent', sum(1 for pt in pt_objects if pt.suggested_priority == 'urgent')),
            high=summary.get('high', sum(1 for pt in pt_objects if pt.suggested_priority == 'high')),
            medium=summary.get('medium', sum(1 for pt in pt_objects if pt.suggested_priority == 'medium')),
            low=summary.get('low', sum(1 for pt in pt_objects if pt.suggested_priority == 'low')),
            none=summary.get('none', sum(1 for pt in pt_objects if pt.suggested_priority == 'none')),
            total_estimated_hours=round(total_minutes / 60, 1),
            scheduled_days=summary.get('scheduled_days', 0)
        ),
        method=method
    )


async def _fetch_calendar_parallel(tokens, db, schedule_start, schedule_end):
    """Fetch calendar events from multiple OAuth tokens concurrently."""

    # Refresh tokens serially first (Session is not thread-safe)
    valid_tokens = []
    for token in tokens:
        try:
            await refresh_token_if_expired(token, db)
            valid_tokens.append(token)
        except Exception as e:
            logger.warning(f"Token refresh failed for calendar fetch: {e}")

    if not valid_tokens:
        return []

    async def fetch_for_token(token):
        """Fetch events for a single token (read-only, no DB writes)."""
        events = []
        try:
            credentials = google_oauth_service.get_credentials(
                token.get_access_token(),
                token.get_refresh_token()
            )
            calendar_service = CalendarService(credentials)

            raw_events = await asyncio.to_thread(
                calendar_service.get_events,
                time_min=schedule_start.isoformat() + "Z",
                time_max=schedule_end.isoformat() + "Z",
                max_results=100
            )

            for evt in raw_events:
                start = evt.get("start", "")
                end = evt.get("end", "")
                if isinstance(start, str):
                    start_date = start[:10] if len(start) >= 10 else ""
                    start_time = start[11:16] if len(start) >= 16 else "00:00"
                else:
                    start_date = ""
                    start_time = "00:00"
                if isinstance(end, str):
                    end_time = end[11:16] if len(end) >= 16 else "23:59"
                else:
                    end_time = "23:59"

                events.append({
                    "date": start_date,
                    "start": start_time,
                    "end": end_time,
                    "title": evt.get("summary", "Busy")
                })
        except Exception as e:
            logger.warning(f"Error fetching calendar for prioritization: {e}")
        return events

    results = await asyncio.gather(*[fetch_for_token(t) for t in valid_tokens], return_exceptions=True)
    all_events = []
    for r in results:
        if isinstance(r, list):
            all_events.extend(r)
    return all_events


@router.post("/tasks/prioritize", response_model=TaskPrioritizeResponse)
async def prioritize_tasks(
    request: TaskPrioritizeRequest,
    db: Session = Depends(get_db)
):
    """
    Smart task prioritization with mode-based routing.

    Modes:
    - 'fast': Heuristic only, <100ms, no LLM. Best for Backlog quick-sort.
    - 'ai': LLM with parallel batching, ~8-15s. Best for deep analysis.
    - 'auto': Smart routing (cache → heuristic → incremental → batch LLM).

    Auto-saves results to DB.
    """
    from modules.agents.work.src.services.task_prioritization_service import task_prioritization_service
    from backend.models.oauth_token import OAuthToken

    try:
        user_id = request.user_id
        mode = request.mode or "auto"

        # Fetch active todos (none, todo, in_progress) for prioritization
        query = db.query(Todo).filter(
            Todo.user_id == user_id,
            Todo.status.in_(["none", "todo", "in_progress"])
        )
        if request.task_ids:
            query = query.filter(Todo.id.in_(request.task_ids))

        todos = query.order_by(Todo.due_date.asc().nullslast()).all()

        if not todos:
            return TaskPrioritizeResponse(
                prioritized_tasks=[],
                schedule={},
                calendar_events=[],
                warnings=[],
                summary=PrioritizationSummary(
                    total_tasks=0, urgent=0, high=0, medium=0, low=0,
                    total_estimated_hours=0, scheduled_days=0
                ),
                method="cached"
            )

        # Split into already-analyzed vs needs-analysis
        already_analyzed = []
        needs_analysis = []
        for t in todos:
            if (t.ai_last_analyzed is not None
                    and t.updated_at is not None
                    and t.ai_last_analyzed >= t.updated_at):
                already_analyzed.append(t)
            else:
                needs_analysis.append(t)

        logger.info(
            f"Prioritization routing (mode={mode}): {len(already_analyzed)} cached, "
            f"{len(needs_analysis)} need analysis (total: {len(todos)})"
        )

        # ---- TIER 1: DB Cache ----
        # Even in 'ai' mode, return cache if ALL tasks are already analyzed and unchanged.
        # The user can edit a task to trigger re-analysis.
        if not needs_analysis:
            logger.info("Tier 1: DB Cache - returning cached priorities")
            return _build_response_from_db(already_analyzed, method="cached")

        # ---- MODE: FAST (heuristic only for un-analyzed tasks, <100ms) ----
        if mode == "fast":
            if already_analyzed:
                # Merge: heuristic-insert new tasks into existing analyzed order
                all_prioritized = _heuristic_insert(needs_analysis, already_analyzed)
            else:
                # No prior analysis — heuristic all
                all_prioritized = _heuristic_all(todos)
            logger.info(f"Fast mode: heuristic for {len(needs_analysis)} new tasks (total: {len(todos)})")
            _save_priorities_to_db(db, user_id, all_prioritized)
            return _build_response_from_list(all_prioritized, method="heuristic")

        # Build context
        context = {}
        if request.context:
            context = {
                "work_hours_per_day": request.context.work_hours_per_day,
                "work_days": request.context.work_days,
                "preferred_start_time": request.context.preferred_start_time,
                "schedule_start_date": request.context.schedule_start_date or datetime.now().strftime("%Y-%m-%d"),
                "schedule_days": request.context.schedule_days
            }

        # ---- TIER 2: Heuristic Insert (auto mode, ≤3 new tasks) ----
        # Heuristic handles tasks without due_date well (keyword analysis + default to medium)
        if (mode == "auto"
                and len(needs_analysis) <= 3
                and already_analyzed):
            logger.info(f"Tier 2: Heuristic Insert - {len(needs_analysis)} new tasks")
            all_prioritized = _heuristic_insert(needs_analysis, already_analyzed)
            _save_priorities_to_db(db, user_id, all_prioritized)
            return _build_response_from_list(all_prioritized, method="heuristic")

        # ---- LLM TIERS: Calendar fetch in parallel with LLM ----
        # Prepare calendar fetch as a coroutine (don't await yet)
        async def fetch_calendar():
            try:
                tokens = db.query(OAuthToken).filter(
                    OAuthToken.user_id == user_id,
                    OAuthToken.provider == "google",
                    OAuthToken.is_revoked == 0
                ).all()
                if tokens:
                    schedule_start = datetime.strptime(
                        context.get("schedule_start_date", datetime.now().strftime("%Y-%m-%d")),
                        "%Y-%m-%d"
                    )
                    schedule_end = schedule_start + timedelta(days=context.get("schedule_days", 7))
                    return await _fetch_calendar_parallel(tokens, db, schedule_start, schedule_end)
            except Exception as e:
                logger.warning(f"Could not fetch calendar events: {e}")
            return []

        # ---- TIER 3: Incremental LLM (auto mode, some cached + some new) ----
        if mode == "auto" and already_analyzed:
            logger.info(f"Tier 3: Incremental LLM - {len(needs_analysis)} new, {len(already_analyzed)} cached")

            # Fix 7: Fetch calendar first so LLM can see real events
            existing_summary = [t.to_dict() for t in already_analyzed]
            new_tasks_data = [t.to_dict() for t in needs_analysis]

            calendar_events = await fetch_calendar()
            result = await task_prioritization_service.prioritize_incremental(
                new_tasks=new_tasks_data,
                existing_tasks=existing_summary,
                calendar_events=calendar_events,
            )

            # Save and respond
            prioritized_tasks_data = result.get("prioritized_tasks", [])
            _save_priorities_to_db(db, user_id, prioritized_tasks_data)
            return _build_response_from_result(result, calendar_events=calendar_events, method="incremental_llm")

        # ---- TIER 4: Parallel Batch LLM (ai mode, or auto with all new) ----
        task_count = len(needs_analysis) if needs_analysis else len(todos)
        target_todos = needs_analysis if needs_analysis else todos
        logger.info(f"Tier 4: Parallel Batch LLM (mode={mode}) - {task_count} tasks")
        todos_data = [t.to_dict() for t in target_todos]

        # Add already-analyzed tasks data for complete ordering (if any)
        if already_analyzed and needs_analysis:
            for t in already_analyzed:
                d = t.to_dict()
                d['type'] = 'todo'
                todos_data.append(d)

        # Fix 7: Fetch calendar first so LLM can see real events
        calendar_events = await fetch_calendar()
        result = await task_prioritization_service.prioritize_batch_parallel(
            todos=todos_data,
            calendar_events=calendar_events,
            batch_size=8
        )

        # Save and respond
        prioritized_tasks_data = result.get("prioritized_tasks", [])
        _save_priorities_to_db(db, user_id, prioritized_tasks_data)
        return _build_response_from_result(result, calendar_events=calendar_events, method="batch_llm")

    except Exception as e:
        logger.error(f"Task prioritization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/schedule", response_model=TaskSchedulePreviewResponse)
async def schedule_tasks_preview(
    request: TaskScheduleRequest,
    db: Session = Depends(get_db)
):
    """
    AI Task Scheduler — Preview step. Generates optimal time slots WITHOUT creating
    Google Calendar events. Returns proposed slots for user review/editing.

    1. Fetches pending tasks (optionally filtered by task_ids)
    2. Fetches existing calendar events for the scheduling period
    3. Uses LLM to generate optimal time slots avoiding conflicts
    4. Returns proposed slots (no events created)
    """
    from modules.agents.work.src.services.task_scheduling_service import task_scheduling_service
    from backend.models.oauth_token import OAuthToken

    try:
        user_id = request.user_id

        # 1. Fetch pending tasks (exclude already-scheduled and calendar-sourced)
        from sqlalchemy import or_
        query = db.query(Todo).filter(
            Todo.user_id == user_id,
            Todo.status.in_(["todo", "in_progress", "review"]),
            Todo.is_scheduled == False,
            or_(
                Todo.external_source.is_(None),
                ~Todo.external_source.in_(["calendar", "ai_extracted_calendar"]),
            ),
        )
        if request.task_ids:
            query = query.filter(Todo.id.in_(request.task_ids))

        todos = query.order_by(Todo.due_date.asc().nullslast()).all()

        if not todos:
            return TaskSchedulePreviewResponse(
                success=True,
                scheduled_slots=[],
                skipped_tasks=[],
                warnings=["No pending tasks to schedule."]
            )

        # 2. Get OAuth token (must not be revoked)
        token = db.query(OAuthToken).filter(
            OAuthToken.id == request.account_id,
            OAuthToken.user_id == user_id,
            OAuthToken.provider == "google",
            OAuthToken.is_revoked == 0
        ).first()

        if not token:
            raise HTTPException(status_code=404, detail="Google account not found or has been revoked. Please reconnect your Google account.")

        await refresh_token_if_expired(token, db)

        # 3. Build calendar service (reused for timezone + event fetching)
        credentials = google_oauth_service.get_credentials(
            token.get_access_token(),
            token.get_refresh_token()
        )
        calendar_service = CalendarService(credentials)

        # Get user's timezone: prefer browser timezone (from frontend), fallback to Google Calendar
        from zoneinfo import ZoneInfo
        user_timezone = None
        # 1st: try browser timezone
        if request.user_timezone:
            try:
                ZoneInfo(request.user_timezone)  # validate
                user_timezone = request.user_timezone
            except (KeyError, Exception):
                logger.warning(f"Invalid browser timezone '{request.user_timezone}', falling back to Google Calendar")
        # 2nd: fallback to Google Calendar timezone
        if not user_timezone:
            try:
                cal_meta = await asyncio.to_thread(
                    calendar_service.service.calendars().get(calendarId="primary").execute
                )
                user_timezone = cal_meta.get("timeZone", "UTC")
            except Exception as tz_err:
                logger.warning(f"Could not fetch calendar timezone, defaulting to UTC: {tz_err}")
                user_timezone = "UTC"
        user_now = datetime.now(ZoneInfo(user_timezone))
        logger.info(f"User timezone: {user_timezone}, user_now: {user_now.strftime('%Y-%m-%d %H:%M')}")

        # 4. Fetch existing calendar events for the scheduling period
        #    Use the requested start for fetching events (full week for conflict detection),
        #    but clamp the scheduling start to user's today so we never place tasks in the past.
        requested_start_date = request.schedule_start_date or user_now.strftime("%Y-%m-%d")
        requested_start = datetime.strptime(requested_start_date, "%Y-%m-%d")
        schedule_end = requested_start + timedelta(days=request.schedule_days)

        today = user_now.strftime("%Y-%m-%d")
        schedule_start_date = max(requested_start_date, today)
        schedule_start = datetime.strptime(schedule_start_date, "%Y-%m-%d")
        remaining_days = (schedule_end - schedule_start).days
        if remaining_days <= 0:
            return TaskSchedulePreviewResponse(
                success=True,
                scheduled_slots=[],
                skipped_tasks=[{"id": t.id, "title": t.title} for t in todos],
                warnings=["No remaining days in this week to schedule. Try next week."]
            )

        # Reuse the same calendar_service to fetch events (skip redundant token refresh)
        # Add 1-day buffer on each side to cover timezone offsets (UTC-12 to UTC+14)
        try:
            fetch_start = requested_start - timedelta(days=1)
            fetch_end = schedule_end + timedelta(days=1)
            raw_events = await asyncio.to_thread(
                calendar_service.get_events,
                time_min=fetch_start.isoformat() + "Z",
                time_max=fetch_end.isoformat() + "Z",
                max_results=250,
            )
        except Exception as e:
            logger.error(f"Failed to fetch calendar events: {e}")
            return TaskSchedulePreviewResponse(
                success=False,
                scheduled_slots=[],
                skipped_tasks=[{"id": t.id, "title": t.title} for t in todos],
                warnings=[f"Could not fetch calendar events: {str(e)}. Please try again or reconnect your Google account."]
            )

        calendar_events = []
        for evt in raw_events:
            start = evt.get("start", "")
            end = evt.get("end", "")
            title = evt.get("summary", "Busy")

            if isinstance(start, str):
                start_date = start[:10] if len(start) >= 10 else ""
                start_time = start[11:16] if len(start) >= 16 else "00:00"
            else:
                start_date = ""
                start_time = "00:00"
            if isinstance(end, str):
                end_date = end[:10] if len(end) >= 10 else start_date
                end_time = end[11:16] if len(end) >= 16 else "23:59"
            else:
                end_date = start_date
                end_time = "23:59"

            # Check if this is a multi-day all-day event (date-only strings spanning multiple days)
            is_all_day = isinstance(start, str) and len(start) <= 10
            if is_all_day and start_date and end_date and end_date > start_date:
                # Emit one blocking entry per day in the range
                from datetime import date as date_cls
                day_cursor = date_cls.fromisoformat(start_date)
                day_end = date_cls.fromisoformat(end_date)  # Google Calendar: end is exclusive for all-day
                while day_cursor < day_end:
                    calendar_events.append({
                        "date": day_cursor.isoformat(),
                        "start": "00:00",
                        "end": "23:59",
                        "title": title,
                    })
                    day_cursor += timedelta(days=1)
            else:
                calendar_events.append({
                    "date": start_date,
                    "start": start_time,
                    "end": end_time,
                    "title": title,
                })

        # 4. Prepare task data for scheduling service
        tasks_data = []
        task_map = {t.id: t for t in todos}
        for t in todos:
            tasks_data.append({
                "id": t.id,
                "title": t.title,
                "priority": t.priority or "medium",
                "estimated_minutes": t.ai_estimated_minutes or 60,
                "due_date": t.due_date.strftime("%Y-%m-%d") if t.due_date else None,
                "status": t.status,
            })

        # 5. Generate schedule via LLM (from user's now through end of week)
        scheduled_slots = await task_scheduling_service.generate_schedule(
            tasks=tasks_data,
            calendar_events=calendar_events,
            schedule_start_date=schedule_start_date,
            schedule_days=remaining_days,
            preferred_start_time=request.preferred_start_time,
            preferred_end_time=request.preferred_end_time,
            work_days=request.work_days,
            now=user_now,
            scheduling_instructions=request.scheduling_instructions,
        )

        if not scheduled_slots:
            return TaskSchedulePreviewResponse(
                success=True,
                scheduled_slots=[],
                skipped_tasks=[{"id": t.id, "title": t.title} for t in todos],
                warnings=["Could not find available time slots for any tasks."]
            )

        # Convert raw slots to ScheduleSlot objects
        preview_slots = []
        scheduled_task_ids = set()
        for slot in scheduled_slots:
            task_id = slot['task_id']
            task = task_map.get(task_id)
            if not task:
                continue
            scheduled_task_ids.add(task_id)
            s_parts = slot['start_time'].split(':')
            e_parts = slot['end_time'].split(':')
            slot_minutes = (int(e_parts[0]) * 60 + int(e_parts[1])) - (int(s_parts[0]) * 60 + int(s_parts[1]))
            preview_slots.append(ScheduleSlot(
                task_id=task.id,
                task_title=task.title,
                date=slot['date'],
                start_time=slot['start_time'],
                end_time=slot['end_time'],
                estimated_minutes=slot_minutes,
                priority=task.priority or "medium",
            ))

        skipped_tasks = []
        for t in todos:
            if t.id not in scheduled_task_ids:
                skipped_tasks.append({"id": t.id, "title": t.title, "reason": "No available time slot"})

        return TaskSchedulePreviewResponse(
            success=True,
            scheduled_slots=preview_slots,
            skipped_tasks=skipped_tasks,
            warnings=[],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Task scheduling preview failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/schedule/accept", response_model=TaskScheduleAcceptResponse)
async def schedule_tasks_accept(
    request: TaskScheduleAcceptRequest,
    db: Session = Depends(get_db)
):
    """
    Accept step — saves schedule slots locally (DB only, no Google Calendar).

    Marks tasks as is_scheduled=True with scheduled_start/end times.
    No account_id required. Calendar push is a separate step.
    """
    try:
        from datetime import datetime as dt

        user_id = request.user_id
        accepted = 0
        warnings = []

        # Group slots by task_id to handle multi-block scheduling.
        # Use the FIRST (earliest) slot as the primary scheduled time.
        # If same task has multiple slots on the same day and they are contiguous,
        # merge them. Otherwise keep only the first slot (DB stores one start/end per task).
        task_slots = {}
        for slot in request.slots:
            # Validate times
            s_parts = slot.start_time.split(':')
            e_parts = slot.end_time.split(':')
            start_mins = int(s_parts[0]) * 60 + int(s_parts[1])
            end_mins = int(e_parts[0]) * 60 + int(e_parts[1])
            if end_mins <= start_mins:
                warnings.append(f"Skipped '{slot.task_title}': end time must be after start time.")
                continue

            start_dt_str = f"{slot.date}T{slot.start_time}:00"
            end_dt_str = f"{slot.date}T{slot.end_time}:00"
            start_dt = dt.fromisoformat(start_dt_str)
            end_dt = dt.fromisoformat(end_dt_str)

            if slot.task_id not in task_slots:
                task_slots[slot.task_id] = {
                    "title": slot.task_title,
                    "start": start_dt,
                    "end": end_dt,
                    "date": slot.date,
                }
            else:
                existing = task_slots[slot.task_id]
                # Only merge if same day and contiguous (end of existing == start of new, within 15min buffer)
                if slot.date == existing["date"] and abs((start_dt - existing["end"]).total_seconds()) <= 900:
                    existing["end"] = max(existing["end"], end_dt)
                # else: keep the earlier slot (first one wins), skip this block

        for task_id, slot_info in task_slots.items():
            task = db.query(Todo).filter(
                Todo.id == task_id,
                Todo.user_id == user_id,
            ).first()

            if not task:
                warnings.append(f"Task '{slot_info['title']}' (ID {task_id}) not found.")
                continue

            # Guard: skip tasks already pushed to Google Calendar (would orphan the event)
            if task.scheduled_calendar_event_id:
                warnings.append(f"Skipped '{slot_info['title']}': already pushed to Google Calendar. Remove from calendar first.")
                continue

            task.is_scheduled = True
            task.scheduled_start = slot_info["start"]
            task.scheduled_end = slot_info["end"]
            task.scheduled_calendar_event_id = None
            accepted += 1

        db.commit()

        return TaskScheduleAcceptResponse(
            success=True,
            accepted_count=accepted,
            warnings=warnings,
        )

    except Exception as e:
        db.rollback()
        logger.error(f"Task schedule accept failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/schedule/unaccept")
async def schedule_tasks_unaccept(
    request: TaskScheduleUnacceptRequest,
    db: Session = Depends(get_db)
):
    """
    Unaccept step — clear local scheduling for a task (no Google Calendar involved).

    Resets is_scheduled=False and clears scheduled_start/end.
    Only works for tasks that haven't been pushed to Google Calendar yet.
    """
    try:
        user_id = request.user_id
        task_id = request.task_id

        task = db.query(Todo).filter(
            Todo.id == task_id,
            Todo.user_id == user_id,
        ).first()

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")

        if task.scheduled_calendar_event_id:
            raise HTTPException(
                status_code=400,
                detail="Task has been pushed to Google Calendar. Use the remove endpoint instead."
            )

        task.is_scheduled = False
        task.scheduled_start = None
        task.scheduled_end = None
        task.scheduled_calendar_event_id = None
        db.commit()

        return {"status": "success", "message": "Task unscheduled locally"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Task unaccept failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/tasks/scheduled-events")
async def get_scheduled_events(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Get locally-scheduled tasks for calendar display.

    Returns tasks where is_scheduled=True, in a calendar-event-like format.
    Frontend merges these with Google Calendar events on the calendar view.
    """
    try:
        tasks = db.query(Todo).filter(
            Todo.user_id == user_id,
            Todo.is_scheduled == True,
            Todo.status != "done",
        ).all()

        events = []
        for t in tasks:
            if not t.scheduled_start or not t.scheduled_end:
                continue
            events.append(ScheduledTaskEvent(
                task_id=t.id,
                title=t.title,
                date=t.scheduled_start.strftime("%Y-%m-%d"),
                start_time=t.scheduled_start.strftime("%H:%M"),
                end_time=t.scheduled_end.strftime("%H:%M"),
                priority=t.priority or "medium",
                has_calendar_event=bool(t.scheduled_calendar_event_id),
            ))

        return {"scheduled_events": events}

    except Exception as e:
        logger.error(f"Failed to get scheduled events: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/schedule/confirm", response_model=TaskScheduleResponse)
async def schedule_tasks_confirm(
    request: TaskSchedulePushRequest,
    db: Session = Depends(get_db)
):
    """
    Push step — creates Google Calendar events for accepted (locally-scheduled) tasks.

    Reads slot times from DB (is_scheduled=True, scheduled_calendar_event_id IS NULL).
    Requires account_id for Google Calendar. After creating events, updates
    scheduled_calendar_event_id in DB.
    """
    from backend.models.oauth_token import OAuthToken

    try:
        user_id = request.user_id

        # 1. Get OAuth token
        token = db.query(OAuthToken).filter(
            OAuthToken.id == request.account_id,
            OAuthToken.user_id == user_id,
            OAuthToken.provider == "google",
            OAuthToken.is_revoked == 0
        ).first()

        if not token:
            raise HTTPException(status_code=404, detail="Google account not found or has been revoked.")

        await refresh_token_if_expired(token, db)

        # 2. Build calendar service and get timezone
        credentials = google_oauth_service.get_credentials(
            token.get_access_token(),
            token.get_refresh_token()
        )
        calendar_service = CalendarService(credentials)

        from zoneinfo import ZoneInfo
        user_timezone = None
        if request.user_timezone:
            try:
                ZoneInfo(request.user_timezone)
                user_timezone = request.user_timezone
            except (KeyError, Exception):
                logger.warning(f"Invalid browser timezone '{request.user_timezone}', falling back to Google Calendar")
        if not user_timezone:
            try:
                cal_meta = await asyncio.to_thread(
                    calendar_service.service.calendars().get(calendarId="primary").execute
                )
                user_timezone = cal_meta.get("timeZone", "UTC")
            except Exception as tz_err:
                logger.warning(f"Could not fetch calendar timezone, defaulting to UTC: {tz_err}")
                user_timezone = "UTC"

        # 3. Fetch accepted tasks from DB
        tasks = db.query(Todo).filter(
            Todo.id.in_(request.task_ids),
            Todo.user_id == user_id,
            Todo.is_scheduled == True,
            Todo.scheduled_calendar_event_id == None,
        ).all()

        if not tasks:
            return TaskScheduleResponse(
                success=True,
                scheduled_events=[],
                skipped_tasks=[],
                warnings=["No accepted tasks found to push."],
            )

        # 4. Create Google Calendar events for each task
        scheduled_events = []
        warnings = []

        for task in tasks:
            start_dt = task.scheduled_start.strftime("%Y-%m-%dT%H:%M:%S")
            end_dt = task.scheduled_end.strftime("%Y-%m-%dT%H:%M:%S")
            slot_minutes = int((task.scheduled_end - task.scheduled_start).total_seconds() / 60)

            try:
                event = await asyncio.to_thread(
                    calendar_service.create_event,
                    summary=f"[Task-{task.id}] {task.title}",
                    start=start_dt,
                    end=end_dt,
                    description=(
                        f"Scheduled by Task Scheduler\n"
                        f"Priority: {task.priority or 'medium'}\n"
                        f"Estimated: {slot_minutes} min"
                    ),
                    timezone=user_timezone,
                )

                event_id = event.get("id", "")
                scheduled_events.append(ScheduledEventResult(
                    task_id=task.id,
                    task_title=task.title,
                    calendar_event_id=event_id,
                    start=start_dt,
                    end=end_dt,
                    estimated_minutes=slot_minutes,
                ))

                # Update calendar event ID in DB immediately
                task.scheduled_calendar_event_id = event_id

            except Exception as e:
                logger.error(f"Failed to create calendar event for task {task.id}: {e}")
                warnings.append(f"Failed to create event for '{task.title}': {str(e)}")

        # 5. Commit calendar event IDs
        try:
            db.commit()
        except Exception as commit_err:
            logger.warning(f"Failed to save calendar event IDs: {commit_err}")
            db.rollback()

        return TaskScheduleResponse(
            success=True,
            scheduled_events=scheduled_events,
            skipped_tasks=[],
            warnings=warnings,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Task scheduling push failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/schedule/remove")
async def remove_scheduled_event(
    request: TaskUnscheduleRequest,
    db: Session = Depends(get_db)
):
    """Remove an AI-scheduled event from Google Calendar and reset the task as unscheduled."""
    user_id = request.user_id

    token = db.query(OAuthToken).filter(
        OAuthToken.id == request.account_id,
        OAuthToken.user_id == user_id,
        OAuthToken.provider == "google",
        OAuthToken.is_revoked == 0
    ).first()

    if not token:
        raise HTTPException(status_code=404, detail="Account not found")

    try:
        # 1. Try to delete the Google Calendar event (best-effort)
        calendar_deleted = False
        try:
            access_token = await refresh_token_if_expired(token, db)
            credentials = google_oauth_service.get_credentials(
                access_token,
                token.get_refresh_token()
            )
            calendar_service = CalendarService(credentials)
            calendar_deleted = await asyncio.to_thread(calendar_service.delete_event, request.calendar_event_id)
        except Exception as cal_err:
            logger.warning(f"Could not delete calendar event {request.calendar_event_id}: {cal_err}")

        # 2. Always reset scheduling fields on the task (regardless of calendar deletion result)
        db.query(Todo).filter(
            Todo.id == request.task_id,
            Todo.user_id == user_id,
        ).update({
            Todo.is_scheduled: False,
            Todo.scheduled_start: None,
            Todo.scheduled_end: None,
            Todo.scheduled_calendar_event_id: None,
        }, synchronize_session="fetch")
        db.commit()

        msg = "Scheduled event removed and task reset"
        if not calendar_deleted:
            msg += " (Google Calendar event could not be deleted — you may need to remove it manually)"
        return {"status": "success", "message": msg}

    except Exception as e:
        db.rollback()
        logger.error(f"Error removing scheduled event: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/tasks/apply-priorities", response_model=ApplyPrioritiesResponse)
async def apply_priorities(
    request: ApplyPrioritiesRequest,
    db: Session = Depends(get_db)
):
    """
    Apply AI-suggested priorities to tasks.

    Updates task priority and estimated duration fields based on AI suggestions.
    Supports both regular todos and extracted/triage tasks.
    """
    from sqlalchemy import update as sa_update

    try:
        user_id = request.user_id
        updated_count = 0
        updated_todo_ids = []

        for update in request.updates:
            if update.task_type == "todo":
                # Update regular todo
                todo = db.query(Todo).filter(
                    Todo.id == update.task_id,
                    Todo.user_id == user_id
                ).first()

                if todo:
                    todo.priority = update.priority
                    if update.estimated_minutes is not None:
                        todo.ai_estimated_minutes = update.estimated_minutes
                    updated_todo_ids.append(todo.id)
                    updated_count += 1

            elif update.task_type == "extracted":
                # Update extracted task
                extracted_task = db.query(ExtractedTaskModel).filter(
                    ExtractedTaskModel.id == update.task_id,
                    ExtractedTaskModel.user_id == user_id
                ).first()

                if extracted_task:
                    extracted_task.priority = update.priority
                    updated_count += 1

        # Flush ORM changes (triggers onupdate for updated_at)
        db.flush()

        # Set ai_last_analyzed via raw SQL to avoid re-triggering onupdate,
        # ensuring ai_last_analyzed >= updated_at for cache validity
        if updated_todo_ids:
            now = datetime.now(timezone.utc)
            db.execute(
                sa_update(Todo)
                .where(Todo.id.in_(updated_todo_ids), Todo.user_id == user_id)
                .values(ai_last_analyzed=now)
            )

        db.commit()

        return ApplyPrioritiesResponse(
            success=True,
            updated_count=updated_count
        )

    except Exception as e:
        logger.error(f"Failed to apply priorities: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/todos/reorder")
async def reorder_todos(
    request: ReorderRequest,
    db: Session = Depends(get_db)
):
    """
    Save manual task reordering from drag-and-drop.
    """
    from sqlalchemy import update as sa_update

    try:
        # Build update map
        order_map = {item.task_id: item.suggested_order for item in request.order}

        # Update ai_suggested_order for each todo
        todos = db.query(Todo).filter(
            Todo.user_id == request.user_id,
            Todo.id.in_(order_map.keys())
        ).all()

        for todo in todos:
            new_order = order_map.get(todo.id)
            if new_order is not None:
                todo.ai_suggested_order = new_order

        # Flush ORM changes (triggers onupdate for updated_at)
        db.flush()

        # Update ai_last_analyzed via raw SQL to keep cache valid
        now = datetime.now(timezone.utc)
        todo_ids = list(order_map.keys())
        if todo_ids:
            db.execute(
                sa_update(Todo)
                .where(Todo.id.in_(todo_ids), Todo.user_id == request.user_id)
                .values(ai_last_analyzed=now)
            )

        db.commit()

        return {"success": True, "updated_count": len(todos)}

    except Exception as e:
        logger.error(f"Failed to reorder todos: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))