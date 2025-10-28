from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import logging
import sys
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

# Load environment variables from .env.dev file
# This is crucial for Personal Assistant to access SECRET_KEY for JWT validation
env_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env.dev'))
if os.path.exists(env_path):
    load_dotenv(env_path)
    logging.info(f"✓ Loaded environment variables from {env_path}")
else:
    logging.warning(f"⚠ .env.dev not found at {env_path}, using system environment variables")

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.personal_assistant.api import router as chat_router
from backend.personal_assistant.chat_service import get_chat_service
from backend.personal_assistant.notification_service import router as notification_router

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
    logger.info("Starting Personal Assistant Chat API...")

    try:
        # Initialize chat service
        chat_service = get_chat_service()

        # Perform health check
        health_status = await chat_service.health_check()

        if health_status["status"] == "healthy":
            logger.info("Chat service initialized successfully")
            logger.info(f"Model: {health_status['model']}")
            logger.info(f"Base URL: {health_status['base_url']}")
        else:
            logger.warning(f"Chat service health check failed: {health_status.get('error', 'Unknown error')}")
            logger.warning("API will still start, but chat functionality may be limited")

    except Exception as e:
        logger.error(f"Failed to initialize chat service: {str(e)}", exc_info=True)
        logger.warning("API will still start, but chat functionality may be limited")

    yield

    # ==================== SHUTDOWN ====================
    logger.info("Shutting down Personal Assistant Chat API...")

    # Gracefully shutdown chat service and release resources
    try:
        chat_service = get_chat_service()
        if chat_service is not None:
            logger.info("Shutting down chat service...")
            chat_service.shutdown()
            logger.info("Chat service shutdown completed successfully")
        else:
            logger.info("Chat service was not initialized, skipping shutdown")
    except Exception as e:
        logger.error(f"Error during chat service shutdown: {str(e)}", exc_info=True)
        logger.warning("Chat service may not have shut down cleanly")

    logger.info("Personal Assistant Chat API shutdown complete")

# Create FastAPI application
app = FastAPI(
    title="Personal Assistant Chat API",
    description="AI-powered chat API using local Ollama LLM with Langchain integration",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1000",  # React development server (dev mode)
        "http://127.0.0.1:1000",
        "http://localhost:3000",  # React development server (container mode)
        "http://127.0.0.1:3000",
        "http://localhost:8000",  # Main backend server
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat_router)
app.include_router(notification_router)

# Root endpoint
@app.get("/")
async def root():
    """
    Root endpoint providing API information.
    """
    return {
        "message": "Personal Assistant Chat API",
        "version": "1.0.0",
        "description": "AI-powered chat API using local Ollama LLM",
        "endpoints": {
            "chat": "/api/chat/message",
            "health": "/api/chat/health",
            "history": "/api/chat/history",
            "clear_memory": "/api/chat/memory",
            "models": "/api/chat/models",
            "notifications": "/api/notifications/stream/{user_id}",
            "notification_history": "/api/notifications/history/{user_id}",
            "docs": "/docs",
            "redoc": "/redoc"
        }
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Global exception handler for unhandled errors.
    """
    logger.error(f"Unhandled exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal server error",
            "message": "An unexpected error occurred. Please try again later."
        }
    )

# Health check endpoint
@app.get("/health")
async def api_health():
    """
    API health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "Personal Assistant Chat API",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    logger.info("Starting Personal Assistant Chat API server...")
    logger.info("Make sure Ollama is running on ollama-staging:11434")
    logger.info("API will be available at http://localhost:8001")
    logger.info("API documentation at http://localhost:8001/docs")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )
