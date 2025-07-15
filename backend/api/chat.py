from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from ..models import schemas
from ..models.chat import ChatMessage
from ..models.user import User
from ..utils.auth import get_current_user
from ..db.database import get_db

router = APIRouter()

@router.post("/messages", response_model=schemas.ChatMessage)
async def create_chat_message(
    message: schemas.ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new chat message"""
    # Get active session or create one if none exists
    active_session = db.execute(
        text("SELECT id FROM chat_sessions WHERE user_id = :user_id AND is_active = 1"),
        {"user_id": current_user.id}
    ).fetchone()
    
    session_id = None
    if active_session:
        session_id = active_session[0]
    
    db_message = ChatMessage(
        user_id=current_user.id,
        message_text=message.message_text,
        sender=message.sender,
        session_id=session_id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

@router.get("/messages", response_model=schemas.ChatHistoryResponse)
async def get_chat_history(
    session_id: int = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get chat history for the current user"""
    # If no session_id provided, get messages from active session
    if session_id is None:
        active_session = db.execute(
            text("SELECT id FROM chat_sessions WHERE user_id = :user_id AND is_active = 1"),
            {"user_id": current_user.id}
        ).fetchone()
        if active_session:
            session_id = active_session[0]
    
    # Build query based on session_id
    query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)
    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)
    else:
        # If no session, get messages without session_id (legacy messages)
        query = query.filter(ChatMessage.session_id.is_(None))
    
    # Get total count
    total_count = query.count()
    
    # Get messages with pagination, ordered by creation time
    messages = query.order_by(ChatMessage.created_at.asc()).offset(offset).limit(limit).all()
    
    return {
        "messages": messages,
        "total_count": total_count
    }

@router.delete("/messages")
async def clear_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all chat history for the current user"""
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Chat history cleared successfully"}