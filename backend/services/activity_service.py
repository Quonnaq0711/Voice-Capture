from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
from models.activity import UserActivity
from models.user import User


class ActivityService:
    """
    Service for tracking and managing user activities across the platform
    """

    @staticmethod
    def create_activity(
        db: Session,
        user_id: int,
        activity_type: str,
        activity_source: str,
        activity_title: str,
        activity_description: str = None,
        activity_metadata: Dict[str, Any] = None,
        session_id: int = None,
        message_id: int = None
    ) -> UserActivity:
        """
        Create a new user activity record

        Args:
            db: Database session
            user_id: ID of the user performing the activity
            activity_type: Type of activity ('chat', 'resume_analysis', 'agent_interaction', etc.)
            activity_source: Source of activity ('dashboard', 'career', 'money', 'mind', etc.)
            activity_title: Human-readable title for the activity
            activity_description: Optional detailed description
            activity_metadata: Optional metadata for additional context
            session_id: Optional chat session ID
            message_id: Optional message ID

        Returns:
            Created UserActivity instance
        """
        activity = UserActivity(
            user_id=user_id,
            activity_type=activity_type,
            activity_source=activity_source,
            activity_title=activity_title,
            activity_description=activity_description,
            activity_metadata=activity_metadata or {},
            session_id=session_id,
            message_id=message_id
        )

        db.add(activity)
        db.commit()
        db.refresh(activity)

        return activity

    @staticmethod
    def get_user_activities(
        db: Session,
        user_id: int,
        limit: int = 20,
        offset: int = 0,
        activity_type: str = None,
        activity_source: str = None,
        days_back: int = 30
    ) -> List[UserActivity]:
        """
        Get user activities with optional filtering

        Args:
            db: Database session
            user_id: ID of the user
            limit: Maximum number of activities to return
            offset: Number of activities to skip
            activity_type: Optional filter by activity type
            activity_source: Optional filter by activity source
            days_back: Number of days to look back (default 30)

        Returns:
            List of UserActivity instances
        """
        query = db.query(UserActivity).filter(UserActivity.user_id == user_id)

        # Filter by date range
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)
        query = query.filter(UserActivity.created_at >= cutoff_date)

        # Apply optional filters
        if activity_type:
            query = query.filter(UserActivity.activity_type == activity_type)

        if activity_source:
            query = query.filter(UserActivity.activity_source == activity_source)

        # Order by most recent first
        query = query.order_by(desc(UserActivity.created_at))

        # Apply pagination
        return query.offset(offset).limit(limit).all()

    @staticmethod
    def get_recent_activities(
        db: Session,
        user_id: int,
        limit: int = 10
    ) -> List[UserActivity]:
        """
        Get the most recent activities for a user

        Args:
            db: Database session
            user_id: ID of the user
            limit: Maximum number of activities to return

        Returns:
            List of recent UserActivity instances
        """
        return ActivityService.get_user_activities(
            db=db,
            user_id=user_id,
            limit=limit,
            offset=0,
            days_back=7  # Only look at last 7 days for recent activities
        )

    @staticmethod
    def get_activity_summary(
        db: Session,
        user_id: int,
        days_back: int = 7
    ) -> Dict[str, Any]:
        """
        Get a summary of user activities

        Args:
            db: Database session
            user_id: ID of the user
            days_back: Number of days to analyze

        Returns:
            Dictionary with activity summary statistics
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)

        activities = db.query(UserActivity).filter(
            and_(
                UserActivity.user_id == user_id,
                UserActivity.created_at >= cutoff_date
            )
        ).all()

        # Count activities by type
        activity_counts = {}
        source_counts = {}

        for activity in activities:
            activity_counts[activity.activity_type] = activity_counts.get(activity.activity_type, 0) + 1
            source_counts[activity.activity_source] = source_counts.get(activity.activity_source, 0) + 1

        return {
            "total_activities": len(activities),
            "activity_types": activity_counts,
            "activity_sources": source_counts,
            "days_analyzed": days_back,
            "period_start": cutoff_date.isoformat(),
            "period_end": datetime.utcnow().isoformat()
        }

    @staticmethod
    def track_chat_activity(
        db: Session,
        user_id: int,
        source: str,
        session_id: int = None,
        message_id: int = None,
        agent_type: str = None
    ) -> UserActivity:
        """
        Track a chat interaction activity

        Args:
            db: Database session
            user_id: ID of the user
            source: Source of the chat ('dashboard', 'career', etc.)
            session_id: Optional chat session ID
            message_id: Optional message ID
            agent_type: Optional agent type

        Returns:
            Created UserActivity instance
        """
        title = f"Chat conversation in {source.title()}"
        if agent_type:
            title += f" with {agent_type.title()} Agent"

        metadata = {}
        if agent_type:
            metadata["agent_type"] = agent_type

        return ActivityService.create_activity(
            db=db,
            user_id=user_id,
            activity_type="chat",
            activity_source=source,
            activity_title=title,
            activity_description=f"Started a conversation in {source}",
            activity_metadata=metadata,
            session_id=session_id,
            message_id=message_id
        )

    @staticmethod
    def track_resume_analysis(
        db: Session,
        user_id: int,
        resume_filename: str = None
    ) -> UserActivity:
        """
        Track a resume analysis activity

        Args:
            db: Database session
            user_id: ID of the user
            resume_filename: Optional filename of the analyzed resume

        Returns:
            Created UserActivity instance
        """
        title = "Resume Analysis"
        description = "Performed resume analysis"
        if resume_filename:
            description += f" on {resume_filename}"

        metadata = {}
        if resume_filename:
            metadata["resume_filename"] = resume_filename

        return ActivityService.create_activity(
            db=db,
            user_id=user_id,
            activity_type="resume_analysis",
            activity_source="career",
            activity_title=title,
            activity_description=description,
            activity_metadata=metadata
        )

    @staticmethod
    def track_agent_interaction(
        db: Session,
        user_id: int,
        agent_type: str,
        interaction_type: str = "general"
    ) -> UserActivity:
        """
        Track an agent interaction activity

        Args:
            db: Database session
            user_id: ID of the user
            agent_type: Type of agent ('career', 'money', 'mind', etc.)
            interaction_type: Type of interaction ('general', 'analysis', 'recommendation')

        Returns:
            Created UserActivity instance
        """
        title = f"{agent_type.title()} Agent Interaction"
        description = f"Interacted with {agent_type} agent"

        return ActivityService.create_activity(
            db=db,
            user_id=user_id,
            activity_type="agent_interaction",
            activity_source=agent_type,
            activity_title=title,
            activity_description=description,
            activity_metadata={"interaction_type": interaction_type}
        )