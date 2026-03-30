"""
Work Agent - FastAPI Application Entry Point

Runs on port 8003 and provides:
- AI Chat with Work Assistant (LangGraph multi-agent)
- Direct Todo CRUD operations
- Health check endpoint

Usage:
    uvicorn modules.agents.work.src.main:app --host 0.0.0.0 --port 8003 --reload
"""
import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

# Load environment variables
from dotenv import load_dotenv
env_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env.dev')
if os.path.exists(env_path):
    load_dotenv(env_path)

# Import after path setup
from modules.agents.work.src.api import router as work_router
from modules.agents.work.tools.notebook.api import router as notebook_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    logger.info("=" * 50)
    logger.info("Work Agent starting up...")
    logger.info(f"Port: {os.getenv('WORK_PORT', 8003)}")
    logger.info(f"vLLM Model: {os.getenv('VLLM_MODEL', 'Qwen/Qwen2.5-3B-Instruct')}")
    logger.info(f"vLLM API Base: {os.getenv('VLLM_API_BASE', 'http://localhost:8888/v1')}")
    logger.info("=" * 50)

    # Ensure database tables exist
    try:
        from backend.db.database import engine
        from backend.models import Base
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created")

        # Migrate: add ai_content_summary columns to resumes table if missing
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if 'resumes' in inspector.get_table_names():
            existing_cols = {c['name'] for c in inspector.get_columns('resumes')}
            with engine.begin() as conn:
                if 'ai_content_summary' not in existing_cols:
                    conn.execute(text("ALTER TABLE resumes ADD COLUMN ai_content_summary TEXT"))
                    logger.info("Added ai_content_summary column to resumes table")
                if 'ai_summary_updated_at' not in existing_cols:
                    conn.execute(text("ALTER TABLE resumes ADD COLUMN ai_summary_updated_at DATETIME"))
                    logger.info("Added ai_summary_updated_at column to resumes table")
    except Exception as e:
        logger.warning(f"Database setup warning: {e}")

    yield

    # Shutdown
    logger.info("Work Agent shutting down...")


# Create FastAPI application
app = FastAPI(
    title="Work Agent API",
    description="""
    AI-powered Work Assistant for daily task management.

    Features:
    - Natural language chat interface
    - Todo list management (CRUD)
    - Task prioritization
    - Daily planning assistance

    Built with LangGraph multi-agent architecture using vLLM.
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
origins = [
    "http://localhost:1000",  # Dev frontend
    "http://localhost:3000",  # Container frontend
    "http://localhost:5000",  # Dev backend
    "http://localhost:8000",  # Container backend
    "http://localhost:8003",  # Self
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(work_router)
app.include_router(notebook_router, prefix="/api/work/notebook", tags=["notebook"])


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service info."""
    return {
        "service": "Work Agent",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/api/work/health"
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("WORK_PORT", 8003))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )
