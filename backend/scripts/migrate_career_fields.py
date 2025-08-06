import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from backend.db.database import SQLALCHEMY_DATABASE_URL

def migrate_career_fields():
    """Add new career-related fields to user_profiles table"""
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    # List of new columns to add
    new_columns = [
        # Basic Information
        "ADD COLUMN company VARCHAR",
        "ADD COLUMN work_style VARCHAR", 
        "ADD COLUMN leadership_experience VARCHAR",
        
        # Skills & Competencies
        "ADD COLUMN soft_skills JSON",
        "ADD COLUMN certifications JSON",
        "ADD COLUMN skill_gaps JSON",
        
        # Goals & Aspirations
        "ADD COLUMN short_term_goals TEXT",
        "ADD COLUMN career_path_preference VARCHAR",
        "ADD COLUMN target_industries JSON",
        
        # Work Preferences & Values
        "ADD COLUMN work_life_balance_priority VARCHAR",
        "ADD COLUMN company_size_preference VARCHAR",
        "ADD COLUMN career_risk_tolerance VARCHAR",
        "ADD COLUMN geographic_flexibility VARCHAR",
        "ADD COLUMN work_values JSON",
        
        # Challenges & Development
        "ADD COLUMN career_challenges TEXT",
        "ADD COLUMN professional_strengths JSON",
        "ADD COLUMN growth_areas JSON",
        "ADD COLUMN learning_preferences JSON"
    ]
    
    with engine.connect() as connection:
        # Check if table exists
        result = connection.execute(text(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='user_profiles'"
        ))
        
        if not result.fetchone():
            print("user_profiles table does not exist. Please run create_tables.py first.")
            return
        
        # Get existing columns
        existing_columns = connection.execute(text("PRAGMA table_info(user_profiles)")).fetchall()
        existing_column_names = [col[1] for col in existing_columns]
        
        print(f"Found {len(existing_column_names)} existing columns in user_profiles table")
        
        # Add new columns one by one
        added_count = 0
        for column_def in new_columns:
            column_name = column_def.split()[2]  # Extract column name
            
            if column_name not in existing_column_names:
                try:
                    alter_sql = f"ALTER TABLE user_profiles {column_def}"
                    connection.execute(text(alter_sql))
                    connection.commit()
                    print(f"Added column: {column_name}")
                    added_count += 1
                except Exception as e:
                    print(f"Error adding column {column_name}: {e}")
            else:
                print(f"Column {column_name} already exists, skipping")
        
        print(f"\nMigration completed. Added {added_count} new columns.")

if __name__ == "__main__":
    migrate_career_fields()
    print("Career fields migration completed successfully!")