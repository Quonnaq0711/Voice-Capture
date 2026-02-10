from multiprocessing import context
import os
import sys
import time
from typing import Optional, List, final
from faster_whisper import WhisperModel
from langchain_text_splitters import Language
import ollama
import pyttsx3
from sympy import N
import torch
import base64
import tempfile
from pydantic import BaseModel
from fastapi import APIRouter, File, HTTPException, UploadFile, WebSocket

from backend.voice_capture.utils.llm_async import chat_async
from backend.voice_capture.utils.stt_async import transcribe_async, transcribe_files_async
from backend.voice_capture.utils.tts_async import synthesize_async


# Python path addition in project root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))


router = APIRouter(prefix="api/vc", tags=["vc", "voice capture"])

# GPU Check
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device {device}") 

# Load Whisper
whisper_model = WhisperModel("base", device=device, compute_type="float16" if device == "cuda" else "int8")

# Init TTS
tts_engine = pyttsx3.init()
tts_engine.setProperty("rate", 150)



# Response/Request Models
class TextRequest(BaseModel):
    text: str

class ChatRequest(BaseModel):
    message: str
    context: list = []

class TranscribeResult(BaseModel):
    filename: str
    success: bool
    transcribe: Optional[str] = None
    language: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None

class BatchTranscribeResponse(BaseModel):
    success: bool
    total_files: int
    successful: int
    failed: int
    results: List[TranscribeResult]
    total_processing_time: float
    device_used: str

class GPUStatusResponse(BaseModel):
    gpu_avaliable: bool
    gpu_name: Optional[str] = None
    memory_used_gb: Optional[str] = None
    memory_reserved_gb: Optional[str] = None
    memory_total_gb: Optional[str] = None
    usage_percentage: Optional[str] = None
    cuda_version: Optional[str] = None



@router.post("/transcribe")
async def audio_transcription(file:UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        text, language = await transcribe_async(
           whisper_model,
           tmp_path
       )
        os.unlink(tmp_path)

        return{
            "success": True,
            "transcript": text,
            "language": language
        }
    
    except Exception as e:
        return {"success" : False, "error": str(e)}


@router.post("/batch", response_model=BatchTranscribeResponse)
async def batch_transcribe(files: List[UploadFile] = File(...)):

    if not files:
        raise HTTPException(
            status_code=400,
            detail= "No files provided"
        )
    if len(files) > 50:
        raise HTTPException(
            status_code=400,
            detail="Maximum of 50 files per batch allowed"
        )
    
    res = []
    start_time = time.time()
    successful_count = 0
    failed_count = 0

    for file in files:
        temp_path = None

        try:
            if not file.content_type or not file.content_type.startswith("audio/"):
                res.append(TranscribeResult(
                    filename=file.filename,
                    success=False,
                    error="Invalid file type - Only audio file supported "
                ))
                failed_count += 1
                continue


            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
                data = await file.read()
                tmp.write(data)
                temp_path = tmp.name

            
            transcript,language, duration = await transcribe_files_async(
                whisper_model,
                temp_path
            )

            res.append(TranscribeResult(
                filename=file.filename,
                success=True,
                transcript=transcript,
                language=language,
                duration=duration
            ))
            successful_count += 1

        except Exception as e:
            res.append(TranscribeResult(
                filename=file.filename,
                success=False,
                error=str(e)
            ))
            failed_count += 1

        finally:
            if temp_path and os.path.exists(temp_path):
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass

    total_time = round(time.time() - start_time, 2)

    return BatchTranscribeResponse(
        success=True,
        total_files=len(files),
        successfu=successful_count,
        failed=failed_count,
        results=res,
        total_processing_time=total_time,
        device_used=device
    )

@router.post("/speech")
async def speech_synthesis(request: TextRequest):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            await synthesize_async(
                request.text,
                request.voice,
                tmp.name
            )

            with open(tmp.name, 'rb') as f:
                audio_data = f.read()

        os.unlink(tmp.name)

        base64_audio = base64.b64encode(audio_data).decode('utf-8')
        return {'success': True, "audio": base64_audio}
    
    except Exception as e:
        return {'success': False, 'error': str(e)}
    

@router.post("/chat")
async def ollama_chat(request: ChatRequest):
    try:
        message = request.content + [{"role": "user", "content": request.message}]
        response = chat_async(
            model="gemma3:lastest",
            messages=message
            )


        return{"success":True, "response": response}
    
    except Exception as e:
        return{"success":False, "error": str(e)}
    

@router.post("/voice-chat")
async def voice_chat(file: UploadFile = File(...)):
    try:
        # STT
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(await file.read())
            wav_path = tmp.name

        user_text, _ = await transcribe_async(
                whisper_model,
                wav_path
            )
        
        os.unlink(wav_path)

        # LLM
        llm_res = await chat_async(
            model='gemma3:latest',
            messages=[{'role':'user', 'content': user_text}]
        )
        

        # TTS
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            await synthesize_async(
                llm_res,
                None,
                tmp.name
            )            

            with open(tmp.name, 'rb') as f:
                audio_data = f.read()

        os.unlink(tmp.name)

        return{
            "success":True,
            "user_transcribe": user_text,
            "llm_res": llm_res,
            "res_audio": base64.b64encode(audio_data).decode('utf-8')
        }
    except Exception as e:
        return{"success": False, "error": str(e)}