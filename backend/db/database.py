import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Ensure db directory exists
DB_DIR = os.path.dirname(os.path.abspath(__file__))
os.makedirs(DB_DIR, exist_ok=True)

# Database URL
SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(DB_DIR, 'app.db')}"

# Create database engine
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite specific configuration
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create Base class
Base = declarative_base()

# Get database session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()