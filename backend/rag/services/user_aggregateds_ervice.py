
from backend.models import User, UserProfile, user_data
from backend.rag.services.geo_location import GeoService
from backend.rag.services.profile_service import ProfileService


class UserAggregationService:
    
    def __init__(self, ProfileService, GeoService):
        self.profile_service = ProfileService
        self.geo = GeoService

    async def context(self, User, UserProfile, UserData):

        # Data Collection
        soc = getattr(User, "soc", None)
        msa = getattr(User, "msa", None)

        city = UserData.get("city")
        state = UserData.get("state")

        # Fill Missing Data
        enrich = await self.profile_service.enrich({
            "soc": soc,
            "msa": msa,
            "current_job": UserProfile.get("current_job"),
            "city": city,
            "state": state 
        })

        return {
            "user_id": User.id,
            "soc": enrich["soc"],
            "msa": enrich["msa"],
            "skills": UserProfile.get("skills", []),
            "income_range": UserProfile.get("income_range", 0),
            "career_goal": UserProfile.get("career_goal"),
            "location": f"{city},{state}" if city and state else None
        }