import json
import os
import httpx
import redis


r = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True,
)

class BLSClient:
    Base="https://api.bls.gov/publicAPI/v2"

    async def wages(self, soc:str, msa:str) -> dict:
        key = f"bls:wages:{soc}:{msa}"
        if cached := r.get(key):
            return json.loads(cached)


        series = [
            f"OEWS{msa}000000{soc}01",  # 10th pct
            f"OEWS{msa}000000{soc}02",  # 25th pct
            f"OEWS{msa}000000{soc}04",  # median
            f"OEWS{msa}000000{soc}06",  # 75th pct
            f"OEWS{msa}000000{soc}08",  # 90th pct
        ]

        payload = {
            "seriesid": series,
            "startyear": "2016",
            "endyear": "2026",
            "registrationkey": os.getenv("BLS_KEY")
        }

        async with httpx.AsyncClient(timeout=20) as client:

            res = await client.post(
                f"{self.Base}/timeseries/data/",
                json=payload
            )

        data = res.json()["Results"]["series"]
        
        # Refresh Data Every 24 Hours(cached)
        r.setex(key, 86400, json.dumps(data))
        return data
    
    async def get_outlook(self, soc: str) -> list:
        key = f"bls:outlook:{soc}"
        if cached := r.get(key): 
            return json.loads(cached)
        
        async with httpx.AsyncClient(timeout=20) as client:

            res = await client.get(
                f"{self.Base}/predictions/{soc}",
                headers={"Authorization": f"Bearer {os.getenv('BLS_KEY')}"}
            )

        data = res.json()

        # Refesh Data Every 7 days(cached)
        r.setex(key, 86400*7, json.dumps(data))
        return data
    