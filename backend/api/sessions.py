import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from datetime import datetime, timezone

from backend.db.database import get_db
from backend.models.user import User
from backend.models.chat import ChatMessage
from backend.utils.auth import get_current_user
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

class SessionResponse(BaseModel):
    id: int
    session_name: str
    first_message_time: datetime
    created_at: datetime
    is_active: bool
    message_count: int
    unread: bool

class CreateSessionRequest(BaseModel):
    session_name: str
    first_message_time: datetime

class SessionMessagesResponse(BaseModel):
    session_id: int
    messages: List[dict]

@router.post("/sessions", response_model=dict)
async def create_session(
    request: CreateSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new chat session

    Race condition protection: Database unique constraint ensures only one active session per user.
    The new session is created as active, and the constraint automatically ensures uniqueness.
    """
    try:
        # Atomic operation: Deactivate all sessions and create new active session
        # The unique index (idx_one_active_session_per_user) ensures only one session can be active
        db.execute(
            text("UPDATE chat_sessions SET is_active = FALSE WHERE user_id = :user_id"),
            {"user_id": current_user.id}
        )

        # Create new session as active
        cursor = db.execute(
            text("""
            INSERT INTO chat_sessions (user_id, session_name, first_message_time, created_at, is_active, unread)
            VALUES (:user_id, :session_name, :first_message_time, :created_at, TRUE, FALSE)
            """),
            {
                "user_id": current_user.id,
                "session_name": request.session_name,
                "first_message_time": request.first_message_time,
                "created_at": datetime.now(timezone.utc)
            }
        )

        session_id = cursor.lastrowid
        db.commit()

        return {
            "session_id": session_id,
            "message": "Session created successfully"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create session: {str(e)}"
        )

@router.get("/sessions", response_model=List[SessionResponse])
async def get_user_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all chat sessions for the current user
    """
    try:
        cursor = db.execute(
            text("""
            SELECT 
                s.id,
                s.session_name,
                s.first_message_time,
                s.created_at,
                s.is_active,
                s.unread,
                COUNT(m.id) as message_count
            FROM chat_sessions s
            LEFT JOIN chat_messages m ON s.id = m.session_id
            WHERE s.user_id = :user_id
            GROUP BY s.id
            ORDER BY s.created_at DESC
            """),
            {"user_id": current_user.id}
        )
        
        sessions = []
        for row in cursor.fetchall():
            sessions.append({
                "id": row[0],
                "session_name": row[1],
                "first_message_time": row[2],
                "created_at": row[3],
                "is_active": bool(row[4]),
                "unread": bool(row[5]),
                "message_count": row[6]
            })
        
        # Mark the active session as read
        active_session = next((s for s in sessions if s['is_active']), None)
        if active_session:
            try:
                db.execute(
                    text("UPDATE chat_sessions SET unread = FALSE WHERE id = :session_id"),
                    {"session_id": active_session['id']}
                )
                db.commit()
                active_session['unread'] = False
            except Exception as e:
                db.rollback()
                # Don't fail the entire request if marking as read fails, but log it
                logger.warning(f"Failed to mark session {active_session['id']} as read: {str(e)}")

        return sessions

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get sessions: {str(e)}"
        )

