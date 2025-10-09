from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from backend.api import auth, chat, profile, sessions, activities, career_insights, daily_recommendations
from backend.models.user import Base
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.resume import Resume
from backend.models.profile import UserProfile
from backend.models.activity import UserActivity
from backend.models.career_insight import CareerInsight
from backend.models.daily_recommendation import DailyRecommendation
from backend.services.email_service import EmailService
from backend.services.otp_service import OTPService
from backend.services.scheduler_service import daily_scheduler
from backend.db.database import engine
import os


# Create database tables
Base.metadata.create_all(bind=engine)

# Create FastAPI application
app = FastAPI(
    title="Sadaora AI Assistant Platform",
    description="Backend API for Sadaora AI Assistant Platform",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Should set specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
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

# Mount static files for avatars
avatar_dir = os.path.join(os.path.dirname(__file__), "avatars")
os.makedirs(avatar_dir, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=avatar_dir), name="avatars")

# Mount static files for resumes
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

# Startup event to initialize the scheduler
@app.on_event("startup")
async def startup_event():
    """Initialize background tasks on startup"""
    try:
        daily_scheduler.start()
    except Exception as e:
        print(f"Warning: Failed to start daily recommendation scheduler: {e}")

# Shutdown event to clean up the scheduler
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up background tasks on shutdown"""
    try:
        daily_scheduler.stop()
    except Exception as e:
        print(f"Warning: Failed to stop daily recommendation scheduler: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
