"""
Create daily_recommendations table
"""
import sys
import os

# Add the project root directory to the Python path
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, project_root)

from backend.db.database import engine, Base
from backend.models.daily_recommendation import DailyRecommendation
from backend.models.user import User
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_daily_recommendations_table():
    """Create the daily_recommendations table"""
    try:
        logger.info("Creating daily_recommendations table...")

        # Create all tables (including daily_recommendations)
        Base.metadata.create_all(bind=engine)

        logger.info("✅ Daily recommendations table created successfully!")

    except Exception as e:
        logger.error(f"❌ Error creating daily_recommendations table: {e}")
        raise

if __name__ == "__main__":
    create_daily_recommendations_table()