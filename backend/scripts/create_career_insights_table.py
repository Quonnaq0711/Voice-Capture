import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, MetaData, Table
from sqlalchemy.sql import text
from datetime import datetime
from db.database import engine

def create_career_insights_table():
    # Create metadata object
    metadata = MetaData()
    
    # Define career_insights table
    career_insights = Table(
        "career_insights",
        metadata,
        Column("id", Integer, primary_key=True),
        Column("user_id", Integer, ForeignKey("users.id")),
        Column("resume_id", Integer, ForeignKey("resumes.id")),
        Column("professional_data", Text),
        Column("created_at", DateTime, default=datetime.utcnow),
        Column("updated_at", DateTime, default=datetime.utcnow)
    )
    
    # Create the table
    metadata.create_all(engine, tables=[career_insights])
    print("Career insights table created successfully.")

if __name__ == "__main__":
    create_career_insights_table()