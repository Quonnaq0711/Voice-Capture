from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from db.database import Base

class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String)  # UUID-based filename
    original_filename = Column(String)  # Original uploaded filename
    file_path = Column(String)  # Full path to the resume file
    file_type = Column(String)  # File extension (pdf or txt)
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="resumes")
    career_insights = relationship("CareerInsight", back_populates="resume")