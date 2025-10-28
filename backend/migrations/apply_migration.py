#!/usr/bin/env python3
"""
Database Migration Script
Applies the unique active session constraint

Usage:
    python backend/migrations/apply_migration.py
"""

import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

# Now we can import backend modules
from sqlalchemy import text
from backend.db.database import engine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def apply_unique_active_session_constraint():
    """Apply the unique active session constraint to the database"""

    logger.info("="*60)
    logger.info("🔧 Applying Database Migration")
    logger.info("="*60)
    logger.info("Migration: Add unique constraint for active sessions")
    logger.info("Bug Fix: #42 - Race condition in session activation")
    logger.info("="*60)

    try:
        with engine.connect() as connection:
            # Check database type
            db_type = str(engine.url).split(':')[0]
            logger.info(f"Database type: {db_type}")

            # Apply the constraint
            sql = """
                CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_user
                ON chat_sessions(user_id)
                WHERE is_active = TRUE
            """

            logger.info("Executing SQL...")
            connection.execute(text(sql))
            connection.commit()

            logger.info("✅ Migration applied successfully!")
            logger.info("="*60)
            logger.info("Result: Only one active session per user is now enforced")
            logger.info("="*60)

            return True

    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        logger.error("="*60)
        return False


def verify_constraint():
    """Verify the constraint was applied correctly"""

    logger.info("\n🔍 Verifying constraint...")

    try:
        with engine.connect() as connection:
            # Check if index exists
            db_type = str(engine.url).split(':')[0]

            if 'sqlite' in db_type:
                # SQLite query to check indexes
                result = connection.execute(text(
                    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_one_active_session_per_user'"
                ))
            elif 'postgresql' in db_type:
                # PostgreSQL query to check indexes
                result = connection.execute(text(
                    "SELECT indexname FROM pg_indexes WHERE indexname='idx_one_active_session_per_user'"
                ))
            else:
                logger.warning(f"Unknown database type: {db_type}")
                return False

            index_exists = result.fetchone() is not None

            if index_exists:
                logger.info("✅ Constraint verified: idx_one_active_session_per_user exists")
                return True
            else:
                logger.error("❌ Constraint not found!")
                return False

    except Exception as e:
        logger.error(f"❌ Verification failed: {str(e)}")
        return False


if __name__ == "__main__":
    logger.info("Starting database migration...\n")

    success = apply_unique_active_session_constraint()

    if success:
        verify_constraint()
        logger.info("\n✨ Migration completed successfully!")
        sys.exit(0)
    else:
        logger.error("\n💥 Migration failed!")
        sys.exit(1)
