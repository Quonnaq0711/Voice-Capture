import asyncio
from .executors import io_executor
import ollama


async def chat_async(model, messages):
    loop = asyncio.get_event_loop()

    def _run():
        res = ollama.chat(model=model, messages=messages)
        return res["messages"]["content"]
    
    return await loop.run_in_executor(io_executor, _run)