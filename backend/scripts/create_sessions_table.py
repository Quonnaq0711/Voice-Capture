import sqlite3
import os
from datetime import datetime

def create_sessions_table():
    """
    Create sessions table to manage chat sessions
    """
    db_path = os.path.join(os.path.dirname(__file__), '..', 'db', 'app.db')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_name VARCHAR(255) NOT NULL,
                first_message_time DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_active BOOLEAN DEFAULT FALSE,
                unread BOOLEAN DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        # Add session_id column to chat_messages table if it doesn't exist
        cursor.execute("PRAGMA table_info(chat_messages)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'session_id' not in columns:
            cursor.execute('''
                ALTER TABLE chat_messages 
                ADD COLUMN session_id INTEGER REFERENCES chat_sessions(id)
            ''')
            print("Added session_id column to chat_messages table")
        
        # Add unread column if not exists
        cursor.execute("PRAGMA table_info(chat_sessions)")
        columns = [column[1] for column in cursor.fetchall()]
        if 'unread' not in columns:
            cursor.execute('''
                ALTER TABLE chat_sessions 
                ADD COLUMN unread BOOLEAN DEFAULT 0
            ''')
            print("Added unread column to chat_sessions table")

        # Create index for better performance
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id 
            ON chat_sessions (user_id)
        ''')
        
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id 
            ON chat_messages (session_id)
        ''')
        
        conn.commit()
        print("Sessions table created successfully!")
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    create_sessions_table()