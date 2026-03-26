import asyncio
import json, os
from backend.rag.services import bls_client, onet_client

r = redis.Redis(
    host=os.getenv("REDIS_HOST", "redis"),
    port=int(os.getenv("REDIS_PORT", 6379)),
    decode_responses=True,
)


class CareerService:

    def __init__(self, bls_client, onet_client):
        self.bls = bls_client
        self.onet = onet_client
    
    async def generate(self, context):

        soc = context["soc"]
        msa = context["msa"]

        # Data Pull
        wage_task = self.bls.wages(soc,msa)
        skills_task = self.onet.skills(soc)

        wages_data, onet_skills = await asyncio.gather(
            wage_task,
            skills_task
        )

        # Format
        labels = ["10th", "25th", "Median", "75th", "90th"]
        values = [int(s["data"][0]["value"]) for s in wages_data]

        wage_chart = [
            {"label": labels[i], "value":values[i]}
            for i in range (len(values))
        ]

        # Salary
        median = values[2]

        salary_chart = [
            {"label": "User", "value": context["salary"]},
            {"label": "Market Median", "value": median}
        ]

        # Skills
        market_skills = [s["name"] for s in onet_skills]
        user_skills = context["skills"]

        match = set(user_skills).intersection(set(market_skills))

        skill_chart = [
            {
                "skill": s["name"],
                "market": s.get("importance", 50),
                "user": 80 if s["name"] in user_skills else 30
            }

            for s in onet_skills
        ]

        return {
            "soc": soc,
            "msa": msa,
            "charts": {
                "income_range": salary_chart,
                "wages": wage_chart,
                "skills": skill_chart
            },
            "metrics": {
                "skills_match": len(match) / len(market_skills)
            },
            "missing_skills": list(set(market_skills) - set(user_skills))
        }
    
    def cache_key(self, user_id: str) -> str:
        return f"career:intelligence:{user_id}"
    

    async def pull_or_make(self, user_id: str , context: dict) -> dict:
        key = self.cache_key(user_id)
        
        if cached := self.r.get(key):
            return json.loads(cached)
        
        data = await self.generate(context)

        self.r.setex(key, 3600, json.dumps(data))

        return data