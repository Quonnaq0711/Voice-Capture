import sqlite3
import os

def add_unread_to_sessions():
    """
    Add unread column to chat_sessions table
    """
    db_path = os.path.join(os.path.dirname(__file__), '..', 'db', 'app.db')
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if unread column exists
        cursor.execute("PRAGMA table_info(chat_sessions)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'unread' not in columns:
            cursor.execute('''
                ALTER TABLE chat_sessions 
                ADD COLUMN unread BOOLEAN DEFAULT FALSE
            ''')
            print("Added unread column to chat_sessions table")
        else:
            print("unread column already exists in chat_sessions table")
        
        conn.commit()
        
    except sqlite3.Error as e:
        print(f"Database error: {e}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    add_unread_to_sessions()