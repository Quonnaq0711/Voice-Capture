import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Get database type from environment
DB_TYPE = os.getenv("DB_TYPE", "sqlite")  # Default to sqlite for backward compatibility

if DB_TYPE == "postgresql":
    # PostgreSQL configuration
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST = os.getenv("DB_HOST", "db-staging")  # Docker service name
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "productdb-staging")

    SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

    # PostgreSQL engine configuration
    # Optimized for 500-1000 concurrent users
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=50,           # Connection pool size (increased from 10)
        max_overflow=100,       # Max connections beyond pool_size (increased from 20)
        pool_pre_ping=True,     # Verify connection health before using
        pool_recycle=3600,      # Recycle connections after 1 hour
        pool_timeout=30,        # Wait 30s for connection before timeout
        echo=False              # Disable SQL logging in production
    )
else:
    # SQLite configuration (for development and backward compatibility)
    DB_PATH = os.getenv("DATABASE_PATH", None)
    if DB_PATH:
        # Convert relative path to absolute if needed
        if not os.path.isabs(DB_PATH):
            # Get project root (2 levels up from backend/db/database.py)
            PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            DB_PATH = os.path.join(PROJECT_ROOT, DB_PATH)

        # Use environment-specified path (e.g., /app/db/app.db for Docker volumes)
        DB_DIR = os.path.dirname(DB_PATH)
        os.makedirs(DB_DIR, exist_ok=True)
        SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"
    else:
        # Default to local backend/db directory for development
        DB_DIR = os.path.dirname(os.path.abspath(__file__))
        os.makedirs(DB_DIR, exist_ok=True)
        SQLALCHEMY_DATABASE_URL = f"sqlite:///{os.path.join(DB_DIR, 'app.db')}"

    # SQLite engine configuration
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