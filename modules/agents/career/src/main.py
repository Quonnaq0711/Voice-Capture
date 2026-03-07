from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import os
import sys
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env.dev file
# This is crucial for Career Agent to access SECRET_KEY for JWT validation
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '.env.dev'))
if os.path.exists(env_path):
    load_dotenv(env_path)
    logging.info(f"✓ Loaded environment variables from {env_path}")
else:
    logging.warning(f"⚠ .env.dev not found at {env_path}, using system environment variables")

# Add the backend directory to the Python path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..')))

# Import all models to ensure SQLAlchemy relationships are properly established
from backend.models.user import User
from backend.models.resume import Resume
from backend.models.career_insight import CareerInsight
from backend.models.profile import UserProfile
from backend.models.activity import UserActivity
from backend.models.daily_recommendation import DailyRecommendation
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.refresh_token import RefreshToken

from backend.voice_capture.api.vc import router as chat_router
from streaming_api import router as streaming_router
from chat_service import get_chat_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events with proper resource cleanup.
    """
    # ==================== STARTUP ====================
    logger.info("Starting Career Agent API...")

    yield

    # ==================== SHUTDOWN ====================
    logger.info("Shutting down Career Agent API...")

    # Gracefully shutdown chat service and release resources
    try:
        chat_service = get_chat_service()
        if chat_service is not None:
            logger.info("Shutting down career chat service...")
            chat_service.shutdown()
            logger.info("Career chat service shutdown completed successfully")
        else:
            logger.debug("Career chat service was not initialized, skipping shutdown")
    except Exception as e:
        logger.error(f"Error during career chat service shutdown: {str(e)}", exc_info=True)
        logger.warning("Career chat service may not have shut down cleanly")

    logger.info("Career Agent API shutdown complete")

app = FastAPI(
    title="Career Agent API",
    description="API for career agent, powered by a dedicated LLM.",
    version="1.0.0",
    lifespan=lifespan
)

# Include routers
app.include_router(chat_router)
app.include_router(streaming_router)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1000",  # React development server (dev mode)
        "http://127.0.0.1:1000",
        "http://localhost:3000",  # React development server (container mode)
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to the Career Agent API"}

if __name__ == "__main__":
    logger.info("Starting Career Agent API server...")
    logger.info("Make sure Ollama is running on ollama2-staging:11434")
    logger.info("API will be available at http://localhost:8002")
    logger.info("API documentation at http://localhost:8002/docs")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )