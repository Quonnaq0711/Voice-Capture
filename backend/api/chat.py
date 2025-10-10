from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List

from backend.models import schemas
from backend.models.chat import ChatMessage
from backend.models.user import User
from backend.utils.auth import get_current_user
from backend.db.database import get_db

router = APIRouter()

@router.post("/messages", response_model=schemas.ChatMessage)
async def create_chat_message(
    message: schemas.ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    session_id = message.session_id
    if session_id is None:
        # If no session_id is provided, use the active session
        active_session = db.query(ChatSession).filter(
            ChatSession.user_id == current_user.id, 
            ChatSession.is_active == True
        ).first()
        if active_session:
            session_id = active_session.id
        else:
            # If no active session, create a new one
            session_name = message.message_text[:50] if message.message_text else "New Session"
            new_session = ChatSession(
                user_id=current_user.id,
                session_name=session_name,
                first_message_time=datetime.utcnow(),
                is_active=True,
                unread=False
            )
            db.add(new_session)
            db.commit()
            db.refresh(new_session)
            session_id = new_session.id
    """Create a new chat message"""
    db_message = ChatMessage(
        user_id=current_user.id,
        message_text=message.message_text,
        sender=message.sender,
        session_id=session_id,
        agent_type=message.agent_type or 'dashboard'
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

@router.put("/messages/{message_id}", response_model=schemas.ChatMessage)
async def update_chat_message(
    message_id: int,
    message: schemas.ChatMessageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a specific chat message"""
    db_message = db.query(ChatMessage).filter(
        ChatMessage.id == message_id,
        ChatMessage.user_id == current_user.id
    ).first()
    
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db_message.message_text = message.message_text
    db.commit()
    db.refresh(db_message)
    return db_message

@router.delete("/messages/after/{message_index}")
async def delete_messages_after_index(
    message_index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete all messages after a specific index in the current session"""
    # Get active session
    active_session = db.execute(
        text("SELECT id FROM chat_sessions WHERE user_id = :user_id AND is_active = 1"),
        {"user_id": current_user.id}
    ).fetchone()
    
    session_id = None
    if active_session:
        session_id = active_session[0]
    
    # Get all messages for the session, ordered by creation time
    query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)
    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)
    else:
        query = query.filter(ChatMessage.session_id.is_(None))
    
    messages = query.order_by(ChatMessage.created_at.asc()).all()
    
    # Delete messages after the specified index
    if message_index < len(messages):
        messages_to_delete = messages[message_index + 1:]
        for msg in messages_to_delete:
            db.delete(msg)
        db.commit()
        return {"message": f"Deleted {len(messages_to_delete)} messages after index {message_index}"}
    
    return {"message": "No messages to delete"}

@router.delete("/messages")
async def clear_chat_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all chat history for the current user"""
    db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Chat history cleared successfully"}
