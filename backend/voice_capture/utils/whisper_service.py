##GPU Optimized Singleton

import asyncio
import threading
from faster_whisper import WhisperModel
import torch
import os

DEVICE = "cuda:1" if torch.cuda.is_available() else "cpu"

WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "medium")

COMPUTE_TYPE = (
    "float16" if DEVICE == "cuda" else "int8"
)

MAX_BATCH_FILES = 50


# 🔐 GPU concurrency limiter
inference_semaphore = asyncio.Semaphore(4)

class WhisperService:
    instance = None
    lock = threading.Lock()

    def __init__(self):
        self.model = WhisperModel(
            WHISPER_MODEL_SIZE,
            device=DEVICE,
            compute_type=COMPUTE_TYPE
        )

    @classmethod
    def get_instance(cls):
        if cls.instance is None:
            with cls.lock:
                if cls.instance is None:
                    cls.instance = WhisperService()
        return cls.instance
    
    async def dictation(self, path: str):
        async with inference_semaphore:
            segments, info = self.model.transcribe(
            path,
            beam_size=1,
            best_of=1,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=300,
                speech_pad_ms=100 
            ),
            condition_on_previous_text=False
        )

        text = " ".join(seg.text for seg in segments).strip()

        return {
                "text": text,
                "language": info.language,
                "duration": info.duration,
            }
        