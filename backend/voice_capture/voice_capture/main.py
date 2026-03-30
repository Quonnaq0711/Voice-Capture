import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pyttsx3
import torch
from faster_whisper import WhisperModel

from backend.voice_capture.api import vc

app = FastAPI(
    title="Voice Capture",
    description="Gpu Enabled Voice Capturing",
    version="1.0.0"
)

# CORS Config
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:1000",
        "http://127.0.0.1:1000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router
app.include_router(
    vc.router,
    prefix="/api/v1/vc",
    tags=["vc", "voice-capture"]
)

# GPU Check
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device {device}")

# Load Whisper
whisper_model = WhisperModel(
    "base",
    device=device,
    compute_type="float16" if device == "cuda" else "int8"
)

# Init TTS
tts_engine = pyttsx3.init()
tts_engine.setProperty("rate", 150)


@app.get("/")
async def root():
    return {
        "message": "Voice Capture API",
        "version": "1.0.0",
        "description": "AI powered Gpu backed voice capturing with TTS, STT, and transcription",
        "device": device,
        "models": {
            "stt": "Faster-Whisper",
            "tts": "pyttsx3",
            "llm": "Gemma3 (Ollama)"
        },
        "endpoints": {
            "transcribe": "POST /transcribe",
            "synthesize": "POST /speech",
            "chat": "POST /chat",
            "voice_chat": "POST /voice-chat",
            "batch_transcribe": "POST /batch",
            "gpu_status": "GET /status",
            "health": "GET /health"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.voice_capture.main:app",
        host="0.0.0.0",
        port=9000,
        reload=True,
    )
