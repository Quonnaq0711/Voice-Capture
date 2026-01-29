from fastapi import FastAPI,File, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import torch
from faster_whisper import WhisperModel
import ollama

app = FastAPI(title="Coqui_TTS")

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