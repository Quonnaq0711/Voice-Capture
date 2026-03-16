import os
import redis


r = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=6379,
    decode_responses=True,
)

class BLSClient:
    Base="https://api.bls.gov/publicAPI/v2"

    async def wages(self, soc:str, msa:str) -> dict:
        key=f'bls:wages:{soc}:{msa}'

        if cache: = r.get(key)
