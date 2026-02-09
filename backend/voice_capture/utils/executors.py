import concurrent.futures


compute_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4)

io_executor = concurrent.futures.ThreadPoolExecutor(max_workers=8)