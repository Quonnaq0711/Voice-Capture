from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, Dict, Any
from chat_service_factory import get_chat_service
from base_chat_service import BaseChatService
from resume_analyzer_factory import get_resume_analyzer
from base_resume_analyzer import BaseResumeAnalyzer
from sqlalchemy.orm import Session
import sys
import os

# Add project root to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))

from backend.db.database import get_db
from backend.utils.auth import get_current_user, get_current_user_from_query
from backend.config.cors_config import get_allowed_origins
from backend.models.user import User

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
    chat_service: BaseChatService = Depends(get_chat_service),
    db: Session = Depends(get_db)
):
    """
    Send a message to the career agent AI.

    Requires authentication. Users can only send messages for their own account.

    Security:
        - JWT authentication required
        - Authorization check: user can only message for themselves
    """
    if not chat_request.message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Authorization: validate user_id matches authenticated user
    if hasattr(chat_request, 'user_id') and chat_request.user_id:
        if chat_request.user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="Cannot send messages for other users"
            )

    # Ensure user_id is set to authenticated user
    chat_request.user_id = current_user.id

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
    current_user: User = Depends(get_current_user_from_query),
    request: Request = None,
    chat_service: BaseChatService = Depends(get_chat_service),
    db: Session = Depends(get_db)
):
    """
    Send a message to the AI and get a streaming response using Server-Sent Events.

    Requires authentication via query parameter (EventSource limitation).

    Security:
        - JWT authentication required via ?token=<jwt_token> query parameter
        - User ID from token (cannot specify other users)
        - Token in URL is less secure but necessary for EventSource API
        - CORS restricted to allowed origins only
        - Always use HTTPS in production

    Args:
        message: The message to send to the AI
        session_id: Optional session ID for conversation continuity
        current_user: Authenticated user (from token query parameter)
        request: Request object for CORS origin validation

    Returns:
        EventSourceResponse with streaming AI responses

    Raises:
        HTTPException: 403 if origin is not allowed

    Note:
        Frontend should append token to URL:
        /api/chat/message/stream?message=hello&token=<jwt_token>
    """
    if not message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # CORS validation: Check if request origin is allowed
    allowed_origins = get_allowed_origins()
    origin_header = request.headers.get("origin", "") if request else ""

    # For EventSource requests, origin header is always present
    if origin_header and origin_header not in allowed_origins:
        raise HTTPException(
            status_code=403,
            detail=f"Origin '{origin_header}' not allowed. CORS policy violation."
        )

    if session_id is None:
        session_id = "default"

    # Use authenticated user's ID (from JWT token in query params)
    user_id = current_user.id

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

    # Build secure CORS headers
    response_headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }

    # Only set CORS headers if origin is present and allowed
    if origin_header:
        response_headers["Access-Control-Allow-Origin"] = origin_header
        response_headers["Access-Control-Allow-Credentials"] = "true"

    return EventSourceResponse(event_generator(), headers=response_headers)

@router.get("/health", response_model=HealthResponse)
async def health_check(
    chat_service: BaseChatService = Depends(get_chat_service)
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
    chat_service: BaseChatService = Depends(get_chat_service)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve the most recent career insights for a specific user.
    Requires authentication and authorization - users can only access their own data.

    Args:
        user_id: The ID of the user whose career insights to retrieve
        current_user: Authenticated user (injected by FastAPI)

    Returns:
        CareerInsightsResponse containing the professional data or error message

    Raises:
        HTTPException 403: If user attempts to access another user's data
    """
    import logging
    logger = logging.getLogger(__name__)

    # Authorization check - users can only access their own data
    if current_user.id != user_id:
        logger.warning(
            f"Authorization denied: User {current_user.id} ({current_user.email}) "
            f"attempted to access user {user_id}'s career insights"
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access this user's career insights"
        )

    try:
        # Initialize resume analyzer using factory pattern
        # This automatically selects Ollama or vLLM based on LLM_PROVIDER
        resume_analyzer = get_resume_analyzer()

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

@router.get("/insights/resume/{resume_id}", response_model=CareerInsightsResponse)
async def get_career_insights_by_resume(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retrieve career insights for a specific resume.
    Requires authentication and authorization - users can only access their own resumes.

    Args:
        resume_id: The ID of the resume to get insights for
        current_user: Authenticated user (injected by FastAPI)

    Returns:
        CareerInsightsResponse containing the professional data or error message

    Raises:
        HTTPException 403: If user attempts to access another user's resume
        HTTPException 404: If resume not found or doesn't belong to user
    """
    import logging
    logger = logging.getLogger(__name__)

    try:
        # Initialize resume analyzer using factory pattern
        # This automatically selects Ollama or vLLM based on LLM_PROVIDER
        resume_analyzer = get_resume_analyzer()

        # Get career insight for the specific resume
        logger.info(f"Retrieving career insights for resume {resume_id}, user {current_user.id}")
        professional_data = await resume_analyzer.get_career_insight_by_resume(current_user.id, resume_id)

        if professional_data:
            logger.info(f"Found career insights for resume {resume_id}")
            return CareerInsightsResponse(
                success=True,
                professional_data=professional_data,
                message="Career insights retrieved successfully",
                has_data=True
            )
        else:
            logger.info(f"No career insights found for resume {resume_id}")
            return CareerInsightsResponse(
                success=True,
                professional_data=None,
                message="No career insights found for this resume. Please perform an analysis first.",
                has_data=False
            )

    except HTTPException:
        # Re-raise HTTP exceptions (404, 403)
        raise
    except Exception as e:
        logger.error(f"Error retrieving career insights for resume {resume_id}: {str(e)}")
        return CareerInsightsResponse(
            success=False,
            professional_data=None,
            message=f"Failed to retrieve career insights: {str(e)}",
            has_data=False
        )

@router.post("/internal/generate")
async def generate_internal(
    chat_request: ChatRequest,
    api_key: str = Query(None, alias="api_key"),
    chat_service: BaseChatService = Depends(get_chat_service)
):
    """
    Internal endpoint for generating AI responses without user authentication.

    Security:
        - Protected by internal API key (api_key query parameter)
        - Should ONLY be accessible from trusted internal services
        - Docker network isolation provides additional security layer
        - In production, use firewall rules to restrict access

    Used by:
        - RecommendationService for generating daily recommendations
        - Other internal backend services that need AI generation

    Args:
        chat_request: Message and optional session_id
        api_key: Internal API key for authentication (query parameter)

    Returns:
        AI-generated response

    Raises:
        HTTPException 403: If API key is invalid or missing
        HTTPException 400: If message is empty
    """
    import logging
    import os
    logger = logging.getLogger(__name__)

    # Verify internal API key
    internal_api_key = os.getenv("INTERNAL_API_KEY", "dev-internal-key-change-in-production")

    if not api_key or api_key != internal_api_key:
        logger.warning(f"Internal API call rejected: invalid or missing API key")
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing internal API key"
        )

    if not chat_request.message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        logger.info(f"Internal generate request: {chat_request.message[:100]}...")
        result = await chat_service.generate_response(
            user_message=chat_request.message,
            session_id=chat_request.session_id or "internal_session"
        )
        return result
    except Exception as e:
        logger.error(f"Error in internal generate: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))