from fastapi import APIRouter, Depends
from pytest import Session
from backend.rag.services.geo_location import GeoService
from backend.rag.services.profile_service import ProfileService
from backend.db.database import get_db
from backend.models import user_data
from backend.rag.services.bls_client import BLSClient
from backend.rag.services.onet_client import ONETClient
from backend.api.profile import get_current_user_profile
from backend.models.user import User
from backend.utils.auth import get_current_user

router = APIRouter(tags=["rag","bls","onet"])


bls = BLSClient()
geo = GeoService()
onet = ONETClient()
profile_service = ProfileService(onet, geo)


@router.get("/intelligence/{user_id}")
async def career_intelligence(
    user_id: str,
    current_user: User = Depends(get_current_user),
    user_profile: dict = Depends(get_current_user_profile),
    user_data: dict = Depends()
    db: Session = Depends(get_db)
    ):