@router.put("/sessions/{session_id}/read")
async def mark_session_as_read(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a specific session as read (unread = false)
    """
    try:
        # Verify session belongs to current user
        session_check = db.execute(
            text("SELECT id FROM chat_sessions WHERE id = :session_id AND user_id = :user_id"),
            {"session_id": session_id, "user_id": current_user.id}
        ).fetchone()
        
        if not session_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Mark session as read
        db.execute(
            text("UPDATE chat_sessions SET unread = FALSE WHERE id = :session_id"),
            {"session_id": session_id}
        )
        db.commit()
        
        return {"message": "Session marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark session as read: {str(e)}"
        )

@router.put("/sessions/{session_id}/unread")
async def mark_session_as_unread(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Mark a specific session as unread (unread = true)
    """
    try:
        # Verify session belongs to current user
        session_check = db.execute(
            text("SELECT id FROM chat_sessions WHERE id = :session_id AND user_id = :user_id"),
            {"session_id": session_id, "user_id": current_user.id}
        ).fetchone()
        
        if not session_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Mark session as unread
        db.execute(
            text("UPDATE chat_sessions SET unread = TRUE WHERE id = :session_id"),
            {"session_id": session_id}
        )
        db.commit()
        
        return {"message": "Session marked as unread"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark session as unread: {str(e)}"
        )

@router.get("/sessions/{session_id}/messages", response_model=SessionMessagesResponse)
async def get_session_messages(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all messages for a specific session
    """
    try:
        # Verify session belongs to current user
        session_check = db.execute(
            text("SELECT id FROM chat_sessions WHERE id = :session_id AND user_id = :user_id"),
            {"session_id": session_id, "user_id": current_user.id}
        ).fetchone()
        
        if not session_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Get messages for this session
        cursor = db.execute(
            text("""
            SELECT id, message_text, sender, created_at, agent_type
            FROM chat_messages
            WHERE session_id = :session_id
            ORDER BY created_at ASC
            """),
            {"session_id": session_id}
        )
        
        messages = []
        for row in cursor.fetchall():
            messages.append({
                "id": row[0],
                "message_text": row[1],
                "sender": row[2],
                "created_at": row[3],
                "agent_type": row[4]
            })
        
        return {
            "session_id": session_id,
            "messages": messages
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get session messages: {str(e)}"
        )

@router.put("/sessions/{session_id}/activate")
async def activate_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Activate a specific session (deactivate others)

    Race condition protection: Database unique constraint ensures only one active session per user.
    If concurrent requests try to activate different sessions, the database will enforce the constraint.
    """
    try:
        # Verify session belongs to current user
        session_check = db.execute(
            text("SELECT id FROM chat_sessions WHERE id = :session_id AND user_id = :user_id"),
            {"session_id": session_id, "user_id": current_user.id}
        ).fetchone()

        if not session_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )

        # Atomic operation: Deactivate all sessions and activate the target in one transaction
        # The unique index (idx_one_active_session_per_user) ensures only one session can be active
        db.execute(
            text("UPDATE chat_sessions SET is_active = FALSE WHERE user_id = :user_id"),
            {"user_id": current_user.id}
        )

        db.execute(
            text("UPDATE chat_sessions SET is_active = TRUE WHERE id = :session_id"),
            {"session_id": session_id}
        )

        db.commit()

        return {"message": "Session activated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate session: {str(e)}"
        )

class UpdateSessionRequest(BaseModel):
    session_name: str

@router.put("/sessions/{session_id}/name")
async def update_session_name(
    session_id: int,
    request: UpdateSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update the name of a specific session
    """
    try:
        # Verify session belongs to current user
        session_check = db.execute(
            text("SELECT id FROM chat_sessions WHERE id = :session_id AND user_id = :user_id"),
            {"session_id": session_id, "user_id": current_user.id}
        ).fetchone()
        
        if not session_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Update session name
        db.execute(
            text("UPDATE chat_sessions SET session_name = :session_name WHERE id = :session_id"),
            {"session_name": request.session_name, "session_id": session_id}
        )
        
        db.commit()
        
        return {"message": "Session name updated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update session name: {str(e)}"
        )

@router.get("/sessions/active")
async def get_active_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the currently active session for the user
    """
    try:
        cursor = db.execute(
            text("""
            SELECT id, session_name, first_message_time, created_at
            FROM chat_sessions
            WHERE user_id = :user_id AND is_active = TRUE
            """),
            {"user_id": current_user.id}
        )
        
        session = cursor.fetchone()
        if session:
            return {
                "id": session[0],
                "session_name": session[1],
                "first_message_time": session[2],
                "created_at": session[3]
            }
        else:
            return None
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get active session: {str(e)}"
        )

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific session and all its messages
    """
    try:
        # Verify session belongs to current user
        session_check = db.execute(
            text("SELECT id FROM chat_sessions WHERE id = :session_id AND user_id = :user_id"),
            {"session_id": session_id, "user_id": current_user.id}
        ).fetchone()
        
        if not session_check:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found"
            )
        
        # Delete all messages for this session first
        db.execute(
            text("DELETE FROM chat_messages WHERE session_id = :session_id"),
            {"session_id": session_id}
        )
        
        # Delete the session
        db.execute(
            text("DELETE FROM chat_sessions WHERE id = :session_id"),
            {"session_id": session_id}
        )
        
        db.commit()
        
        return {"message": "Session deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete session: {str(e)}"
        )

@router.get("/sessions/unread/count")
async def get_unread_sessions_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the count of unread chat sessions for the current user
    """
    try:
        result = db.execute(
            text("""
                SELECT COUNT(*) as unread_count
                FROM chat_sessions
                WHERE user_id = :user_id AND unread = TRUE
            """),
            {"user_id": current_user.id}
        )
        
        count = result.fetchone()[0]
        return {"unread_count": count}
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get unread sessions count: {str(e)}"
        )
