import sys
import os

# Add the project root directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging
import asyncio
import json
from sse_starlette.sse import EventSourceResponse
from .chat_service import get_chat_service, ChatService
from backend.db.database import get_db
from sqlalchemy.orm import Session

# Configure logging
logger = logging.getLogger(__name__)

# Create API router
router = APIRouter(prefix="/api/chat", tags=["chat"])

# Request/Response models
class ChatRequest(BaseModel):
    """Request model for chat messages"""
    message: str
    session_id: Optional[str] = None
    user_id: Optional[int] = None
    
    class Config:
        schema_extra = {
            "example": {
                "message": "Hello, how are you?",
                "session_id": "user123_session1",
                "user_id": 1
            }
        }

class ChatResponse(BaseModel):
    """Response model for chat messages."""
    response: str
    model: str
    session_id: Optional[str] = None
    status: str
    error: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "response": "Hello! I'm doing well, thank you for asking. How can I help you today?",
                "model": "gemma3:latest",
                "session_id": "user123_session1",
                "status": "success"
            }
        }

class HealthResponse(BaseModel):
    """Response model for health check."""
    status: str
    model: str
    base_url: str
    error: Optional[str] = None

class ConversationMessage(BaseModel):
    """Model for conversation history messages."""
    role: str  # "user" or "assistant"
    content: str

class ConversationHistoryResponse(BaseModel):
    """Response model for conversation history."""
    history: List[ConversationMessage]
    total_messages: int

@router.post("/message", response_model=ChatResponse)
async def send_message(
    chat_request: ChatRequest,
    request: Request,
    chat_service: ChatService = Depends(get_chat_service),
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI assistant and get a response.
    
    Args:
        chat_request: Chat request containing the user message
        request: FastAPI request object for client disconnect detection
        chat_service: Injected chat service instance
        
    Returns:
        AI-generated response
        
    Raises:
        HTTPException: If message processing fails
    """
    try:
        if not chat_request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
        
        logger.info(f"Processing chat message: {chat_request.message[:50]}...")
        
        # Create a cancellation token for this request
        cancellation_event = asyncio.Event()
        
        # Create a task to monitor client disconnect
        async def monitor_client_disconnect():
            try:
                while not cancellation_event.is_set():
                    if await request.is_disconnected():
                        logger.info("Client disconnected, cancelling request")
                        cancellation_event.set()
                        break
                    await asyncio.sleep(0.1)  # Check every 100ms
            except Exception as e:
                logger.error(f"Error monitoring client disconnect: {e}")
        
        # Start the monitoring task
        monitor_task = asyncio.create_task(monitor_client_disconnect())
        
        try:
            # Generate response using the chat service with cancellation support
            result = await chat_service.generate_response(
                user_message=chat_request.message,
                session_id=chat_request.session_id,
                user_id=chat_request.user_id,
                db=db,
                cancellation_event=cancellation_event
            )
            
            return ChatResponse(**result)
        finally:
            # Clean up the monitoring task
            monitor_task.cancel()
            try:
                await monitor_task
            except asyncio.CancelledError:
                pass
        
    except asyncio.CancelledError:
        logger.info("Request was cancelled by client")
        raise HTTPException(status_code=499, detail="Request cancelled")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing chat message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/health", response_model=HealthResponse)
async def health_check(
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Check the health status of the chat service.
    Lightweight check for faster response.
    
    Args:
        chat_service: Injected chat service instance
        
    Returns:
        Health status information
    """
    try:
        # Lightweight health check - just verify service is available
        # Skip the actual Ollama model test for faster response
        logger.info("Health check: Performing lightweight service check...")
        
        # Check if chat service is properly initialized
        if hasattr(chat_service, 'model_name') and hasattr(chat_service, 'base_url'):
            result = {
                "status": "healthy",
                "model": chat_service.model_name,
                "base_url": chat_service.base_url
            }
            logger.info(f"Health check: Returning healthy status: {result}")
            return HealthResponse(**result)
        else:
            result = {
                "status": "unhealthy",
                "model": "unknown",
                "base_url": "unknown",
                "error": "Chat service not properly initialized"
            }
            logger.warning(f"Health check: Returning unhealthy status: {result}")
            return HealthResponse(**result)
            
    except Exception as e:
        logger.error(f"Error during health check: {str(e)}")
        return HealthResponse(
            status="unhealthy",
            model="unknown",
            base_url="unknown",
            error=str(e)
        )

@router.get("/health/deep", response_model=HealthResponse)
async def deep_health_check(
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Perform a deep health check of the chat service.
    This includes testing the actual Ollama model connection.
    
    Args:
        chat_service: Injected chat service instance
        
    Returns:
        Comprehensive health status information
    """
    try:
        health_info = await chat_service.health_check()
        return HealthResponse(**health_info)
        
    except Exception as e:
        logger.error(f"Error during deep health check: {str(e)}")
        return HealthResponse(
            status="unhealthy",
            model="unknown",
            base_url="unknown",
            error=str(e)
        )

@router.delete("/memory")
async def clear_conversation_memory(
    session_id: Optional[str] = None,
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Clear the conversation memory for a specific session.
    
    Args:
        session_id: Optional session ID to clear (defaults to "default")
        chat_service: Injected chat service instance
        
    Returns:
        Success status
        
    Raises:
        HTTPException: If memory clearing fails
    """
    try:
        success = await chat_service.clear_memory(session_id or "default")
        
        if success:
            return {"message": f"Conversation memory cleared successfully for session: {session_id or 'default'}"}
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to clear conversation memory"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error clearing memory: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/history", response_model=ConversationHistoryResponse)
async def get_conversation_history(
    session_id: Optional[str] = None,
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Get the current conversation history for a specific session.
    
    Args:
        session_id: Optional session ID to get history for (defaults to "default")
        chat_service: Injected chat service instance
        
    Returns:
        Conversation history
        
    Raises:
        HTTPException: If history retrieval fails
    """
    try:
        history = await chat_service.get_conversation_history(session_id or "default")
        
        conversation_messages = [
            ConversationMessage(role=msg["role"], content=msg["content"])
            for msg in history
        ]
        
        return ConversationHistoryResponse(
            history=conversation_messages,
            total_messages=len(conversation_messages)
        )
        
    except Exception as e:
        logger.error(f"Error getting conversation history: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.delete("/history/after/{message_index}")
async def remove_messages_after_index(
    message_index: int,
    session_id: Optional[str] = None,
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Remove all messages after a specific index in the conversation history.
    
    Args:
        message_index: Index after which to remove messages (0-based)
        session_id: Optional session ID (defaults to "default")
        chat_service: Injected chat service instance
        
    Returns:
        Success status
        
    Raises:
        HTTPException: If message removal fails
    """
    try:
        success = await chat_service.remove_messages_after_index(
            session_id or "default", 
            message_index
        )
        
        if success:
            return {"message": f"Messages after index {message_index} removed successfully for session: {session_id or 'default'}"}
        else:
            raise HTTPException(
                status_code=500,
                detail="Failed to remove messages"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing messages: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.put("/history/{message_index}")
async def update_message_at_index(
    message_index: int,
    new_content: str = Query(..., description="New content for the message"),
    session_id: Optional[str] = Query(None, description="Session ID"),
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Update a specific message in the conversation history.
    
    Args:
        message_index: Index of the message to update (0-based)
        new_content: New content for the message
        session_id: Optional session ID (defaults to "default")
        chat_service: Injected chat service instance
        
    Returns:
        Success status
        
    Raises:
        HTTPException: If message update fails
    """
    try:
        if not new_content.strip():
            raise HTTPException(status_code=400, detail="New content cannot be empty")
            
        success = await chat_service.update_message_at_index(
            session_id or "default", 
            message_index, 
            new_content
        )
        
        if success:
            return {"message": f"Message at index {message_index} updated successfully for session: {session_id or 'default'}"}
        else:
            raise HTTPException(
                status_code=404,
                detail="Message not found or update failed"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/models")
async def get_available_models():
    """
    Get information about available models.
    
    Returns:
        Information about the current model configuration
    """
    return {
        "current_model": "gemma3:latest",
        "base_url": "http://localhost:11434",
        "description": "Local Ollama LLM instance",
        "capabilities": [
            "text_generation",
            "conversation",
            "question_answering"
        ]
    }

@router.get("/message/stream")
async def send_message_stream(
    message: str = Query(..., description="Message to send to the AI"),
    session_id: Optional[str] = Query(None, description="Session ID"),
    user_id: Optional[int] = Query(None, description="User ID for profile context"),
    chat_service: ChatService = Depends(get_chat_service),
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI and get a streaming response using Server-Sent Events
    
    Args:
        message: Message to send to the AI
        session_id: Optional session ID (defaults to "default")
        chat_service: Injected chat service instance
        
    Returns:
        Streaming response with AI-generated content
    """
    try:
        if not message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")
            
        logger.info(f"Received streaming message: {message[:50]}...")
        
        # Use default session if none provided
        if session_id is None:
            session_id = "default"
        
        async def event_generator():
            try:
                # Generate streaming response using the chat service
                async for chunk in chat_service.generate_streaming_response(message, session_id, user_id, db):
                    # Format the chunk as SSE data
                    chunk_json = json.dumps(chunk)
                    yield {
                        "event": "message",
                        "data": chunk_json
                    }
                    
                    # If this is the completion or error, we're done
                    if chunk.get("type") in ["complete", "error"]:
                        break
                        
            except Exception as e:
                logger.error(f"Error in event generator: {str(e)}")
                error_chunk = {
                    "type": "error",
                    "content": f"Error generating response: {str(e)}"
                }
                yield {
                    "event": "message",
                    "data": json.dumps(error_chunk)
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
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in streaming endpoint: {str(e)}")
        
        async def error_generator():
            error_chunk = {
                "type": "error",
                "content": f"Error: {str(e)}"
            }
            yield {
                "event": "message",
                "data": json.dumps(error_chunk)
            }
        
        return EventSourceResponse(
            error_generator(),
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*"
            }
        )