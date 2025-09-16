import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from models.user import Base as UserBase
from models.resume import Resume
from models.chat import ChatMessage
from models.session import ChatSession
from models.profile import UserProfile
from db.database import SQLALCHEMY_DATABASE_URL
import argparse

def create_tables(force=False):
    # Create database engine
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    
    if force:
        # Drop all tables first
        UserBase.metadata.drop_all(bind=engine)
        print("Dropped existing tables.")
    
    # Create all tables
    UserBase.metadata.create_all(bind=engine)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Create database tables')
    parser.add_argument('--force', action='store_true', help='Drop existing tables before creating new ones')
    args = parser.parse_args()
    
    create_tables(force=args.force)
    print("Database tables created successfully!")