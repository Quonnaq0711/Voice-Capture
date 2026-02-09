from multiprocessing import context
import os
import sys
from faster_whisper import WhisperModel
import ollama
import pyttsx3
import torch
import base64
import tempfile
from pydantic import BaseModel
from fastapi import APIRouter, File, UploadFile, WebSocket

from backend.voice_capture.utils.llm_async import chat_async
from backend.voice_capture.utils.stt_async import transcribe_async
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