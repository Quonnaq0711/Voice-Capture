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

        segments, info = whisper_model.transcribe(tmp_path, beam_size=5)
        transcribe = " ".join([seg.text for seg in segments])
        os.unlink(tmp_path)

        return{
            "success": True,
            "transcript": transcribe,
            "language":info.language
        }
    except Exception as e:
        return {"success" : False, "error":str(e)}
    

@router.post("/speech")
async def speech_synthesis(request: TextRequest):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tts_engine.save_to_file(request.text, tmp.name)
            tts_engine.runAndWait()

            with open(tmp.name, 'rb') as f:
                audio_data = f.read()
            os.unlink(tmp.name)

        base64_audio = base64.b64encode(audio_data).decode('utf-8')
        return {'success': True, "audio": base64_audio}
    except Exception as e:
        return {'success': False, 'error': str(e)}
    

@router.post('/chat')
async def ollama_chat(request: ChatRequest):
    try:
        message = request.content + [{"role": "user", "content": request.message}]
        response = ollama.chat(model='gemma3:lastest', messages=message)
        return{'success':True, 'response': response['message']['content']}
    except Exception as e:
        return{'success':False, 'error': str(e)}
    

@router.post("/voice-chat")
async def voice_chat(file: UploadFile = File(...)):
    try:
        # STT
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name

            segments, _ = whisper_model.transcibe(tmp_path)
            transcribe = " ".join([seg.text for seg in segments])
            os.unlik(tmp_path)

        # LLM
        res = ollama.chat(
            model='gemma3:latest',
            messages=[{'role':'user', 'content': transcribe}]
        )
        llm_res = res['meaasge']['content']

        # TTS
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
            tts_engine.save_to_file(llm_res, tmp.name)
            tts_engine.runAndWait()

            with open(tmp.name, 'rb') as f:
                audio_data = f.read()
                os.unlink(tmp.name)

        return{
            "success":True,
            "user_transcribe": transcribe,
            "llm_res": llm_res,
            "res_audio": base64.b64encode(audio_data).decode('utf-8')
        }
    except Exception as e:
        return{"success": False, "error": str(e)}