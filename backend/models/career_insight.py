"""
Model for storing career insights generated from resume analysis
"""
from datetime import datetime, timezone
import json
from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime

def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)

class CareerInsight(Base):
    __tablename__ = "career_insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)  # Index for user queries
    resume_id = Column(Integer, ForeignKey("resumes.id"), index=True)  # Index for resume queries
    professional_data = Column(Text)  # JSON string of professional data
    dashboard_summaries = Column(Text)  # JSON string of LLM-generated summaries for Dashboard
    summaries_generated_at = Column(TZDateTime, nullable=True)  # When summaries were last generated
    created_at = Column(TZDateTime, default=utc_now, index=True)  # Index for time-based queries
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)

    # Relationships
    user = relationship("User", back_populates="career_insights")
    resume = relationship("Resume", back_populates="career_insights")
    
    def set_professional_data(self, data):
        """Convert dictionary to JSON string for storage"""
        self.professional_data = json.dumps(data)

    def get_professional_data(self):
        """Convert stored JSON string to dictionary"""
        if self.professional_data:
            return json.loads(self.professional_data)
        return None

    def set_dashboard_summaries(self, summaries):
        """Convert dashboard summaries dictionary to JSON string for storage"""
        self.dashboard_summaries = json.dumps(summaries)
        self.summaries_generated_at = utc_now()

    def get_dashboard_summaries(self):
        """Convert stored dashboard summaries JSON string to dictionary"""
        if self.dashboard_summaries:
            return json.loads(self.dashboard_summaries)
        return None
        
    def to_dict(self):
        """Convert insight to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "resume_id": self.resume_id,
            "professional_data": self.get_professional_data(),
            "dashboard_summaries": self.get_dashboard_summaries(),
            "summaries_generated_at": self.summaries_generated_at.isoformat() if self.summaries_generated_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }