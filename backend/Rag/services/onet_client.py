import json, os, httpx, redis
from dotenv import load_dotenv 

load_dotenv()

r = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True,
)

class ONETClient:
    BASE = "https://services.onetcenter.org/ws/online/occupations"
    AUTH = (os.getenv("ONET_USER"), os.getenv("ONET_PASS"))

    async def get_soc(self, keyword: str) -> str:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client .get(
                f"{self.BASE}/occupations",
                params={"keyword": keyword},
                auth=self.AUTH,
                headers={"Accept": "application/json"}
            )

        occupations = res.json()["occupation"]

        if not occupations:
            return None
        
        return occupations[0]["code"]
        

    async def skills(self, soc:str) -> dict:
        key = f"onet:skills:{soc}"

        if cached := r.get(key):
          return json.loads(cached)

        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(
                f"{self.BASE}/occupations/{soc}/summary/skills",
                auth=self.AUTH,
                headers={"Accept": "application/json"}
            )

        data = res.json()["skills"]
        
        # Cached Data 7 days
        r.setex(key, 86400*7, json.dumps(data))
        return data

    async def knowledge(self, soc:str) -> dict:
        key = f"onet:knowledge:{soc}"

        if cached := r.get(key):
            return json.loads(cached)

        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(
                f"{self.BASE}/occupations/{soc}/summary/knowledge",
                auth=self.AUTH,
                headers={"Accept": "application/json"}
            )

        data = res.json()["knowledge"]

        r.setex(key, 86400*7, json.dumps(data))
        return data

    async def matched(self, soc:str) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.get(
                f"{self.BASE}/occupations/{soc}/related",
                auth=self.AUTH, 
                headers={"Accept": "application/json"}
            )

        data = res.json()["occupation"]

        return data