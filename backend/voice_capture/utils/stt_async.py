import asyncio
from executors import compute_executor


async def transcribe_async(model, wav_path):

    loop = asyncio.get_running_loop()

    def _run():
        segments, info = model.transcribe(wav_path, beam_size=10)
        text = " ".join(seg.text for seg in segments)
        return text, info.language
    
    return await loop.run_in_executor(compute_executor, _run)