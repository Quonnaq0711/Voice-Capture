from datetime import datetime
import json
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from backend.db.database import Base

class CareerInsight(Base):
    __tablename__ = "career_insights"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    resume_id = Column(Integer, ForeignKey("resumes.id"))
    professional_data = Column(Text)  # JSON string of professional data
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

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