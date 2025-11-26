from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.db.database import get_db
from backend.utils.auth import get_current_user
from backend.models.user import User
from backend.models.activity import UserActivity
from backend.services.activity_service import ActivityService
from pydantic import BaseModel
from datetime import datetime


router = APIRouter(prefix="/activities", tags=["activities"])


class ActivityResponse(BaseModel):
    """Response model for activity data"""
    id: int
    activity_type: str
    activity_source: str
    activity_title: str
    activity_description: Optional[str]
    activity_metadata: dict
    created_at: str
    updated_at: str
    session_id: Optional[int]
    message_id: Optional[int]

    class Config:
        from_attributes = True


class ActivitySummaryResponse(BaseModel):
    """Response model for activity summary"""
    total_activities: int
    activity_types: dict
    activity_sources: dict
    days_analyzed: int
    period_start: str
    period_end: str


class DailyActivityItem(BaseModel):
    """Model for daily activity data point"""
    date: str
    day: str
    count: int


class MostActiveDay(BaseModel):
    """Model for most active day info"""
    date: str
    count: int


class MostUsedSource(BaseModel):
    """Model for most used source info"""
    source: str
    count: int


class TimeOfDayDistribution(BaseModel):
    """Model for time of day activity distribution"""
    morning: int = 0
    afternoon: int = 0
    evening: int = 0
    night: int = 0


class WeekdayDistributionItem(BaseModel):
    """Model for weekday activity distribution"""
    day: str
    count: int


class MostActiveWeekday(BaseModel):
    """Model for most active weekday"""
    day: str
    count: int


class HeatmapItem(BaseModel):
    """Model for weekly heatmap data point"""
    day: int
    hour: int
    count: int


class UsageAnalyticsResponse(BaseModel):
    """Response model for comprehensive usage analytics"""
    total_activities: int
    daily_activity: List[DailyActivityItem]
    activity_by_type: dict
    activity_by_source: dict
    most_active_day: Optional[MostActiveDay]
    most_used_source: Optional[MostUsedSource]
    average_daily_activities: float
    streak_days: int
    days_with_activity: Optional[int] = 0
    total_days: Optional[int] = 30
    time_of_day: TimeOfDayDistribution
    peak_time: Optional[str] = None
    agent_usage: dict
    # Enhanced analytics
    hourly_distribution: List[int]
    weekday_distribution: List[WeekdayDistributionItem]
    most_active_weekday: Optional[MostActiveWeekday]
    weekly_heatmap: List[HeatmapItem]
    this_week_count: int = 0
    last_week_count: int = 0
    wow_change: float = 0
    trend: str = "stable"
    engagement_rate: float = 0
    peak_hour: Optional[int] = None
    period_start: str
    period_end: str


class CreateActivityRequest(BaseModel):
    """Request model for creating activities"""
    activity_type: str
    activity_source: str
    activity_title: str
    activity_description: Optional[str] = None
    activity_metadata: Optional[dict] = None
    session_id: Optional[int] = None
    message_id: Optional[int] = None


