
class GeoService:

    MSA_MAP = {
        "baltimore": "12580",
        "new york": "35620",
        "los angeles": "31080",
        "chicago": "16980",
    }

    def get_msa(self, city: str = None, state: str= None) -> str:

        if not city or not state:
            return "00000" # fallback

        location = f"{city.strip().lower()}, {state.strip().lower()}"           

        return self.MSA_MAP.get(location, "00000") 