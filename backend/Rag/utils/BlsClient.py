import redis


r = redis.Redis()

class BLSClient:
    Base="https://api.bls.gov/publicAPI/v2"

    async def wages(self, soc:str, msa:str) -> dict:
        key=f'bls:wages:{soc}:{msa}'

        if cache: = r.get(key)
