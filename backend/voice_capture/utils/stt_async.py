import asyncio        
from .executors import compute_executor, whisper_executor


async def transcribe_async(model, wav_path):

    loop = asyncio.get_running_loop()

    def _run():
        segments, info = model.transcribe(wav_path, beam_size=3) # Lower beam size to improve latency and accuracy keeping stability(reg => beam=5)
        text = " ".join(seg.text for seg in segments)
        return text, info.language
    
    return await loop.run_in_executor(compute_executor, _run)


def transcribe_sync(model,path):
    segments, info = model.transcribe(
        path,
        beam_size=3, # Lower beam size to improve latency and accuracy keeping stability(reg => beam=5)
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=350, #(reg=>500)
            aggressiveness=2 # balanced filtering
            ),  
    )
    transcribe = " ".join(seg.text for seg in segments).strip()
    return transcribe, info.language, info.duration


async def transcribe_files_async(model, path):
    loop = asyncio.get_running_loop()

    return await loop.run_in_executor(
        whisper_executor,
        transcribe_sync,
        model,
        path
    )