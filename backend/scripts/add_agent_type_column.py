#!/usr/bin/env python3
"""
Migration script to add agent_type column to chat_messages table
"""

import sqlite3
import os
from pathlib import Path

def add_agent_type_column():
    """
    Add agent_type column to chat_messages table with default value 'dashboard'
    """
    # Get the database path
    db_path = Path(__file__).parent.parent / "db" / "app.db"
    
    if not db_path.exists():
        print(f"Database file not found at {db_path}")
        return False
    
    try:
        # Connect to the database
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if agent_type column already exists
        cursor.execute("PRAGMA table_info(chat_messages)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'agent_type' in columns:
            print("agent_type column already exists in chat_messages table")
            conn.close()
            return True
        
        # Add the agent_type column with default value 'dashboard'
        cursor.execute("""
            ALTER TABLE chat_messages 
            ADD COLUMN agent_type VARCHAR DEFAULT 'dashboard'
        """)
        
        # Update existing records to have 'dashboard' as agent_type
        cursor.execute("""
            UPDATE chat_messages 
            SET agent_type = 'dashboard' 
            WHERE agent_type IS NULL
        """)
        
        # Commit the changes
        conn.commit()
        conn.close()
        
        print("Successfully added agent_type column to chat_messages table")
        return True
        
    except Exception as e:
        print(f"Error adding agent_type column: {str(e)}")
        if 'conn' in locals():
            conn.close()
        return False

if __name__ == "__main__":
    success = add_agent_type_column()
    if success:
        print("Migration completed successfully")
    else:
        print("Migration failed")
        exit(1)