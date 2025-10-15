#!/usr/bin/env python3
"""
SQLite to PostgreSQL Data Migration Script

This script migrates all data from SQLite database to PostgreSQL database.
It preserves data integrity and handles relationships between tables.

Usage:
    python backend/scripts/migrate_sqlite_to_postgres.py
"""

import os
import sys
from datetime import datetime

# Add project root to Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker

# Import all models to ensure they're registered with SQLAlchemy
from backend.models.user import User
from backend.models.profile import UserProfile
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.resume import Resume
from backend.models.activity import UserActivity
from backend.models.career_insight import CareerInsight
from backend.models.daily_recommendation import DailyRecommendation


def get_sqlite_connection(db_path="/home/idii/data/database/app.db"):
    """Create SQLite database connection"""
    sqlite_url = f"sqlite:///{db_path}"
    print(f"Connecting to SQLite: {sqlite_url}")
    engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine)
    return engine, Session()


def get_postgres_connection(
    user="postgres",
    password="postgres",
    host="localhost",
    port="5432",
    database="productdb-staging"
):
    """Create PostgreSQL database connection"""
    postgres_url = f"postgresql://{user}:{password}@{host}:{port}/{database}"
    print(f"Connecting to PostgreSQL: postgresql://{user}:***@{host}:{port}/{database}")
    engine = create_engine(
        postgres_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20
    )
    Session = sessionmaker(bind=engine)
    return engine, Session()


def create_tables(postgres_engine):
    """Create all tables in PostgreSQL"""
    from backend.db.database import Base
    print("\nCreating PostgreSQL tables...")
    Base.metadata.create_all(bind=postgres_engine)
    print("✓ Tables created successfully")


def get_table_names(engine):
    """Get all table names from database"""
    inspector = inspect(engine)
    return inspector.get_table_names()


def migrate_table(model_class, sqlite_session, postgres_session, table_name):
    """Migrate data for a specific table"""
    try:
        print(f"\nMigrating {table_name}...")

        # Query all records from SQLite
        records = sqlite_session.query(model_class).all()

        if not records:
            print(f"  ⚠ No data found in {table_name}")
            return 0

        # Insert records into PostgreSQL
        migrated_count = 0
        for record in records:
            # Create a dictionary of the record's data
            record_dict = {}
            for column in model_class.__table__.columns:
                record_dict[column.name] = getattr(record, column.name)

            # Create new instance for PostgreSQL
            new_record = model_class(**record_dict)
            postgres_session.merge(new_record)
            migrated_count += 1

            if migrated_count % 100 == 0:
                postgres_session.flush()
                print(f"  ... migrated {migrated_count} records")

        postgres_session.commit()
        print(f"  ✓ Successfully migrated {migrated_count} records from {table_name}")
        return migrated_count

    except Exception as e:
        print(f"  ✗ Error migrating {table_name}: {e}")
        postgres_session.rollback()
        raise


def verify_migration(sqlite_session, postgres_session, model_classes):
    """Verify that migration was successful"""
    print("\n" + "="*60)
    print("MIGRATION VERIFICATION")
    print("="*60)

    all_match = True
    for model_class in model_classes:
        table_name = model_class.__tablename__
        sqlite_count = sqlite_session.query(model_class).count()
        postgres_count = postgres_session.query(model_class).count()

        status = "✓" if sqlite_count == postgres_count else "✗"
        print(f"{status} {table_name:25s} SQLite: {sqlite_count:5d} | PostgreSQL: {postgres_count:5d}")

        if sqlite_count != postgres_count:
            all_match = False

    print("="*60)
    if all_match:
        print("✓ All tables migrated successfully!")
    else:
        print("✗ Some tables have mismatched record counts!")
    print("="*60)

    return all_match


def main():
    """Main migration function"""
    print("="*60)
    print("SQLite to PostgreSQL Migration")
    print("="*60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # Define migration order (respect foreign key dependencies)
    models_to_migrate = [
        (User, "users"),
        (UserProfile, "user_profiles"),
        (ChatSession, "chat_sessions"),
        (ChatMessage, "chat_messages"),
        (Resume, "resumes"),
        (UserActivity, "user_activities"),
        (CareerInsight, "career_insights"),
        (DailyRecommendation, "daily_recommendations"),
    ]

    try:
        # Connect to databases
        sqlite_engine, sqlite_session = get_sqlite_connection()
        postgres_engine, postgres_session = get_postgres_connection()

        # Verify SQLite has data
        sqlite_tables = get_table_names(sqlite_engine)
        print(f"\nSQLite tables found: {', '.join(sqlite_tables)}")

        # Create tables in PostgreSQL
        create_tables(postgres_engine)

        # Verify PostgreSQL tables created
        postgres_tables = get_table_names(postgres_engine)
        print(f"PostgreSQL tables created: {', '.join(postgres_tables)}")

        # Migrate data table by table
        print("\n" + "="*60)
        print("STARTING DATA MIGRATION")
        print("="*60)

        total_records = 0
        for model_class, table_name in models_to_migrate:
            count = migrate_table(model_class, sqlite_session, postgres_session, table_name)
            total_records += count

        print("\n" + "="*60)
        print(f"Total records migrated: {total_records}")
        print("="*60)

        # Verify migration
        model_classes = [model_class for model_class, _ in models_to_migrate]
        success = verify_migration(sqlite_session, postgres_session, model_classes)

        # Close connections
        sqlite_session.close()
        postgres_session.close()

        print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        if success:
            print("\n✓ Migration completed successfully!")
            print("\nNext steps:")
            print("1. Verify the application works with PostgreSQL")
            print("2. Test critical user workflows")
            print("3. Keep SQLite backup at /home/idii/data/database/app.db")
            return 0
        else:
            print("\n✗ Migration completed with warnings. Please review the counts above.")
            return 1

    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
