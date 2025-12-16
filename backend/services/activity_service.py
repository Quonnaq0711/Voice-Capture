from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, func
from backend.models.activity import UserActivity
from backend.models.user import User


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
        try:
            db.commit()
            db.refresh(activity)
        except Exception as e:
            db.rollback()
            raise Exception(f"Failed to create activity: {str(e)}")

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
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)
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
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_back)

        # Use database aggregation instead of loading all records into memory
        base_filter = and_(
            UserActivity.user_id == user_id,
            UserActivity.created_at >= cutoff_date
        )

        # Count total activities
        total_count = db.query(func.count(UserActivity.id)).filter(base_filter).scalar() or 0

        # Count by activity type using GROUP BY
        type_counts = db.query(
            UserActivity.activity_type,
            func.count(UserActivity.id)
        ).filter(base_filter).group_by(UserActivity.activity_type).all()
        activity_counts = {t: c for t, c in type_counts}

        # Count by activity source using GROUP BY
        source_counts_query = db.query(
            UserActivity.activity_source,
            func.count(UserActivity.id)
        ).filter(base_filter).group_by(UserActivity.activity_source).all()
        source_counts = {s: c for s, c in source_counts_query}

        return {
            "total_activities": total_count,
            "activity_types": activity_counts,
            "activity_sources": source_counts,
            "days_analyzed": days_back,
            "period_start": cutoff_date.isoformat(),
            "period_end": datetime.now(timezone.utc).isoformat()
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

    @staticmethod
    def get_usage_analytics(
        db: Session,
        user_id: int,
        days_back: int = 30
    ) -> Dict[str, Any]:
        """
        Get comprehensive usage analytics for a user

        Args:
            db: Database session
            user_id: ID of the user
            days_back: Number of days to analyze

        Returns:
            Dictionary with detailed usage analytics
        """
        from collections import defaultdict

        # Single datetime reference to avoid inconsistencies
        now = datetime.now(timezone.utc)
        cutoff_date = now - timedelta(days=days_back)

        # Get all activities in the period
        activities = db.query(UserActivity).filter(
            and_(
                UserActivity.user_id == user_id,
                UserActivity.created_at >= cutoff_date
            )
        ).order_by(UserActivity.created_at).all()

        if not activities:
            return {
                "total_activities": 0,
                "daily_activity": [],
                "activity_by_type": {},
                "activity_by_source": {},
                "most_active_day": None,
                "most_used_source": None,
                "average_daily_activities": 0,
                "streak_days": 0,
                "days_with_activity": 0,
                "total_days": days_back,
                "time_of_day": {"morning": 0, "afternoon": 0, "evening": 0, "night": 0},
                "peak_time": None,
                "agent_usage": {},
                "hourly_distribution": [0] * 24,
                "weekday_distribution": [{"day": d, "count": 0} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]],
                "most_active_weekday": None,
                "weekly_heatmap": [{"day": d, "hour": h, "count": 0} for d in range(7) for h in range(24)],
                "this_week_count": 0,
                "last_week_count": 0,
                "wow_change": 0,
                "trend": "stable",
                "engagement_rate": 0,
                "peak_hour": None,
                "period_start": cutoff_date.isoformat(),
                "period_end": now.isoformat()
            }

        # Helper to make datetime comparison safe (handle naive vs aware)
        def make_aware(dt):
            if dt is None:
                return None
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt

        # Daily activity counts
        daily_counts = defaultdict(int)
        type_counts = defaultdict(int)
        source_counts = defaultdict(int)
        hourly_counts = defaultdict(int)
        weekday_counts = defaultdict(int)  # 0=Mon, 6=Sun
        hour_weekday_matrix = defaultdict(lambda: defaultdict(int))  # For heatmap

        for activity in activities:
            # Use timezone-aware datetime for consistent handling
            aware_dt = make_aware(activity.created_at)
            # Use date only (no time) for grouping
            date_key = aware_dt.strftime("%Y-%m-%d")
            daily_counts[date_key] += 1
            type_counts[activity.activity_type] += 1
            source_counts[activity.activity_source] += 1
            # Track hourly activity
            hour = aware_dt.hour
            hourly_counts[hour] += 1
            # Track weekday activity
            weekday = aware_dt.weekday()  # 0=Mon, 6=Sun
            weekday_counts[weekday] += 1
            # Track hour x weekday for heatmap
            hour_weekday_matrix[weekday][hour] += 1

        # Calculate time of day distribution
        time_of_day = {
            "morning": sum(hourly_counts.get(h, 0) for h in range(6, 12)),      # 6 AM - 12 PM
            "afternoon": sum(hourly_counts.get(h, 0) for h in range(12, 18)),   # 12 PM - 6 PM
            "evening": sum(hourly_counts.get(h, 0) for h in range(18, 22)),     # 6 PM - 10 PM
            "night": sum(hourly_counts.get(h, 0) for h in list(range(22, 24)) + list(range(0, 6)))  # 10 PM - 6 AM
        }

        # Calculate feature usage (map sources to user-friendly names)
        feature_mapping = {
            "dashboard": "Personal Assistant",
            "chat_history": "Personal Assistant",
            "career": "Career Agent",
            "career_agent": "Career Agent",
            "documents": "Documents",
            "travel": "Travel Agent",
            "body": "Wellness",
            "wellness": "Wellness",
            "mind": "Wellness",
            "money": "Money Agent",
            "hobby": "Hobby Agent",
            "family": "Family",
            "spiritual": "Spiritual"
        }
        # Sources to exclude from display
        excluded_sources = {"activity_history"}

        agent_usage = defaultdict(int)
        for source, count in source_counts.items():
            if source.lower() in excluded_sources:
                continue
            feature_name = feature_mapping.get(source.lower(), source.replace("_", " ").title())
            agent_usage[feature_name] += count

        # Build daily activity list for chart (last N days)
        daily_activity = []
        current_date = cutoff_date.date()
        end_date = datetime.now(timezone.utc).date()

        while current_date <= end_date:
            date_str = current_date.strftime("%Y-%m-%d")
            daily_activity.append({
                "date": date_str,
                "day": current_date.strftime("%a"),
                "count": daily_counts.get(date_str, 0)
            })
            current_date += timedelta(days=1)

        # Find most active day
        most_active_day = None
        if daily_counts:
            max_date = max(daily_counts, key=daily_counts.get)
            most_active_day = {
                "date": max_date,
                "count": daily_counts[max_date]
            }

        # Find most used source
        most_used_source = None
        if source_counts:
            max_source = max(source_counts, key=source_counts.get)
            most_used_source = {
                "source": max_source,
                "count": source_counts[max_source]
            }

        # Calculate streak (consecutive days with activity)
        # If today has no activity, start counting from yesterday
        streak_days = 0
        today = now.date()
        today_str = today.strftime("%Y-%m-%d")

        # Check if we should start from today or yesterday
        if daily_counts.get(today_str, 0) > 0:
            check_date = today
        else:
            # No activity today, start from yesterday
            check_date = today - timedelta(days=1)

        while check_date >= cutoff_date.date():
            date_str = check_date.strftime("%Y-%m-%d")
            if daily_counts.get(date_str, 0) > 0:
                streak_days += 1
                check_date -= timedelta(days=1)
            else:
                break

        # Calculate average daily activities
        days_with_activity = len([d for d in daily_counts.values() if d > 0])
        average_daily = round(len(activities) / max(days_with_activity, 1), 1)

        # Find peak time of day
        peak_time = max(time_of_day, key=time_of_day.get) if any(time_of_day.values()) else None

        # Build hourly distribution (24 hours)
        hourly_distribution = [hourly_counts.get(h, 0) for h in range(24)]

        # Build weekday distribution (Mon-Sun)
        weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        weekday_distribution = [
            {"day": weekday_names[i], "count": weekday_counts.get(i, 0)}
            for i in range(7)
        ]

        # Find most active weekday
        most_active_weekday = None
        if weekday_counts:
            max_weekday = max(weekday_counts, key=weekday_counts.get)
            most_active_weekday = {
                "day": weekday_names[max_weekday],
                "count": weekday_counts[max_weekday]
            }

        # Build weekly heatmap (7 days x 24 hours)
        weekly_heatmap = []
        for day in range(7):
            for hour in range(24):
                count = hour_weekday_matrix[day].get(hour, 0)
                weekly_heatmap.append({
                    "day": day,
                    "hour": hour,
                    "count": count
                })

        # Calculate week-over-week comparison (using 'now' from beginning of function)
        this_week_start = now - timedelta(days=7)
        last_week_start = now - timedelta(days=14)

        this_week_count = sum(
            1 for a in activities
            if make_aware(a.created_at) >= this_week_start
        )
        last_week_count = sum(
            1 for a in activities
            if last_week_start <= make_aware(a.created_at) < this_week_start
        )

        if last_week_count > 0:
            wow_change = round(((this_week_count - last_week_count) / last_week_count) * 100, 1)
        else:
            wow_change = 100.0 if this_week_count > 0 else 0.0

        # Determine trend
        if wow_change > 10:
            trend = "up"
        elif wow_change < -10:
            trend = "down"
        else:
            trend = "stable"

        # Calculate engagement rate (active days / total days as percentage)
        engagement_rate = round((days_with_activity / max(days_back, 1)) * 100, 1)

        # Find peak hour - only return a value if there's actual activity
        peak_hour = None
        if hourly_counts and sum(hourly_counts.values()) > 0:
            peak_hour = max(range(24), key=lambda h: hourly_counts.get(h, 0))

        return {
            "total_activities": len(activities),
            "daily_activity": daily_activity,
            "activity_by_type": dict(type_counts),
            "activity_by_source": dict(source_counts),
            "most_active_day": most_active_day,
            "most_used_source": most_used_source,
            "average_daily_activities": average_daily,
            "streak_days": streak_days,
            "days_with_activity": days_with_activity,
            "total_days": days_back,
            "time_of_day": time_of_day,
            "peak_time": peak_time,
            "agent_usage": dict(agent_usage),
            "hourly_distribution": hourly_distribution,
            "weekday_distribution": weekday_distribution,
            "most_active_weekday": most_active_weekday,
            "weekly_heatmap": weekly_heatmap,
            "this_week_count": this_week_count,
            "last_week_count": last_week_count,
            "wow_change": wow_change,
            "trend": trend,
            "engagement_rate": engagement_rate,
            "peak_hour": peak_hour,
            "period_start": cutoff_date.isoformat(),
            "period_end": now.isoformat()
        }