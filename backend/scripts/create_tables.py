#!/usr/bin/env python3
"""
Consolidated database table creation script.
Creates all tables based on current SQLAlchemy model definitions.

Usage:
    python backend/scripts/create_tables.py              # Interactive mode
    python backend/scripts/create_tables.py --force      # Non-interactive, always drop/recreate
    python backend/scripts/create_tables.py --help       # Show help
"""
import sys
import os
import argparse

# Add project root to Python path (not just backend)
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(backend_dir)
sys.path.insert(0, project_root)

from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import SQLAlchemyError

# Import Base and all models (import order matters for relationships)
from backend.db.database import Base, SQLALCHEMY_DATABASE_URL
from backend.models.user import User
from backend.models.profile import UserProfile
from backend.models.resume import Resume
from backend.models.career_insight import CareerInsight
from backend.models.session import ChatSession
from backend.models.chat import ChatMessage
from backend.models.activity import UserActivity
from backend.models.daily_recommendation import DailyRecommendation


def get_db_file_path():
    """Extract the database file path from SQLALCHEMY_DATABASE_URL."""
    if SQLALCHEMY_DATABASE_URL.startswith('sqlite:///'):
        # Remove 'sqlite:///' prefix
        db_path = SQLALCHEMY_DATABASE_URL.replace('sqlite:///', '')
        # Convert to absolute path if relative
        if not os.path.isabs(db_path):
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            project_root = os.path.dirname(backend_dir)
            db_path = os.path.join(project_root, db_path)
        return db_path
    return None


def check_database_exists():
    """Check if the SQLite database file exists."""
    db_path = get_db_file_path()
    if db_path:
        return os.path.exists(db_path), db_path
    # For non-SQLite databases, always return True (assume exists)
    return True, None


def prompt_drop_tables():
    """Prompt user to confirm dropping existing tables."""
    while True:
        response = input("Database exists. Drop all tables and recreate? (y/N): ").strip().lower()
        if response in ['y', 'yes']:
            return True
        elif response in ['n', 'no', '']:
            return False
        else:
            print("Please answer 'y' or 'n'.")


def list_tables(engine):
    """List all tables in the database."""
    inspector = inspect(engine)
    return inspector.get_table_names()


def create_tables(force=False, interactive=True):
    """
    Create all database tables based on current model definitions.

    Args:
        force: If True, drop existing tables without prompting
        interactive: If True, prompt user for confirmation when database exists
    """
    try:
        # Check if database exists
        db_exists, db_path = check_database_exists()

        if db_path:
            print(f"Database location: {db_path}")
        else:
            print(f"Database URL: {SQLALCHEMY_DATABASE_URL}")

        # Create database engine
        engine = create_engine(SQLALCHEMY_DATABASE_URL)

        # Handle existing database
        should_drop = False
        if db_exists:
            existing_tables = list_tables(engine)
            if existing_tables:
                print(f"Found {len(existing_tables)} existing tables: {', '.join(existing_tables)}")

                if force:
                    should_drop = True
                    print("Force mode: Dropping all existing tables...")
                elif interactive:
                    should_drop = prompt_drop_tables()
                    if not should_drop:
                        print("Aborted. No changes made to database.")
                        return False
                else:
                    print("Database exists but no action specified. Use --force to drop and recreate.")
                    return False
        else:
            print("Database does not exist. Creating new database...")

        # Drop tables if requested
        if should_drop:
            Base.metadata.drop_all(bind=engine)
            print("✓ Dropped all existing tables")

        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("✓ Created all tables")

        # List created tables
        created_tables = list_tables(engine)
        print(f"\nSuccessfully created {len(created_tables)} tables:")
        for i, table_name in enumerate(created_tables, 1):
            print(f"  {i}. {table_name}")

        # Show model mapping
        print("\nModel to Table Mapping:")
        model_table_map = {
            'User': 'users',
            'UserProfile': 'user_profiles',
            'Resume': 'resumes',
            'CareerInsight': 'career_insights',
            'ChatSession': 'chat_sessions',
            'ChatMessage': 'chat_messages',
            'UserActivity': 'user_activities',
            'DailyRecommendation': 'daily_recommendations'
        }
        for model, table in model_table_map.items():
            status = "✓" if table in created_tables else "✗"
            print(f"  {status} {model} → {table}")

        return True

    except SQLAlchemyError as e:
        print(f"\n✗ Database error: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}", file=sys.stderr)
        return False


def main():
    """Main entry point with argument parsing."""
    parser = argparse.ArgumentParser(
        description='Create all database tables based on current SQLAlchemy models',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python backend/scripts/create_tables.py              # Interactive mode
  python backend/scripts/create_tables.py --force      # Drop and recreate without prompting

This script creates 8 tables:
  1. users                    (User authentication and profiles)
  2. user_profiles            (Extended user profile data)
  3. resumes                  (Resume uploads and metadata)
  4. career_insights          (Career-specific insights)
  5. chat_sessions            (Chat session management)
  6. chat_messages            (Individual chat messages)
  7. user_activities          (Activity tracking)
  8. daily_recommendations    (Daily AI recommendations)
        """
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Drop existing tables without prompting (non-interactive mode)'
    )

    args = parser.parse_args()

    print("=" * 70)
    print("Database Table Creation Script")
    print("=" * 70)
    print()

    success = create_tables(force=args.force, interactive=not args.force)

    print()
    print("=" * 70)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
