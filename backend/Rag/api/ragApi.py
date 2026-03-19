from fastapi import APIRouter, Depends
from backend.Rag.services.BlsClient import BLSClient
from backend.Rag.services.OnetClient import ONETClient
from backend.api.profile import get_current_user_profile
from backend.models.user import User
from backend.utils.auth import get_current_user

router = APIRouter(tags=["rag","bls","onet"])
bls = BLSClient()
onet = ONETClient()


@router.get("/charts/{user_id}")
async def get_charts(
    current_user: User = Depends(get_current_user),
    user_profile: User = Depends(get_current_user_profile)
    ):
