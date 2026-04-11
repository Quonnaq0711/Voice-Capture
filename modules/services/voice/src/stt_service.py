import asyncio
import os
import re
import threading

from faster_whisper import WhisperModel

DEVICE = os.getenv("WHISPER_DEVICE", "auto")
MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "auto")

# Limit concurrent GPU inference to prevent OOM
_inference_semaphore = asyncio.Semaphore(2)

# Whisper hallucinates these on silence/noise — well-documented issue
_HALLUCINATION_RE = re.compile(
    r"^("
    r"thank you.*|thanks for watching.*|subscribe.*|like and subscribe.*"
    r"|please subscribe.*|see you next time.*|bye bye.*"
    r"|you$|\.+$|\!+$|\?+$|…+$"
    r"|MBC.{0,10}$|字幕.*$|請不吝點讚.*$"
    r")$",
    re.IGNORECASE,
)

# Per-segment threshold: discard segments where Whisper thinks no speech is present
_NO_SPEECH_THRESHOLD = 0.6
_MIN_DURATION = 0.3  # seconds — skip ultra-short audio


class STTService:
    """Thread-safe singleton for Whisper speech-to-text."""

    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        device = DEVICE
        compute = COMPUTE_TYPE

        if device == "auto":
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
            except ImportError:
                device = "cpu"

        if compute == "auto":
            compute = "float16" if device.startswith("cuda") else "int8"

        self.device = device
        self.model = WhisperModel(MODEL_SIZE, device=device, compute_type=compute)

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    async def transcribe(self, audio_path: str) -> dict:
        async with _inference_semaphore:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, self._transcribe_sync, audio_path)

    def _transcribe_sync(self, audio_path: str) -> dict:
        segments_iter, info = self.model.transcribe(
            audio_path,
            beam_size=1,
            best_of=1,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
            ),
            condition_on_previous_text=False,
        )

        if info.duration < _MIN_DURATION:
            return {"text": "", "language": info.language, "duration": round(info.duration, 2)}

        # Keep only segments where Whisper is confident speech is present
        texts = []
        for seg in segments_iter:
            if seg.no_speech_prob < _NO_SPEECH_THRESHOLD:
                texts.append(seg.text)

        text = " ".join(texts).strip()

        # Filter known hallucination patterns
        if text and _HALLUCINATION_RE.match(text):
            text = ""

        # Detect repetitive hallucination: same short phrase repeated
        if text and len(text) < 200:
            words = text.split()
            if len(words) >= 4:
                half = len(words) // 2
                if words[:half] == words[half:2 * half]:
                    text = ""

        return {
            "text": text,
            "language": info.language,
            "duration": round(info.duration, 2),
        }
