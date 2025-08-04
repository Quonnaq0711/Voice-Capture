from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import json
import asyncio
from datetime import datetime
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

class NotificationMessage(BaseModel):
    """Model for notification messages."""
    type: str
    title: str
    message: str
    data: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None
    priority: str = "normal"  # low, normal, high, urgent

class UserNotificationService:
    """Service for managing user notifications across the platform."""
    
    def __init__(self):
        """Initialize the notification service."""
        self.active_connections: Dict[int, List[asyncio.Queue]] = defaultdict(list)
        self.notification_history: Dict[int, List[NotificationMessage]] = defaultdict(list)
        self.max_history_per_user = 100
        
    async def connect_user(self, user_id: int) -> asyncio.Queue:
        """Connect a user for real-time notifications.
        
        Args:
            user_id: User ID to connect
            
        Returns:
            Queue for receiving notifications
        """
        queue = asyncio.Queue()
        self.active_connections[user_id].append(queue)
        logger.info(f"User {user_id} connected for notifications. Active connections: {len(self.active_connections[user_id])}")
        return queue
    
    async def disconnect_user(self, user_id: int, queue: asyncio.Queue):
        """Disconnect a user from notifications.
        
        Args:
            user_id: User ID to disconnect
            queue: Queue to remove
        """
        if user_id in self.active_connections:
            try:
                self.active_connections[user_id].remove(queue)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
                logger.info(f"User {user_id} disconnected from notifications")
            except ValueError:
                pass  # Queue not in list
    
    async def send_notification(self, user_id: int, notification: NotificationMessage):
        """Send a notification to a specific user.
        
        Args:
            user_id: Target user ID
            notification: Notification to send
        """
        # Add timestamp if not provided
        if not notification.timestamp:
            notification.timestamp = datetime.now().isoformat()
        
        # Store in history
        self.notification_history[user_id].append(notification)
        
        # Trim history if too long
        if len(self.notification_history[user_id]) > self.max_history_per_user:
            self.notification_history[user_id] = self.notification_history[user_id][-self.max_history_per_user:]
        
        # Send to all active connections for this user
        if user_id in self.active_connections:
            disconnected_queues = []
            for queue in self.active_connections[user_id]:
                try:
                    await queue.put(notification.dict())
                except Exception as e:
                    logger.error(f"Failed to send notification to user {user_id}: {e}")
                    disconnected_queues.append(queue)
            
            # Remove disconnected queues
            for queue in disconnected_queues:
                await self.disconnect_user(user_id, queue)
        
        logger.info(f"Notification sent to user {user_id}: {notification.type} - {notification.title}")
    
    async def send_career_analysis_progress(self, user_id: int, session_id: str, 
                                          current_section: str, progress: float, 
                                          total_sections: int, status: str = "analyzing"):
        """Send career analysis progress notification.
        
        Args:
            user_id: Target user ID
            session_id: Analysis session ID
            current_section: Current section being analyzed
            progress: Progress percentage (0-100)
            total_sections: Total number of sections
            status: Current status (analyzing, completed, error)
        """
        notification = NotificationMessage(
            type="career_analysis_progress",
            title="Career Analysis in Progress",
            message=f"Analyzing {current_section.replace('_', ' ').title()}... ({progress:.1f}% complete)",
            data={
                "session_id": session_id,
                "current_section": current_section,
                "progress": progress,
                "total_sections": total_sections,
                "status": status,
                "completed_sections": int((progress / 100) * total_sections)
            },
            priority="normal"
        )
        
        await self.send_notification(user_id, notification)
    
    async def send_career_analysis_complete(self, user_id: int, session_id: str, 
                                          sections_completed: int):
        """Send career analysis completion notification.
        
        Args:
            user_id: Target user ID
            session_id: Analysis session ID
            sections_completed: Number of sections completed
        """
        notification = NotificationMessage(
            type="career_analysis_complete",
            title="Career Analysis Complete",
            message=f"Your career analysis is ready! {sections_completed} sections analyzed.",
            data={
                "session_id": session_id,
                "sections_completed": sections_completed,
                "status": "completed"
            },
            priority="high"
        )
        
        await self.send_notification(user_id, notification)
    
    async def send_career_analysis_error(self, user_id: int, session_id: str, 
                                       error_message: str, current_section: str = None):
        """Send career analysis error notification.
        
        Args:
            user_id: Target user ID
            session_id: Analysis session ID
            error_message: Error description
            current_section: Section where error occurred
        """
        title = "Career Analysis Error"
        message = f"An error occurred during analysis: {error_message}"
        if current_section:
            message = f"Error in {current_section.replace('_', ' ').title()}: {error_message}"
        
        notification = NotificationMessage(
            type="career_analysis_error",
            title=title,
            message=message,
            data={
                "session_id": session_id,
                "error": error_message,
                "current_section": current_section,
                "status": "error"
            },
            priority="high"
        )
        
        await self.send_notification(user_id, notification)
    
    def get_notification_history(self, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get notification history for a user.
        
        Args:
            user_id: User ID
            limit: Maximum number of notifications to return
            
        Returns:
            List of notifications
        """
        history = self.notification_history.get(user_id, [])
        return [notification.dict() if hasattr(notification, 'dict') else notification 
                for notification in history[-limit:]]
    
    def get_active_connections_count(self, user_id: int = None) -> int:
        """Get count of active connections.
        
        Args:
            user_id: Optional user ID to get count for specific user
            
        Returns:
            Number of active connections
        """
        if user_id:
            return len(self.active_connections.get(user_id, []))
        return sum(len(queues) for queues in self.active_connections.values())

# Global notification service instance
notification_service = UserNotificationService()

# Router for notification endpoints
router = APIRouter(prefix="/api/notifications", tags=["notifications"])

@router.get("/stream/{user_id}")
async def stream_notifications(user_id: int):
    """Stream real-time notifications for a user via Server-Sent Events.
    
    Args:
        user_id: User ID to stream notifications for
    """
    async def event_generator():
        queue = await notification_service.connect_user(user_id)
        try:
            # Send connection confirmation
            yield f"data: {json.dumps({'type': 'connected', 'user_id': user_id})}\n\n"
            
            while True:
                try:
                    # Wait for notification with timeout
                    notification = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(notification)}\n\n"
                except asyncio.TimeoutError:
                    # Send keepalive
                    yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"
                except Exception as e:
                    logger.error(f"Error in notification stream for user {user_id}: {e}")
                    break
        finally:
            await notification_service.disconnect_user(user_id, queue)
    
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

@router.get("/history/{user_id}")
async def get_notification_history(user_id: int, limit: int = 50):
    """Get notification history for a user.
    
    Args:
        user_id: User ID
        limit: Maximum number of notifications to return
    """
    try:
        history = notification_service.get_notification_history(user_id, limit)
        return {
            "status": "success",
            "notifications": history,
            "count": len(history)
        }
    except Exception as e:
        logger.error(f"Error getting notification history for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status")
async def get_notification_status():
    """Get notification service status."""
    return {
        "status": "active",
        "active_connections": notification_service.get_active_connections_count(),
        "users_connected": len(notification_service.active_connections),
        "timestamp": datetime.now().isoformat()
    }

@router.post("/test/{user_id}")
async def send_test_notification(user_id: int, message: str = "Test notification"):
    """Send a test notification to a user.
    
    Args:
        user_id: Target user ID
        message: Test message
    """
    try:
        notification = NotificationMessage(
            type="test",
            title="Test Notification",
            message=message,
            priority="normal"
        )
        
        await notification_service.send_notification(user_id, notification)
        
        return {
            "status": "success",
            "message": "Test notification sent",
            "user_id": user_id
        }
    except Exception as e:
        logger.error(f"Error sending test notification to user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))