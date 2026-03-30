from functools import lru_cache
import os
import redis
from sqlalchemy.orm import Session
from fastapi import Depends
from backend.rag.services.bls_client import BLSClient
from backend.rag.services.career_service import CareerService
from backend.rag.services.onet_client import ONETClient
from backend.db import get_db
from backend.models import UserData


@lru_cache
def get_career_service() -> CareerService:
    return CareerService(
        bls_client=BLSClient(),
        onet_client=ONETClient(),
        redis_client=redis.Redis(
            host=os.getenv("REDIS_HOST", "redis"),
            port=int(os.getenv("REDIS_PORT", 6379)),
            decode_response=True,
        ),
    )

def get_user_data(user_id: str, db: Session = Depends(get_db)):
    return db.query(UserData).filter(UserData.user_id == user_id).first()


def get_career_service() -> CareerService:
    return CareerService()