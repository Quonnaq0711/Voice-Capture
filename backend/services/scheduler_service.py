"""
Background Scheduler Service for Daily Recommendations
"""
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from backend.models.user import User
from backend.models.daily_recommendation import DailyRecommendation
from backend.models.refresh_token import RefreshToken
from backend.services.recommendation_service import RecommendationService
from backend.utils.db_session import get_db_session_with_commit, get_db_session

# Configure logging
logger = logging.getLogger(__name__)

class DailyRecommendationScheduler:
    """Scheduler for generating daily recommendations for all users"""

    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.is_running = False

    def start(self):
        """Start the scheduler"""
        if not self.is_running:
            # Schedule daily recommendation generation at 6:00 AM UTC every day
            self.scheduler.add_job(
                func=self._generate_daily_recommendations_for_all_users,
                trigger=CronTrigger(hour=6, minute=0, timezone=timezone.utc),  # 6:00 AM UTC daily
                id='daily_recommendations_job',
                name='Generate Daily Recommendations for All Users',
                replace_existing=True
            )

            # Also schedule a cleanup job to remove old recommendations (older than 7 days)
            self.scheduler.add_job(
                func=self._cleanup_old_recommendations,
                trigger=CronTrigger(hour=2, minute=0, timezone=timezone.utc),  # 2:00 AM UTC daily
                id='cleanup_recommendations_job',
                name='Cleanup Old Recommendations',
                replace_existing=True
            )

            # Schedule cleanup job for expired/revoked refresh tokens
            self.scheduler.add_job(
                func=self._cleanup_old_refresh_tokens,
                trigger=CronTrigger(hour=3, minute=0, timezone=timezone.utc),  # 3:00 AM UTC daily
                id='cleanup_refresh_tokens_job',
                name='Cleanup Expired Refresh Tokens',
                replace_existing=True
            )

            self.scheduler.start()
            self.is_running = True
            logger.info("Daily recommendation scheduler started (6:00 AM UTC daily)")
            logger.info("Cleanup jobs scheduled (2:00 AM and 3:00 AM UTC daily)")

    def stop(self):
        """Stop the scheduler"""
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Daily recommendation scheduler stopped")

    def _generate_daily_recommendations_for_all_users(self):
        """Generate daily recommendations for all active users"""
        logger.info("Starting scheduled daily recommendation generation for all users")

        try:
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            # Run the async function
            loop.run_until_complete(self._async_generate_recommendations())

        except Exception as e:
            logger.error(f"Error in scheduled daily recommendation generation: {e}")
        finally:
            try:
                loop.close()
            except Exception as loop_error:
                logger.error(f"Error closing event loop: {loop_error}", exc_info=True)

    async def _async_generate_recommendations(self):
        """
        Async function to generate recommendations for all users.

        Uses context manager to ensure proper database session cleanup
        and automatic rollback on exceptions.
        """
        success_count = 0
        error_count = 0

        try:
            # Use context manager for safe session handling
            with get_db_session() as db:
                # Get all active users (users who have logged in within the last 30 days)
                thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

                active_users = db.query(User).filter(
                    User.last_login >= thirty_days_ago,
                    User.last_login.is_not(None)  # Ensure last_login is not NULL
                ).all()

                logger.info(f"📊 Found {len(active_users)} active users to generate recommendations for")

                # Generate recommendations for each user
                async with RecommendationService() as rec_service:
                    for user in active_users:
                        try:
                            # Check if user already has recommendations for today
                            today = datetime.now(timezone.utc)
                            existing_rec = DailyRecommendation.get_for_user_and_date(db, user.id, today)

                            if existing_rec:
                                logger.info(f"⏭️ User {user.id} already has recommendations for today, skipping")
                                continue

                            # Generate new recommendations
                            logger.info(f"🔄 Generating recommendations for user {user.id} ({user.first_name})")

                            result = await rec_service.generate_daily_recommendations(
                                db=db,
                                user_id=user.id,
                                target_date=today
                            )

                            if result.get("status") in ["success", "fallback"]:
                                success_count += 1
                                logger.info(f"✅ Generated recommendations for user {user.id}")
                            else:
                                error_count += 1
                                logger.warning(f"⚠️ Failed to generate recommendations for user {user.id}")

                        except Exception as user_error:
                            error_count += 1
                            logger.error(f"❌ Error generating recommendations for user {user.id}: {user_error}")

                logger.info(f"🎯 Daily recommendation generation completed: {success_count} success, {error_count} errors")
                # Database session automatically closed here by context manager

        except Exception as e:
            logger.error(f"❌ Critical error in daily recommendation generation: {e}")

    def _cleanup_old_recommendations(self):
        """
        Remove recommendations older than 7 days.

        Uses context manager with automatic commit to ensure
        proper cleanup and transaction handling.
        """
        logger.info("🧹 Starting cleanup of old recommendations...")

        try:
            # Use context manager with auto-commit for cleanup operation
            with get_db_session_with_commit() as db:
                # Calculate cutoff date (7 days ago)
                seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

                # Delete old recommendations
                deleted_count = db.query(DailyRecommendation).filter(
                    DailyRecommendation.date < seven_days_ago
                ).delete()

                # Commit happens automatically on successful exit
                logger.info(f"🗑️ Cleaned up {deleted_count} old recommendations (older than 7 days)")

        except Exception as e:
            # Rollback happens automatically in context manager
            logger.error(f"❌ Error during recommendation cleanup: {e}")

    def _cleanup_old_refresh_tokens(self):
        """
        Remove expired and revoked refresh tokens older than 30 days.

        This helps:
        - Keep database size manageable
        - Improve query performance
        - Remove stale security data
        """
        logger.info("🧹 Starting cleanup of old refresh tokens...")

        try:
            with get_db_session_with_commit() as db:
                # Calculate cutoff date (30 days ago)
                thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)

                # Delete expired tokens older than 30 days
                expired_count = db.query(RefreshToken).filter(
                    RefreshToken.expires_at < thirty_days_ago
                ).delete()

                # Also delete revoked tokens older than 30 days
                revoked_count = db.query(RefreshToken).filter(
                    RefreshToken.revoked == True,
                    RefreshToken.revoked_at < thirty_days_ago
                ).delete()

                total_deleted = expired_count + revoked_count
                logger.info(f"🗑️ Cleaned up {total_deleted} old refresh tokens ({expired_count} expired, {revoked_count} revoked)")

        except Exception as e:
            logger.error(f"❌ Error during refresh token cleanup: {e}")

    def generate_for_user_now(self, user_id: int):
        """Manually trigger recommendation generation for a specific user (for testing)"""
        logger.info(f"🔄 Manually generating recommendations for user {user_id}")

        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(self._generate_for_single_user(user_id))
        except Exception as e:
            logger.error(f"❌ Error manually generating recommendations for user {user_id}: {e}")
        finally:
            try:
                loop.close()
            except Exception as loop_error:
                logger.error(f"Error closing event loop: {loop_error}", exc_info=True)

    async def _generate_for_single_user(self, user_id: int):
        """
        Generate recommendations for a single user.

        Uses context manager to ensure proper session cleanup.

        Args:
            user_id: ID of the user to generate recommendations for
        """
        try:
            # Use context manager for safe session handling
            with get_db_session() as db:
                async with RecommendationService() as rec_service:
                    today = datetime.now(timezone.utc)
                    result = await rec_service.generate_daily_recommendations(
                        db=db,
                        user_id=user_id,
                        target_date=today
                    )
                    logger.info(f"✅ Manual generation completed for user {user_id}: {result.get('status')}")
                # Database session automatically closed here

        except Exception as e:
            # Rollback happens automatically in context manager
            logger.error(f"❌ Error in manual generation for user {user_id}: {e}")


# Global scheduler instance
daily_scheduler = DailyRecommendationScheduler()