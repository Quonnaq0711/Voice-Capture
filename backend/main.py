from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from .api import auth, chat, profile, sessions
from .models.user import Base
from .models.chat import ChatMessage
from .models.session import ChatSession
from .models.resume import Resume
from .models.profile import UserProfile
from .db.database import engine
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)