from datetime import datetime
from sqlalchemy import Column, Integer, Nullable, String, DateTime, Boolean, true
from sqlalchemy.orm import relationship
from backend.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

    hotp_counter = Column(Integer, default=0)
    hotp_secret = Column(String, Nullable=True)
    otp_requested_at = Column(DateTime, Nullable=True)
    otp_locked_until = Column(DateTime, Nullable=True)
    otp_failed_attemps = Column(Integer, default=0)
    otp_purpose = Column(String, nullable=True) # registration or password_reset
    
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    # Relationships
    resumes = relationship("Resume", back_populates="user")
    chat_messages = relationship("ChatMessage", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    profile = relationship("UserProfile", back_populates="user", uselist=False)