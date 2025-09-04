from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from chat_service import get_chat_service, ChatService
from resume_analyzer import ResumeAnalyzer
from sqlalchemy.orm import Session
import sys
import os

# Add project root to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from backend.db.database import get_db

router = APIRouter(prefix="/api/chat", tags=["career-chat"])

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = "default_session"
    user_id: Optional[int] = None

class HealthResponse(BaseModel):
    status: str
    model: Optional[str] = None
    base_url: Optional[str] = None
    error: Optional[str] = None

class CareerInsightsResponse(BaseModel):
    success: bool
    professional_data: Optional[Dict[str, Any]] = None
    message: str
    has_data: bool = False

from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
import json
from fastapi import Request, Query

@router.post("/message")
async def send_message(
    chat_request: ChatRequest,
    chat_service: ChatService = Depends(get_chat_service),
    db: Session = Depends(get_db)
):
    if not chat_request.message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    try:
        result = await chat_service.generate_response(
            user_message=chat_request.message,
            session_id=chat_request.session_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/message/stream")
async def send_message_stream(
    message: str = Query(..., description="Message to send to the AI"),
    session_id: Optional[str] = Query(None, description="Session ID"),
    user_id: Optional[int] = Query(None, description="User ID for personalized responses"),
    request: Request = None,
    chat_service: ChatService = Depends(get_chat_service),
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI and get a streaming response using Server-Sent Events.
    """
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if session_id is None:
        session_id = "default"

    async def event_generator():
        try:
            async for chunk in chat_service.generate_streaming_response(
                user_message=message, 
                session_id=session_id, 
                user_id=user_id, 
                db=db
            ):
                yield {
                    "event": "message",
                    "data": json.dumps(chunk)
                }
                if chunk.get("type") in ["complete", "error"]:
                    break
        except Exception as e:
            yield {
                "event": "message",
                "data": json.dumps({"type": "error", "content": f"Error: {str(e)}"})
            }

    return EventSourceResponse(event_generator(), headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*"
    })

@router.get("/health", response_model=HealthResponse)
async def health_check(
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Check the health status of the career agent chat service.
    
    Returns:
        Health status information including basic service availability
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Lightweight health check - just verify service is available
        # Skip the actual Ollama model test for faster response
        logger.info("Health check: Performing lightweight service check...")
        
        # Check if chat service is properly initialized
        if hasattr(chat_service, 'model_name') and hasattr(chat_service, 'base_url'):
            result = HealthResponse(
                status="healthy",
                model=chat_service.model_name,
                base_url=chat_service.base_url
            )
            logger.info(f"Health check: Returning healthy status: {result}")
            return result
        else:
            result = HealthResponse(
                status="unhealthy",
                model="unknown",
                base_url="unknown",
                error="Chat service not properly initialized"
            )
            logger.warning(f"Health check: Returning unhealthy status: {result}")
            return result
            
    except Exception as e:
        result = HealthResponse(
            status="unhealthy",
            model=getattr(chat_service, 'model_name', 'unknown'),
            base_url=getattr(chat_service, 'base_url', 'unknown'),
            error=str(e)
        )
        logger.error(f"Health check: Exception occurred: {e}")
        logger.error(f"Health check: Returning error status: {result}")
        return result

@router.get("/health/deep", response_model=HealthResponse)
async def deep_health_check(
    chat_service: ChatService = Depends(get_chat_service)
):
    """
    Perform a deep health check that actually tests Ollama model connection.
    This is the original comprehensive health check for when detailed verification is needed.
    
    Returns:
        Detailed health status information including Ollama connection status
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Test with a simple prompt to verify Ollama connection
        logger.info("Deep health check: Testing Ollama connection...")
        test_response = await chat_service.generate_response("Hello", "health_check_session")
        logger.info(f"Deep health check: Test response received: {test_response}")
        
        if test_response and "response" in test_response:
            result = HealthResponse(
                status="healthy",
                model=chat_service.model_name,
                base_url=chat_service.base_url
            )
            logger.info(f"Deep health check: Returning healthy status: {result}")
            return result
        else:
            result = HealthResponse(
                status="unhealthy",
                model=chat_service.model_name,
                base_url=chat_service.base_url,
                error="Failed to get response from model"
            )
            logger.warning(f"Deep health check: Returning unhealthy status: {result}")
            return result
            
    except Exception as e:
        result = HealthResponse(
            status="unhealthy",
            model=getattr(chat_service, 'model_name', 'unknown'),
            base_url=getattr(chat_service, 'base_url', 'unknown'),
            error=str(e)
        )
        logger.error(f"Deep health check: Exception occurred: {e}")
        logger.error(f"Deep health check: Returning error status: {result}")
        return result

@router.get("/insights/{user_id}", response_model=CareerInsightsResponse)
async def get_career_insights(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Retrieve the most recent career insights for a specific user.
    
    Args:
        user_id: The ID of the user whose career insights to retrieve
        
    Returns:
        CareerInsightsResponse containing the professional data or error message
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Initialize resume analyzer to access career insights methods
        resume_analyzer = ResumeAnalyzer()
        
        # Get the latest career insight for the user
        logger.info(f"Retrieving career insights for user {user_id}")
        professional_data = await resume_analyzer.get_latest_career_insight(user_id)
        
        if professional_data:
            logger.info(f"Found career insights for user {user_id}")
            return CareerInsightsResponse(
                success=True,
                professional_data=professional_data,
                message="Career insights retrieved successfully",
                has_data=True
            )
        else:
            logger.info(f"No career insights found for user {user_id}")
            return CareerInsightsResponse(
                success=True,
                professional_data=None,
                message="No career insights found. Please perform a resume analysis first.",
                has_data=False
            )
            
    except Exception as e:
        logger.error(f"Error retrieving career insights for user {user_id}: {str(e)}")
        return CareerInsightsResponse(
            success=False,
            professional_data=None,
            message=f"Failed to retrieve career insights: {str(e)}",
            has_data=False
        )