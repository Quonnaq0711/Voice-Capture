import queue
import threading
import pyttsx3
import traceback
from concurrent.futures import Future

tts_queue = queue.Queue(maxsize=20)

def tts_worker():
    engine = pyttsx3.init()
    engine.setProperty('rate', 150)

    while True:
        job = tts_queue.get()
        
        if job is None:
            break

        text, voice_id, output_path, future = job

        try:
            if voice_id:
              engine.setProperty('voice', voice_id)

              engine.save_to_file(text, output_path)
              engine.runAndWait()

              future.set_result(True)

        except Exception as e:
            future.set_exception(e)

        finally:
            tts_queue.task_done()


threading.Thread(target=tts_worker, daemon=True).start()