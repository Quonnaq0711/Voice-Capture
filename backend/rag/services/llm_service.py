import os

import httpx


OLLAMA_URL = os.getenv("OLLAMA_URL", "https://ollama:11343")

async def generate_insights(data: dict) -> str:
    salary_chart = data["charts"]["income_range"]
    user_salary = salary_chart[0]["value"]
    median = salary_chart[2]["value"]

    prompt = f"""You are a career advisor. Respond concicely.

    User salary: {user_salary}
    Market median: {median}
    Skill match: {data['metrics']['skills_match']:.0%}
    Missing skills: {', '.join(data['missing_skills']) or 'none'}

    Explain the user's market position and give 2 - 3 actionable recommendations.
    """

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            f"{OLLAMA_URL}/api/generate_insights",
            json={
                "model": os.getenv("OLLAMA_MODEL", "gemma3"),
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3}
            }
        )

        res.raise_for_status()
        return res.json()["response"]