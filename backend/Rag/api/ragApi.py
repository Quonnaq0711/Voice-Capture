from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.rag.services.career_service import CareerService
from backend.rag.services.geo_location import GeoService
from backend.rag.services.profile_service import ProfileService
from backend.db.database import get_db
from backend.models.user_data import UserData
from backend.rag.services.bls_client import BLSClient
from backend.rag.services.onet_client import ONETClient
from backend.api.profile import get_current_user_profile
from backend.models.user import User
from backend.utils.auth import get_current_user
from backend.rag.utils.aggregation import get_user_data, get_career_service
from backend.models.schemas import CareerResponse, UserDataResponse, UserDataCreate, UserDataUpdate
from backend.rag.services.llm_service import generate_insights




router = APIRouter(tags=["rag","bls","onet"])


@router.post("", response_model=UserDataResponse)
def create_user_data(
    user_id: int,
    body: UserDataCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    
    if str(current_user.id) != str(user_id):
        raise HTTPException(status_code=403)


    if db.query(UserData).filter(UserData.user_id == user_id).first():
        raise HTTPException(status_code=409, detail="User data already exists — use PATCH to update")

    record = UserData(user_id=user_id, **body.model_dump(exclude_none=True))
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.patch("", response_model=UserDataResponse)
def update_user_data(
    user_id: int,
    body: UserDataUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if str(current_user.id) != str(user_id):
        raise HTTPException(status_code=403)

    record = db.query(UserData).filter(UserData.user_id == user_id).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="User data not found")
    

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(record, field, value)

    db.commit()
    db.refresh(record)
    return record


@router.get("/intelligence/{user_id}", response_model=CareerResponse)
async def career_intelligence(
    user_id: str,
    current_user: User = Depends(get_current_user),
    profile: dict = Depends(get_current_user_profile),
    user_data: dict = Depends(get_user_data),
    career_service: CareerService = Depends(get_career_service),
):
    if str(current_user.id) != str(user_id):
        raise HTTPException(status_code=403)

    async def generator():
        context = await career_service.build_context(
            current_user,
            profile,
            user_data,
        )

        try:
            result = await career_service.generate(context)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Data pipeline error: {e}")

        try:
            result["insights_text"] = await generate_insights(result)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LLM error: {e}")

        return result

    return await career_service.pull_or_make(user_id, generator)