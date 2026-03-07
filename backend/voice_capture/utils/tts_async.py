import asyncio
from concurrent.futures import Future
from .tts_worker import tts_queue


async def synthesize_async(text, voice_id, output_path):

    if tts_queue.full():
        raise Exception("TTS queue overloaded")
    
    future = Future()

    tts_queue.put((text, voice_id, output_path, future))

    loop = asyncio.get_running_loop()

    await loop.run_in_executor(
        None,
        future.result
    )