#!/usr/bin/env python3
"""
Add last_login column to users table for scheduler functionality
"""
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from sqlalchemy import text
from db.database import engine
from datetime import datetime

def add_last_login_column():
    """Add last_login column to users table if it doesn't exist"""

    with engine.connect() as connection:
        # Check if column already exists
        try:
            result = connection.execute(text("SELECT last_login FROM users LIMIT 1"))
            print("last_login column already exists in users table")
            return
        except Exception:
            # Column doesn't exist, let's add it
            pass

        try:
            # Add the last_login column
            connection.execute(text("ALTER TABLE users ADD COLUMN last_login DATETIME"))
            connection.commit()
            print("Successfully added last_login column to users table")

            # Set current time as last_login for all existing users
            connection.execute(text("UPDATE users SET last_login = :now"), {"now": datetime.now()})
            connection.commit()
            print("Set last_login for all existing users to current time")

        except Exception as e:
            print(f"Error adding last_login column: {e}")
            connection.rollback()

if __name__ == "__main__":
    print("Adding last_login column to users table...")
    add_last_login_column()
    print("Migration completed")