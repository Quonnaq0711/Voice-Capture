from datetime import datetime, timezone
from sqlalchemy import Column, Integer, Nullable, String, DateTime, Boolean, true
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime
from backend.models.career_insight import CareerInsight

def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    # username = Column(String, unique=True, index=True)
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

    hotp_counter = Column(Integer, default=0)
    hotp_secret = Column(String, nullable=True)
    otp_requested_at = Column(TZDateTime, nullable=True)
    otp_locked_until = Column(TZDateTime, nullable=True)
    otp_failed_attempts = Column(Integer, default=0)
    otp_purpose = Column(String, nullable=True) # registration or password_reset

    created_at = Column(TZDateTime, default=utc_now)
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)
    last_login = Column(TZDateTime, nullable=True)  # Track last login for active user detection

    # Relationships
    resumes = relationship("Resume", back_populates="user")
    chat_messages = relationship("ChatMessage", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    profile = relationship("UserProfile", back_populates="user", uselist=False)
    career_insights = relationship("CareerInsight", back_populates="user")
    activities = relationship("UserActivity", back_populates="user")
    daily_recommendations = relationship("DailyRecommendation", back_populates="user", lazy="dynamic")
    refresh_tokens = relationship("RefreshToken", back_populates="user", cascade="all, delete-orphan")