#!/usr/bin/env python3
"""
Fix PostgreSQL Sequences After SQLite Migration

When migrating from SQLite to PostgreSQL, the auto-increment sequences
need to be manually updated to match the max ID in each table.

This script fixes all sequences for migrated tables.
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

from sqlalchemy import create_engine, text

def fix_sequences():
    """Fix all sequences in PostgreSQL"""

    # Connect to PostgreSQL
    engine = create_engine(
        "postgresql://postgres:postgres@localhost:5432/productdb-staging"
    )

    # Tables and their sequence names
    tables = [
        ('users', 'users_id_seq'),
        ('user_profiles', 'user_profiles_id_seq'),
        ('chat_sessions', 'chat_sessions_id_seq'),
        ('chat_messages', 'chat_messages_id_seq'),
        ('resumes', 'resumes_id_seq'),
        ('user_activities', 'user_activities_id_seq'),
        ('career_insights', 'career_insights_id_seq'),
        ('daily_recommendations', 'daily_recommendations_id_seq'),
    ]

    print("="*60)
    print("Fixing PostgreSQL Sequences")
    print("="*60)
    print()

    with engine.connect() as conn:
        for table_name, sequence_name in tables:
            try:
                # Get the current max ID
                result = conn.execute(text(f"SELECT MAX(id) FROM {table_name}"))
                max_id = result.scalar()

                if max_id is None:
                    print(f"⚠️  {table_name}: No records, skipping")
                    continue

                # Set the sequence to max_id + 1
                new_value = max_id + 1
                conn.execute(text(f"SELECT setval('{sequence_name}', {new_value}, false)"))
                conn.commit()

                # Verify the sequence
                result = conn.execute(text(f"SELECT last_value FROM {sequence_name}"))
                current_value = result.scalar()

                print(f"✓ {table_name:25s} max_id={max_id:4d} → sequence={current_value}")

            except Exception as e:
                print(f"✗ {table_name:25s} ERROR: {e}")

    print()
    print("="*60)
    print("✓ All sequences fixed successfully!")
    print("="*60)
    print()
    print("You can now insert new records without primary key conflicts.")
    print()

if __name__ == "__main__":
    fix_sequences()
