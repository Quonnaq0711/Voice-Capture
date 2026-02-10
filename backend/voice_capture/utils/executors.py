import concurrent.futures

whisper_executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

compute_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

io_executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)