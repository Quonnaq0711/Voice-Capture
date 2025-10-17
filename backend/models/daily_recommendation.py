"""
Daily Recommendations Model
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend.db.database import Base

def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)

class DailyRecommendation(Base):
    __tablename__ = "daily_recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(DateTime, nullable=False, index=True)  # Date for which recommendations are generated
    recommendations = Column(JSON, nullable=False)  # Array of 3 recommendation objects
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    # Context data used for generation
    context_data = Column(JSON, nullable=True)  # Profile and resume analysis data used
    generation_status = Column(String, default="generated", nullable=False)  # generated, error, pending

    # Relationships
    user = relationship("User", back_populates="daily_recommendations")

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "date": self.date.isoformat() if self.date else None,
            "recommendations": self.recommendations or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "context_data": self.context_data,
            "generation_status": self.generation_status
        }

    def get_recommendations(self):
        """Get recommendations list"""
        return self.recommendations or []

    def set_recommendations(self, recommendations):
        """Set recommendations list"""
        self.recommendations = recommendations
        self.updated_at = utc_now()

    @classmethod
    def get_for_user_and_date(cls, db, user_id: int, target_date: datetime):
        """Get recommendations for a specific user and date"""
        # Convert date to start of day for comparison
        start_of_day = target_date.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = target_date.replace(hour=23, minute=59, second=59, microsecond=999999)

        return db.query(cls).filter(
            cls.user_id == user_id,
            cls.date >= start_of_day,
            cls.date <= end_of_day
        ).order_by(cls.created_at.desc()).first()  # Order by created_at desc to get latest

    @classmethod
    def get_latest_for_user(cls, db, user_id: int):
        """Get the most recent recommendations for a user"""
        return db.query(cls).filter(
            cls.user_id == user_id
        ).order_by(cls.date.desc()).first()