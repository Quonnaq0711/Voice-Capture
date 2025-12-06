from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from backend.db.database import Base
from backend.db.types import TZDateTime
from backend.models.user import User

def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    
    # Career Agent fields - Basic Information
    current_job = Column(String)
    company = Column(String)
    industry = Column(String)
    experience = Column(String)
    work_style = Column(String)
    leadership_experience = Column(String)
    
    # Career Agent fields - Skills & Competencies
    skills = Column(JSON)  # Technical skills
    soft_skills = Column(JSON)
    certifications = Column(JSON)
    skill_gaps = Column(JSON)
    
    # Career Agent fields - Goals & Aspirations
    short_term_goals = Column(Text)
    career_goals = Column(Text)  # Long-term career vision
    career_path_preference = Column(String)
    target_industries = Column(JSON)
    
    # Career Agent fields - Work Preferences & Values
    work_life_balance_priority = Column(String)
    company_size_preference = Column(String)
    career_risk_tolerance = Column(String)
    geographic_flexibility = Column(String)
    work_values = Column(JSON)
    
    # Career Agent fields - Challenges & Development
    career_challenges = Column(Text)
    professional_strengths = Column(JSON)
    growth_areas = Column(JSON)
    learning_preferences = Column(JSON)
    
    # Money Agent fields
    income_range = Column(String)
    financial_goals = Column(Text)
    investment_experience = Column(String)
    risk_tolerance = Column(String)
    
    # Body Agent fields
    fitness_level = Column(String)
    health_goals = Column(Text)
    dietary_preferences = Column(String)
    exercise_preferences = Column(JSON)
    
    # Travel Agent fields
    travel_style = Column(String)
    preferred_destinations = Column(JSON)
    travel_budget = Column(String)
    travel_frequency = Column(String)
    
    # Mind Agent fields
    learning_style = Column(String)
    personality_type = Column(String)
    strengths = Column(JSON)
    areas_for_improvement = Column(JSON)
    
    # Family Life Agent fields
    family_status = Column(String)
    relationship_goals = Column(Text)
    work_life_balance = Column(String)
    
    # Hobby Agent fields
    hobbies = Column(JSON)
    interests = Column(JSON)
    creative_pursuits = Column(JSON)
    
    # Knowledge Agent fields
    education_level = Column(String)
    learning_goals = Column(JSON)
    preferred_learning_methods = Column(JSON)
    
    # Spiritual Agent fields
    spiritual_practices = Column(JSON)
    mindfulness_level = Column(String)
    stress_management = Column(JSON)
    
    # Avatar field
    avatar_url = Column(String)

    # Timestamps with timezone awareness
    created_at = Column(TZDateTime, default=utc_now)
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)

    # Relationship with User model
    user = relationship("User", back_populates="profile")