
class ProfileService:

    def __init__(self, ONETClient, GEOService):
        self.onet = ONETClient
        self.geo = GEOService


    async def enrich(self, profile: dict) -> dict:

        soc = profile.get("soc")

        if not soc:
            soc = await sefl.onet.get_soc(
                profile.get("current_career", "")
            )

        msa = profile.get("msa")

        if not msa:
            mas = self.geo.get_msa(
                city=profile.get("city"),
                state=profile.get("state")
            )

        return {
            **profile,
            "soc": soc,
            "msa": msa
        }