@router.get("/recent", response_model=List[ActivityResponse])
async def get_recent_activities(
    limit: int = Query(1000, description="Number of recent activities to return", ge=1, le=10000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recent activities for the current user
    """
    try:
        activities = ActivityService.get_recent_activities(
            db=db,
            user_id=current_user.id,
            limit=limit
        )

        return [
            ActivityResponse(
                id=activity.id,
                activity_type=activity.activity_type,
                activity_source=activity.activity_source,
                activity_title=activity.activity_title,
                activity_description=activity.activity_description,
                activity_metadata=activity.activity_metadata or {},
                created_at=activity.created_at.isoformat() if activity.created_at else "",
                updated_at=activity.updated_at.isoformat() if activity.updated_at else "",
                session_id=activity.session_id,
                message_id=activity.message_id
            )
            for activity in activities
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching recent activities: {str(e)}")


@router.get("/", response_model=List[ActivityResponse])
async def get_user_activities(
    limit: int = Query(1000, description="Number of activities to return", ge=1, le=10000),
    offset: int = Query(0, description="Number of activities to skip", ge=0),
    activity_type: Optional[str] = Query(None, description="Filter by activity type"),
    activity_source: Optional[str] = Query(None, description="Filter by activity source"),
    days_back: int = Query(30, description="Number of days to look back", ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user activities with optional filtering and pagination
    """
    try:
        activities = ActivityService.get_user_activities(
            db=db,
            user_id=current_user.id,
            limit=limit,
            offset=offset,
            activity_type=activity_type,
            activity_source=activity_source,
            days_back=days_back
        )

        return [
            ActivityResponse(
                id=activity.id,
                activity_type=activity.activity_type,
                activity_source=activity.activity_source,
                activity_title=activity.activity_title,
                activity_description=activity.activity_description,
                activity_metadata=activity.activity_metadata or {},
                created_at=activity.created_at.isoformat() if activity.created_at else "",
                updated_at=activity.updated_at.isoformat() if activity.updated_at else "",
                session_id=activity.session_id,
                message_id=activity.message_id
            )
            for activity in activities
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching activities: {str(e)}")


@router.get("/summary", response_model=ActivitySummaryResponse)
async def get_activity_summary(
    days_back: int = Query(7, description="Number of days to analyze", ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get activity summary for the current user
    """
    try:
        summary = ActivityService.get_activity_summary(
            db=db,
            user_id=current_user.id,
            days_back=days_back
        )

        return ActivitySummaryResponse(**summary)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching activity summary: {str(e)}")


@router.get("/analytics", response_model=UsageAnalyticsResponse)
async def get_usage_analytics(
    days_back: int = Query(30, description="Number of days to analyze", ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get comprehensive usage analytics for the current user.
    Returns daily activity counts, activity breakdown by type and source,
    streak information, and other usage metrics.
    """
    try:
        analytics = ActivityService.get_usage_analytics(
            db=db,
            user_id=current_user.id,
            days_back=days_back
        )

        return UsageAnalyticsResponse(**analytics)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching usage analytics: {str(e)}")


@router.post("/", response_model=ActivityResponse)
async def create_activity(
    request: CreateActivityRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new activity for the current user
    """
    try:
        activity = ActivityService.create_activity(
            db=db,
            user_id=current_user.id,
            activity_type=request.activity_type,
            activity_source=request.activity_source,
            activity_title=request.activity_title,
            activity_description=request.activity_description,
            activity_metadata=request.activity_metadata,
            session_id=request.session_id,
            message_id=request.message_id
        )

        return ActivityResponse(
            id=activity.id,
            activity_type=activity.activity_type,
            activity_source=activity.activity_source,
            activity_title=activity.activity_title,
            activity_description=activity.activity_description,
            activity_metadata=activity.activity_metadata or {},
            created_at=activity.created_at.isoformat() if activity.created_at else "",
            updated_at=activity.updated_at.isoformat() if activity.updated_at else "",
            session_id=activity.session_id,
            message_id=activity.message_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating activity: {str(e)}")


@router.post("/track/chat")
async def track_chat_activity(
    source: str,
    session_id: Optional[int] = None,
    message_id: Optional[int] = None,
    agent_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Track a chat activity
    """
    try:
        activity = ActivityService.track_chat_activity(
            db=db,
            user_id=current_user.id,
            source=source,
            session_id=session_id,
            message_id=message_id,
            agent_type=agent_type
        )

        return {"message": "Chat activity tracked successfully", "activity_id": activity.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking chat activity: {str(e)}")


@router.post("/track/resume-analysis")
async def track_resume_analysis(
    resume_filename: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Track a resume analysis activity
    """
    try:
        activity = ActivityService.track_resume_analysis(
            db=db,
            user_id=current_user.id,
            resume_filename=resume_filename
        )

        return {"message": "Resume analysis activity tracked successfully", "activity_id": activity.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking resume analysis: {str(e)}")


@router.post("/track/agent-interaction")
async def track_agent_interaction(
    agent_type: str,
    interaction_type: str = "general",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Track an agent interaction activity
    """
    try:
        activity = ActivityService.track_agent_interaction(
            db=db,
            user_id=current_user.id,
            agent_type=agent_type,
            interaction_type=interaction_type
        )

        return {"message": "Agent interaction tracked successfully", "activity_id": activity.id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error tracking agent interaction: {str(e)}")