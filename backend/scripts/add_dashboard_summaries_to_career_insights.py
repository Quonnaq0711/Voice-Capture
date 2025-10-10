#!/usr/bin/env python3
"""
Migration script to add dashboard_summaries and summaries_generated_at columns
to career_insights table
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from backend.db.database import SQLALCHEMY_DATABASE_URL

def add_dashboard_summaries_columns():
    """Add dashboard_summaries and summaries_generated_at columns to career_insights table"""

    engine = create_engine(SQLALCHEMY_DATABASE_URL)

    with engine.connect() as connection:
        # Check if columns already exist
        try:
            result = connection.execute(text("PRAGMA table_info(career_insights)"))
            columns = [row[1] for row in result.fetchall()]

            if 'dashboard_summaries' not in columns:
                print("Adding dashboard_summaries column...")
                connection.execute(text("ALTER TABLE career_insights ADD COLUMN dashboard_summaries TEXT"))
                connection.commit()
                print("Added dashboard_summaries column")
            else:
                print("dashboard_summaries column already exists")

            if 'summaries_generated_at' not in columns:
                print("Adding summaries_generated_at column...")
                connection.execute(text("ALTER TABLE career_insights ADD COLUMN summaries_generated_at DATETIME"))
                connection.commit()
                print("Added summaries_generated_at column")
            else:
                print("summaries_generated_at column already exists")

        except Exception as e:
            print(f"Error adding columns: {e}")
            connection.rollback()
            raise

if __name__ == "__main__":
    print("Adding dashboard summaries columns to career_insights table...")
    add_dashboard_summaries_columns()
    print("Migration completed successfully!")