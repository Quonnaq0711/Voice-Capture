import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pyttsx3
import torch
from faster_whisper import WhisperModel
import sys
import uvicorn

#Python path addition in project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))


app = FastAPI(title="Voice Capture",
              description="Gpu Enabled Voice Capturing",
              version="1.0.0"
              )

# Cors Config
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

# Router
app.include_router(vc)

# GPU Check
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device {device}") 

# Load Whisper
whisper_model = WhisperModel("base", device=device, compute_type="float16" if device == "cuda" else "int8")

# Init TTS
tts_engine = pyttsx3.init()
tts_engine.setProperty("rate", 150)



@app.get("/")
async def root():
    """"
    Base Endpoint 
    """
    return{
        "message": "Voice Capture API", 
        "version": "1.0.0",
        "description": "AI powered Gpu backed voice capturing with TTS, STT, and transcription",
        "device": device ,
        "models": {
            "stt": "Faster-Whisper",
            "tts": "pyttsx3",
            "llm": "Gemma3 (Ollama)"
        }
  }

uvicorn.run(
    "main:app",
    host="0.0.0.0",
    port=9000
)