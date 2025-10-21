from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.api import auth, chat, profile, sessions, activities, career_insights, daily_recommendations
from backend.models.user import Base
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.resume import Resume
from backend.models.profile import UserProfile
from backend.models.refresh_token import RefreshToken
from backend.services.email_service import EmailService
from backend.services.otp_service import OTPService
from backend.models.activity import UserActivity
from backend.models.career_insight import CareerInsight
from backend.models.daily_recommendation import DailyRecommendation
from backend.services.scheduler_service import daily_scheduler
from backend.db.database import engine
from backend.config.cors_config import (
    get_allowed_origins,
    get_allowed_methods,
    log_cors_configuration
)
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI application
app = FastAPI(
    title="Idii. AI Assistant Platform",
    description="Backend API for Idii. AI Assistant Platform",
    version="1.0.0"
)

# Configure CORS based on environment
allowed_origins = get_allowed_origins()
allowed_methods = get_allowed_methods()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=allowed_methods,
    allow_headers=["*"],  # Allow all headers for flexibility
)

# Log CORS configuration for debugging
log_cors_configuration(allowed_origins)

# Include routes with /api/v1 prefix (primary routes)
app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["authentication"]
)

app.include_router(
    chat.router,
    prefix="/api/v1/chat",
    tags=["chat"]
)

app.include_router(
    profile.router,
    prefix="/api/v1",
    tags=["profile"]
)

app.include_router(
    sessions.router,
    prefix="/api/v1/chat",
    tags=["sessions"]
)

app.include_router(
    activities.router,
    prefix="/api/v1",
    tags=["activities"]
)

app.include_router(
    career_insights.router,
    prefix="/api/v1",
    tags=["career_insights"]
)

app.include_router(
    daily_recommendations.router,
    prefix="/api/v1",
    tags=["daily_recommendations"]
)

# Also include routes with /v1 prefix (for development mode frontend compatibility)
app.include_router(
    auth.router,
    prefix="/v1/auth",
    tags=["authentication-v1"]
)

app.include_router(
    chat.router,
    prefix="/v1/chat",
    tags=["chat-v1"]
)

app.include_router(
    profile.router,
    prefix="/v1",
    tags=["profile-v1"]
)

app.include_router(
    sessions.router,
    prefix="/v1/chat",
    tags=["sessions-v1"]
)

app.include_router(
    activities.router,
    prefix="/v1",
    tags=["activities-v1"]
)

app.include_router(
    career_insights.router,
    prefix="/v1",
    tags=["career_insights-v1"]
)

app.include_router(
    daily_recommendations.router,
    prefix="/v1",
    tags=["daily_recommendations-v1"]
)

# Mount static files for avatars
# Use /app/avatars for Docker volume mount, fallback to backend/avatars for local dev
if os.path.exists("/app/avatars"):
    avatar_dir = "/app/avatars"
else:
    avatar_dir = os.path.join(os.path.dirname(__file__), "avatars")
    os.makedirs(avatar_dir, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=avatar_dir), name="avatars")

# Mount static files for resumes
# Use /app/resumes for Docker volume mount, fallback to backend/resumes for local dev
if os.path.exists("/app/resumes"):
    resume_dir = "/app/resumes"
else:
    resume_dir = os.path.join(os.path.dirname(__file__), "resumes")
    os.makedirs(resume_dir, exist_ok=True)
app.mount("/resumes", StaticFiles(directory=resume_dir), name="resumes")

# Health check endpoints
@app.get("/")
async def root():
    return {"message": "Sadaora AI Assistant Platform API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Configure logging
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Startup event to initialize the scheduler
@app.on_event("startup")
async def startup_event():
    """Initialize background tasks on startup"""
    logger.info("Starting backend application...")

    try:
        daily_scheduler.start()
        logger.info("Daily recommendation scheduler started successfully")
    except Exception as e:
        logger.error(f"Failed to start daily recommendation scheduler: {str(e)}", exc_info=True)
        logger.warning("Application will continue without scheduler")

# Shutdown event to clean up resources
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up background tasks and resources on shutdown"""
    logger.info("Shutting down backend application...")

    # Stop scheduler
    try:
        daily_scheduler.stop()
        logger.info("Daily recommendation scheduler stopped successfully")
    except Exception as e:
        logger.error(f"Failed to stop daily recommendation scheduler: {str(e)}", exc_info=True)

    # Shutdown chat service if initialized
    try:
        from backend.personal_assistant.chat_service import get_chat_service
        chat_service = get_chat_service()

        if chat_service is not None:
            logger.info("Shutting down chat service...")
            chat_service.shutdown()
            logger.info("Chat service shutdown completed successfully")
        else:
            logger.debug("Chat service was not initialized, skipping shutdown")

    except ImportError:
        logger.debug("Chat service module not available, skipping shutdown")
    except Exception as e:
        logger.error(f"Error during chat service shutdown: {str(e)}", exc_info=True)
        logger.warning("Chat service may not have shut down cleanly")

    logger.info("Backend application shutdown complete")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
