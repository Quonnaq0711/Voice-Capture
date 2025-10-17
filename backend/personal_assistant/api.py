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
from backend.personal_assistant.chat_service_factory import get_chat_service
from backend.personal_assistant.base_chat_service import BaseChatService
from backend.db.database import get_db
from backend.utils.auth import get_current_user_from_query
from backend.models.user import User
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

class OptimizeQueryRequest(BaseModel):
    """Request model for query optimization."""
    query: str
    
    class Config:
        schema_extra = {
            "example": {
                "query": "help me with my career"
            }
        }

class OptimizeQueryResponse(BaseModel):
    """Response model for query optimization."""
    original_query: str
    optimized_query: str
    model: str
    status: str
    error: Optional[str] = None
    
    class Config:
        schema_extra = {
            "example": {
                "original_query": "help me with my career",
                "optimized_query": "I would like guidance on career development opportunities and strategies to advance in my professional field.",
                "model": "gemma3:latest",
                "status": "success"
            }
        }

@router.post("/message", response_model=ChatResponse)
async def send_message(
    chat_request: ChatRequest,
    request: Request,
    chat_service: BaseChatService = Depends(get_chat_service),
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI assistant and get a response.

    Internal service - called by Backend API which handles user authentication.
    Trusts Backend to validate user permissions.

    Args:
        chat_request: Chat request containing the user message and user_id
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
    chat_service: BaseChatService = Depends(get_chat_service)
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
    chat_service: BaseChatService = Depends(get_chat_service)
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
    chat_service: BaseChatService = Depends(get_chat_service)
):
    """
    Clear the conversation memory for a specific session.

    Internal service - called by Backend API which handles authentication.

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
    chat_service: BaseChatService = Depends(get_chat_service)
):
    """
    Get the current conversation history for a specific session.

    Internal service - called by Backend API which handles authentication.

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
    chat_service: BaseChatService = Depends(get_chat_service)
):
    """
    Remove all messages after a specific index in the conversation history.

    Internal service - called by Backend API which handles authentication.

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
    chat_service: BaseChatService = Depends(get_chat_service)
):
    """
    Update a specific message in the conversation history.

    Internal service - called by Backend API which handles authentication.

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
        "base_url": "http://ollama-staging:11434",
        "description": "Local Ollama LLM instance",
        "capabilities": [
            "text_generation",
            "conversation",
            "question_answering"
        ]
    }

@router.post("/optimize", response_model=OptimizeQueryResponse)
async def optimize_query(
    optimize_request: OptimizeQueryRequest,
    request: Request,
    chat_service: BaseChatService = Depends(get_chat_service)
):
    """
    Optimize a user query to make it clearer and more structured.

    Internal service - called by Backend API which handles authentication.

    Args:
        optimize_request: Request containing the query to optimize
        request: FastAPI request object for client disconnect detection
        chat_service: Injected chat service instance

    Returns:
        Optimized query response

    Raises:
        HTTPException: If query optimization fails
    """
    try:
        if not optimize_request.query.strip():
            raise HTTPException(status_code=400, detail="Query cannot be empty")
        
        logger.info(f"Optimizing query: {optimize_request.query[:50]}...")
        
        # Create cancellation event for client disconnect detection
        cancellation_event = asyncio.Event()
        
        # Create a background task to monitor client disconnect
        async def monitor_disconnect():
            try:
                while not cancellation_event.is_set():
                    if await request.is_disconnected():
                        logger.info("Client disconnected during query optimization")
                        cancellation_event.set()
                        break
                    await asyncio.sleep(0.1)
            except Exception as e:
                logger.error(f"Error monitoring client disconnect: {e}")
                cancellation_event.set()
        
        # Start monitoring task
        monitor_task = asyncio.create_task(monitor_disconnect())
        
        try:
            # Optimize the query
            result = await chat_service.optimize_query(
                user_query=optimize_request.query,
                cancellation_event=cancellation_event
            )
            
            logger.info(f"Query optimization completed successfully")
            return OptimizeQueryResponse(**result)
            
        except asyncio.CancelledError:
            logger.info("Query optimization was cancelled")
            raise HTTPException(status_code=499, detail="Request cancelled by client")
        except Exception as e:
            logger.error(f"Error during query optimization: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Query optimization failed: {str(e)}")
        finally:
            # Clean up monitoring task
            if not monitor_task.done():
                monitor_task.cancel()
                try:
                    await monitor_task
                except asyncio.CancelledError:
                    pass
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in optimize_query endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/message/stream")
async def send_message_stream(
    message: str = Query(..., description="Message to send to the AI"),
    session_id: Optional[str] = Query(None, description="Session ID"),
    user_id: Optional[int] = Query(None, description="User ID for profile context"),
    current_user: User = Depends(get_current_user_from_query),
    chat_service: BaseChatService = Depends(get_chat_service),
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI and get a streaming response using Server-Sent Events.

    Requires authentication via query parameter (EventSource limitation).

    Args:
        message: Message to send to the AI
        session_id: Optional session ID (defaults to "default")
        current_user: Authenticated user (from token query parameter)
        chat_service: Injected chat service instance
        db: Database session

    Returns:
        Streaming response with AI-generated content

    Security:
        - JWT authentication required via ?token=<jwt_token> query parameter
        - User profile context automatically loaded from authenticated user
        - Token in URL is less secure but necessary for EventSource API

    Note:
        Frontend should append token to URL:
        /api/chat/message/stream?message=hello&token=<jwt_token>
    """
    try:
        if not message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        logger.info(f"Received streaming message from user {current_user.id}: {message[:50]}...")

        # Use default session if none provided
        if session_id is None:
            session_id = "default"

        # Use authenticated user's ID for profile context
        user_id = current_user.id

        async def event_generator():
            try:
                # Generate streaming response using the chat service with user profile context
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
        error_message = str(e)  # Capture error message in local variable
        logger.error(f"Error in streaming endpoint: {error_message}")

        async def error_generator():
            error_chunk = {
                "type": "error",
                "content": f"Error: {error_message}"
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
