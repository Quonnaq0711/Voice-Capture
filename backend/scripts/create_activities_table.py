"""
Script to create the user_activities table for tracking user activities
Run this script to add activity tracking to the existing database
"""

import sys
import os

# Add the parent directory to sys.path to import modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from db.database import engine, SessionLocal
from models import UserActivity, User, Base
from sqlalchemy import text

def create_activities_table():
    """Create the user_activities table"""
    try:
        print("Creating user_activities table...")

        # Create the table using SQLAlchemy
        UserActivity.__table__.create(bind=engine, checkfirst=True)

        print("✅ user_activities table created successfully!")

        # Verify the table was created
        with engine.connect() as connection:
            result = connection.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='user_activities'"))
            if result.fetchone():
                print("✅ Table verified in database")
            else:
                print("❌ Table verification failed")

    except Exception as e:
        print(f"❌ Error creating activities table: {e}")
        return False

    return True

def add_sample_activities():
    """Add some sample activities for testing"""
    db = None
    try:
        print("Adding sample activities...")

        from services.activity_service import ActivityService

        db = SessionLocal()

        # Get the first user for testing (assuming there's at least one user)
        user = db.query(User).first()

        if not user:
            print("No users found. Please create a user first.")
            db.close()
            return False

        # Store user info before operations
        user_id = user.id
        username = user.username

        from datetime import timedelta

        # Create sample activities with different timestamps
        sample_activities = [
            {
                "activity_type": "chat",
                "activity_source": "dashboard",
                "activity_title": "Dashboard Conversation",
                "activity_description": "Started a conversation with the Personal Assistant",
                "activity_metadata": {"agent_type": "personal_assistant"},
                "time_offset_minutes": 2  # 2 minutes ago
            },
            {
                "activity_type": "agent_interaction",
                "activity_source": "career",
                "activity_title": "Career Agent Interaction",
                "activity_description": "Accessed Career Agent for professional guidance",
                "activity_metadata": {"interaction_type": "general"},
                "time_offset_minutes": 30  # 30 minutes ago
            },
            {
                "activity_type": "resume_analysis",
                "activity_source": "career",
                "activity_title": "Resume Analysis",
                "activity_description": "Performed resume analysis for career optimization",
                "activity_metadata": {"resume_filename": "sample_resume.pdf"},
                "time_offset_minutes": 120  # 2 hours ago
            },
            {
                "activity_type": "chat",
                "activity_source": "career",
                "activity_title": "Career Chat Message",
                "activity_description": "Sent message to Personal Assistant from Career Agent",
                "activity_metadata": {"agent_type": "personal_assistant", "source_context": "career_agent"},
                "time_offset_minutes": 5  # 5 minutes ago
            },
            {
                "activity_type": "chat",
                "activity_source": "dashboard",
                "activity_title": "Recent Dashboard Chat",
                "activity_description": "Sent message to Personal Assistant from Dashboard",
                "activity_metadata": {"agent_type": "personal_assistant", "source_context": "dashboard"},
                "time_offset_minutes": 0.5  # 30 seconds ago
            }
        ]

        for activity_data in sample_activities:
            time_offset_minutes = activity_data.pop('time_offset_minutes', 0)

            # Create activity
            activity = ActivityService.create_activity(
                db=db,
                user_id=user_id,
                **activity_data
            )

            # Manually update the created_at timestamp
            if time_offset_minutes > 0:
                from datetime import datetime, timedelta
                past_time = datetime.utcnow() - timedelta(minutes=time_offset_minutes)
                activity.created_at = past_time
                db.commit()

        print(f"✅ Added {len(sample_activities)} sample activities for user {username}")

    except Exception as e:
        print(f"❌ Error adding sample activities: {e}")
        return False
    finally:
        if db:
            db.close()

    return True

if __name__ == "__main__":
    print("=== Activity Tracking Database Setup ===")

    # Create the table
    if create_activities_table():
        # Add sample data
        add_sample_activities()
        print("\n✅ Activity tracking setup completed successfully!")
        print("You can now start tracking user activities across the platform.")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")