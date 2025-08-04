from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import json
import asyncio
from datetime import datetime

from streaming_analyzer import StreamingResumeAnalyzer, ProgressNotificationService
from resume_analyzer import ResumeAnalyzer

router = APIRouter()
notification_service = ProgressNotificationService()

class AnalysisRequest(BaseModel):
    user_id: str
    session_id: Optional[str] = None
    force_reanalysis: bool = False

class AnalysisResponse(BaseModel):
    success: bool
    message: str
    session_id: Optional[str] = None
    error: Optional[str] = None

@router.post("/analyze/stream", response_model=AnalysisResponse)
async def start_streaming_analysis(
    request: AnalysisRequest,
    background_tasks: BackgroundTasks
):
    """
    Start a streaming resume analysis workflow.
    Returns immediately with a session ID for tracking progress.
    """
    try:
        # Generate session ID if not provided
        session_id = request.session_id or f"analysis_{request.user_id}_{int(datetime.now().timestamp())}"
        
        # Initialize streaming analyzer with notification service URL
        notification_service_url = "http://localhost:8001"  # Personal assistant service URL
        streaming_analyzer = StreamingResumeAnalyzer(notification_service_url=notification_service_url)
        
        # Register session for progress notifications
        notification_service.register_session(session_id, request.user_id)
        
        # Start analysis in background
        background_tasks.add_task(
            run_streaming_analysis,
            streaming_analyzer,
            request.user_id,
            session_id,
            request.force_reanalysis
        )
        
        return AnalysisResponse(
            success=True,
            message="Analysis started successfully",
            session_id=session_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start analysis: {str(e)}")

async def run_streaming_analysis(
    analyzer: StreamingResumeAnalyzer,
    user_id: str,
    session_id: str,
    force_reanalysis: bool = False
):
    """
    Background task to run the streaming analysis workflow.
    """
    try:
        # Set up progress callback
        def progress_callback(section: str, status: str, data: Optional[Dict[str, Any]] = None, error: Optional[str] = None):
            notification_service.update_progress(
                session_id=session_id,
                section=section,
                status=status,
                data=data,
                error=error
            )
        
        # Run the streaming analysis (consume the async generator)
        async for result in analyzer.analyze_resume_streaming(user_id=int(user_id)):
            # Update progress through notification service
            if result.get("type") == "progress":
                progress_data = result.get("data", {})
                progress_callback(
                    section=progress_data.get("current_section", "unknown"),
                    status="analyzing",
                    data=progress_data
                )
            elif result.get("type") == "section_complete":
                section_data = result.get("data", {})
                section_name = result.get("section", "unknown")
                progress_callback(
                    section=section_name,
                    status="completed",
                    data=section_data
                )
            elif result.get("type") == "error":
                progress_callback(
                    section="unknown",
                    status="error",
                    error=result.get("message", "Unknown error")
                )
                break
        
        # Notify completion
        notification_service.complete_analysis(session_id, success=True)
        
    except Exception as e:
        # Notify error
        notification_service.complete_analysis(
            session_id, 
            success=False, 
            error=str(e)
        )
    finally:
        # Clean up session after delay
        await asyncio.sleep(300)  # Keep session for 5 minutes
        notification_service.cleanup_session(session_id)

@router.get("/analyze/progress/{session_id}")
async def get_analysis_progress(session_id: str):
    """
    Get the current progress of an analysis session.
    """
    try:
        progress = notification_service.get_progress(session_id)
        if progress is None:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return progress
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get progress: {str(e)}")

@router.get("/analyze/stream/{session_id}")
async def stream_analysis_updates(session_id: str):
    """
    Server-Sent Events endpoint for real-time analysis updates.
    """
    async def event_generator():
        try:
            # Check if session exists
            if not notification_service.session_exists(session_id):
                yield f"data: {json.dumps({'error': 'Session not found'})}\n\n"
                return
            
            # Send initial connection confirmation
            yield f"data: {json.dumps({'type': 'connected', 'session_id': session_id})}\n\n"
            
            # Stream updates
            async for update in notification_service.stream_updates(session_id):
                yield f"data: {json.dumps(update)}\n\n"
                
                # Break if analysis is complete
                if update.get('type') == 'complete':
                    break
                    
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@router.delete("/analyze/session/{session_id}")
async def cancel_analysis(session_id: str):
    """
    Cancel an ongoing analysis session.
    """
    try:
        success = notification_service.cancel_session(session_id)
        if not success:
            raise HTTPException(status_code=404, detail="Session not found")
        
        return {"success": True, "message": "Analysis cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel analysis: {str(e)}")

@router.get("/analyze/status")
async def get_service_status():
    """
    Get the current status of the analysis service.
    """
    try:
        active_sessions = notification_service.get_active_sessions()
        return {
            "service_status": "running",
            "active_sessions": len(active_sessions),
            "sessions": active_sessions
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get service status: {str(e)}")