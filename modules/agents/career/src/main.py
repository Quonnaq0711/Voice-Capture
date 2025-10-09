from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import logging
import os
import sys

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

from api import router as chat_router
from streaming_api import router as streaming_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Career Agent API",
    description="API for career agent, powered by a dedicated LLM.",
    version="1.0.0"
)

# Include routers
app.include_router(chat_router)
app.include_router(streaming_router)

# Configure CORS

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], # Adjust as needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Welcome to the Career Agent API"}

if __name__ == "__main__":
    logger.info("Starting Career Agent API server...")
    logger.info("Make sure Ollama is running on ollama2-staging:11435")
    logger.info("API will be available at http://localhost:8002")
    logger.info("API documentation at http://localhost:8002/docs")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level="info"
    )