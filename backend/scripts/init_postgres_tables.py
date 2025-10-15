#!/usr/bin/env python3
"""
Initialize PostgreSQL tables

This script creates all tables in the PostgreSQL database.
"""

import os
import sys

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

# Set environment variables for PostgreSQL
os.environ['DB_TYPE'] = 'postgresql'
os.environ['DB_HOST'] = 'localhost'
os.environ['DB_PORT'] = '5432'
os.environ['DB_NAME'] = 'productdb-staging'
os.environ['DB_USER'] = 'postgres'
os.environ['DB_PASSWORD'] = 'postgres'

from backend.db.database import engine, Base

# Import all models to ensure they're registered
from backend.models.user import User
from backend.models.profile import UserProfile
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.resume import Resume
from backend.models.activity import UserActivity
from backend.models.career_insight import CareerInsight
from backend.models.daily_recommendation import DailyRecommendation

def main():
    print("Initializing PostgreSQL tables...")
    print(f"Database URL: {engine.url}")

    try:
        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("\n✓ All tables created successfully!")

        # List created tables
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"\nCreated tables ({len(tables)}):")
        for table in sorted(tables):
            print(f"  - {table}")

        return 0
    except Exception as e:
        print(f"\n✗ Error creating tables: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
