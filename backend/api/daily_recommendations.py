"""
Daily Recommendations API endpoints
"""
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from backend.models.user import User
from backend.models.daily_recommendation import DailyRecommendation
from backend.services.recommendation_service import RecommendationService
from backend.api.auth import get_current_user
from backend.db.database import get_db

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/daily-recommendations")
async def get_daily_recommendations(
    date: Optional[str] = None,  # Format: YYYY-MM-DD
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get daily recommendations for the current user.
    If no recommendations exist for today or they're expired, generate new ones.
    """
    try:
        # Parse target date
        target_date = datetime.now(timezone.utc)
        if date:
            try:
                target_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid date format. Use YYYY-MM-DD"
                )

        # Use recommendation service to get or generate recommendations
        async with RecommendationService() as rec_service:
            result = await rec_service.get_daily_recommendations(
                db=db,
                user_id=current_user.id,
                target_date=target_date
            )

        return {
            "status": "success",
            "user_id": current_user.id,
            "date": target_date.strftime("%Y-%m-%d"),
            "recommendations": result.get("recommendations", []),
            "generated_at": result.get("generated_at"),
            "from_cache": result.get("from_cache", False),
            "context_used": result.get("context_used", False),
            "generation_status": result.get("status", "unknown")
        }

    except Exception as e:
        logger.error(f"Error getting daily recommendations for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving daily recommendations: {str(e)}"
        )

@router.post("/daily-recommendations/generate")
async def force_generate_daily_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Force generation of new daily recommendations for the current user.
    This will override any existing recommendations for today.
    """
    try:
        target_date = datetime.now(timezone.utc)

        # First, generate new recommendations (don't delete old ones yet)
        logger.info(f"Generating new recommendations for user {current_user.id}")
        async with RecommendationService() as rec_service:
            result = await rec_service.generate_daily_recommendations(
                db=db,
                user_id=current_user.id,
                target_date=target_date
            )

        # Only delete existing recommendations AFTER successful generation
        if result.get("status") in ["success", "fallback"]:
            # Find and delete the old recommendation (but not the new one we just created)
            existing_recs = db.query(DailyRecommendation).filter(
                DailyRecommendation.user_id == current_user.id,
                DailyRecommendation.date >= target_date.replace(hour=0, minute=0, second=0, microsecond=0),
                DailyRecommendation.date <= target_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            ).order_by(DailyRecommendation.created_at.desc()).all()

            # Keep the newest one (first in desc order), delete the rest
            if len(existing_recs) > 1:
                old_recs = existing_recs[1:]  # Skip the first (newest) one
                logger.info(f"Cleaned up {len(old_recs)} old recommendations for user {current_user.id}")
                for old_rec in old_recs:
                    db.delete(old_rec)
                try:
                    db.commit()
                except Exception as e:
                    db.rollback()
                    logger.error(f"Failed to delete old recommendations: {str(e)}")
                    # Don't fail the entire request if cleanup fails
        else:
            logger.warning(f"Recommendation generation failed for user {current_user.id}, keeping existing ones")

        return {
            "status": "success",
            "message": "New daily recommendations generated successfully",
            "user_id": current_user.id,
            "date": target_date.strftime("%Y-%m-%d"),
            "recommendations": result.get("recommendations", []),
            "generated_at": result.get("generated_at"),
            "generation_status": result.get("status", "unknown")
        }

    except Exception as e:
        logger.error(f"Error force generating recommendations for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating daily recommendations: {str(e)}"
        )

@router.get("/daily-recommendations/history")
async def get_recommendations_history(
    limit: int = 7,  # Default to last 7 days
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get historical daily recommendations for the current user
    """
    try:
        recommendations = db.query(DailyRecommendation).filter(
            DailyRecommendation.user_id == current_user.id
        ).order_by(DailyRecommendation.date.desc()).limit(limit).all()

        return {
            "status": "success",
            "user_id": current_user.id,
            "history": [rec.to_dict() for rec in recommendations],
            "count": len(recommendations)
        }

    except Exception as e:
        logger.error(f"Error getting recommendations history for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving recommendations history: {str(e)}"
        )

@router.post("/daily-recommendations/generate-all")
async def generate_recommendations_for_all_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually trigger daily recommendation generation for all active users.
    This endpoint is for testing the scheduler functionality.
    """
    try:
        from backend.services.scheduler_service import daily_scheduler

        # Only allow admin users to trigger this (you can add admin check here)
        logger.info(f"Manual trigger of daily recommendations by user {current_user.id}")

        # Run the generation in a background task
        import asyncio
        asyncio.create_task(daily_scheduler._async_generate_recommendations())

        return {
            "status": "success",
            "message": "Daily recommendation generation started for all active users",
            "triggered_by": current_user.id
        }

    except Exception as e:
        logger.error(f"Error manually triggering daily recommendations: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error triggering daily recommendations: {str(e)}"
        )