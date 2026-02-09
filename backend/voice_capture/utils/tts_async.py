import asyncio
from tts_worker import tts_queue


async def synthesize_async(text, voice_id, output_path):
    loop = asyncio.get_running_loop()

    await loop.run_in_executor(
        None,
        lambda: tts_queue.put((text, voice_id, output_path))
    )

    await loop.run_in_executor(None, tts_queue.join)