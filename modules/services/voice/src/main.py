import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure project root is in path for module imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))))

from modules.services.voice.src.api import router

app = FastAPI(title="Voice STT Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:1000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {
        "service": "Voice STT",
        "version": "1.0.0",
        "endpoints": {
            "transcribe": "POST /api/voice/transcribe",
            "health": "GET /api/voice/health",
        },
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("VOICE_PORT", "6003"))
    uvicorn.run(
        "modules.services.voice.src.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
