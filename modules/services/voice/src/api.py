import os
import tempfile
import time

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel
from typing import Optional

from modules.services.voice.src.stt_service import STTService

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
MIN_FILE_SIZE = 1000  # ~1 KB — below this is certainly silence


class TranscribeResponse(BaseModel):
    success: bool
    text: Optional[str] = None
    language: Optional[str] = None
    duration: Optional[float] = None
    processing_time: float = 0.0
    error: Optional[str] = None


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("audio/"):
        raise HTTPException(400, "File must be an audio format")

    start = time.time()
    temp_path = None

    try:
        content = await file.read()

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(413, f"File too large ({len(content)} bytes). Max: {MAX_FILE_SIZE}")

        # Skip tiny blobs — too short to contain meaningful speech
        if len(content) < MIN_FILE_SIZE:
            return TranscribeResponse(
                success=True,
                text="",
                duration=0.0,
                processing_time=round(time.time() - start, 2),
            )

        suffix = ".mp4" if file.content_type and "mp4" in file.content_type else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            temp_path = tmp.name

        stt = STTService.get_instance()
        result = await stt.transcribe(temp_path)

        return TranscribeResponse(
            success=True,
            text=result["text"],
            language=result["language"],
            duration=result["duration"],
            processing_time=round(time.time() - start, 2),
        )
    except HTTPException:
        raise
    except Exception as e:
        return TranscribeResponse(
            success=False,
            error=str(e),
            processing_time=round(time.time() - start, 2),
        )
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@router.get("/health")
async def health():
    stt = STTService.get_instance()
    return {
        "status": "healthy",
        "device": stt.device,
        "model": os.getenv("WHISPER_MODEL_SIZE", "base"),
    }
