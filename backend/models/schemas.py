from httpx import request
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

class UserBase(BaseModel):
    # username: str
    first_name: str
    last_name: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class VerifyRegistrationRequest(BaseModel):
    email: EmailStr
    otp: str

class ResendOTPRequest(BaseModel):
    email: EmailStr

class RegistrationVerificationResponse(BaseModel):
    message: str

class PasswordResetRequestModel(BaseModel):
    email: EmailStr

class PasswordResetConfirmModel(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

class PasswordResetResponse(BaseModel):
    message: str


class ResumeBase(BaseModel):
    filename: str
    original_filename: str
    file_path: str
    file_type: str

class Resume(ResumeBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ResumeUploadResponse(BaseModel):
    filename: str
    message: str

class ResumeDeleteResponse(BaseModel):
    message: str

class UserWithResumes(User):
    resumes: List[Resume]

    class Config:
        from_attributes = True

class ChatMessageBase(BaseModel):
    message_text: str
    sender: str  # 'user' or 'assistant'

class ChatMessageCreate(ChatMessageBase):
    session_id: Optional[int] = None
    agent_type: Optional[str] = 'dashboard'

class ChatMessageUpdate(BaseModel):
    message_text: str

class ChatMessage(ChatMessageBase):
    id: int
    user_id: int
    session_id: int
    agent_type: Optional[str] = 'dashboard'
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ChatHistoryResponse(BaseModel):
    messages: List[ChatMessage]
    total_count: int

class OTPResponse(UserBase):
    requested_at: datetime
    valid_time: int
class ResetPasswordConfirm(UserBase):
    resset_at: datetime

# User Profile schemas
class UserProfileBase(BaseModel):
    # Career Agent fields - Basic Information
    current_job: Optional[str] = None
    company: Optional[str] = None
    industry: Optional[str] = None
    experience: Optional[str] = None
    work_style: Optional[str] = None
    leadership_experience: Optional[str] = None
    
    # Career Agent fields - Skills & Competencies
    skills: Optional[List[str]] = None  # Technical skills
    soft_skills: Optional[List[str]] = None
    certifications: Optional[List[str]] = None
    skill_gaps: Optional[List[str]] = None
    
    # Career Agent fields - Goals & Aspirations
    short_term_goals: Optional[str] = None
    career_goals: Optional[str] = None  # Long-term career vision
    career_path_preference: Optional[str] = None
    target_industries: Optional[List[str]] = None
    
    # Career Agent fields - Work Preferences & Values
    work_life_balance_priority: Optional[str] = None
    company_size_preference: Optional[str] = None
    career_risk_tolerance: Optional[str] = None
    geographic_flexibility: Optional[str] = None
    work_values: Optional[List[str]] = None
    
    # Career Agent fields - Challenges & Development
    career_challenges: Optional[str] = None
    professional_strengths: Optional[List[str]] = None
    growth_areas: Optional[List[str]] = None
    learning_preferences: Optional[List[str]] = None
    income_range: Optional[str] = None
    financial_goals: Optional[str] = None
    investment_experience: Optional[str] = None
    risk_tolerance: Optional[str] = None
    fitness_level: Optional[str] = None
    health_goals: Optional[str] = None
    dietary_preferences: Optional[str] = None
    exercise_preferences: Optional[List[str]] = None
    travel_style: Optional[str] = None
    preferred_destinations: Optional[List[str]] = None
    travel_budget: Optional[str] = None
    travel_frequency: Optional[str] = None
    learning_style: Optional[str] = None
    personality_type: Optional[str] = None
    strengths: Optional[List[str]] = None
    areas_for_improvement: Optional[List[str]] = None
    family_status: Optional[str] = None
    relationship_goals: Optional[str] = None
    work_life_balance: Optional[str] = None
    hobbies: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    creative_pursuits: Optional[List[str]] = None
    education_level: Optional[str] = None
    learning_goals: Optional[List[str]] = None
    preferred_learning_methods: Optional[List[str]] = None
    spiritual_practices: Optional[List[str]] = None
    mindfulness_level: Optional[str] = None
    stress_management: Optional[List[str]] = None
    avatar_url: Optional[str] = None

class UserProfileCreate(UserProfileBase):
    pass

class UserProfileUpdate(UserProfileBase):
    pass

class UserProfile(UserProfileBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
    
    @property
    def effective_avatar_url(self) -> str:
        """Return user's avatar URL or default avatar if none set - returns relative path"""
        if self.avatar_url:
            return self.avatar_url
        else:
            return "/avatars/default.png"

class UserWithProfile(User):
    profile: Optional[UserProfile] = None

    class Config:
        from_attributes = True

# Password change schema
class PasswordChange(BaseModel):
    current_password: str
    new_password: str