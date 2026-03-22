import enum
from sqlalchemy import Boolean, Column, Date, ForeignKey, Integer, String, Enum
from sqlalchemy.orm import relationship, validates
from backend.db.database import Base
import re


# ─── Enums 

class Race(enum.Enum):
    black            = "Black / African American"
    white            = "White"
    latino           = "Latino"
    asian            = "Asian"
    native_hawaiian  = "Native Hawaiian"          
    pacific_islander = "Other Pacific Islander"
    american_indian  = "American Indian"
    alaskan          = "Alaska Native"
    other            = "Other"
    pns              = "Prefer Not to Say"


class Sex(enum.Enum):
    male   = "Male"
    female = "Female"
    other  = "Other"
    pns    = "Prefer Not to Say"


class VeteranStatus(enum.Enum):                   
    yes = "I am a protected veteran"              
    no  = "I am NOT a protected veteran"          
    dna = "I do not wish to answer"


class Disability(enum.Enum):
    yes = "Yes, I have a disability (or previously had one)"   
    no  = "No, I do not have a disability"
    dna = "I do not wish to answer"


# ─── Model 

class UserData(Base):
    __tablename__ = "user_data"

    id      = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # ── Contact
    secondary_email = Column(String(255), unique=True, index=True, nullable=True)

    # ── Address
    street  = Column(String(255), nullable=True)
    street2 = Column(String(255), nullable=True)   
    city    = Column(String(100), nullable=True)
    state   = Column(String(2),   nullable=True)
    zipcode = Column(String(10),  nullable=True)
    country = Column(String(2),   nullable=True, default="US")

    # ── Phone
    phone_country_code = Column(String(5),  nullable=True)
    phone_number       = Column(String(15), nullable=True)   
    phone_extension    = Column(String(10), nullable=True)

    # ── Demographics
    date_of_birth     = Column(Date,  nullable=True)
    sex               = Column(Enum(Sex),  nullable=True, default=None)  
    race              = Column(Enum(Race),  nullable=True, default=None)  
    hispanic          = Column(Boolean,   nullable=True, default=None)  
    veteran_status    = Column(Enum(VeteranStatus),  nullable=True, default=None)  
    disability_status = Column(Enum(Disability),     nullable=True, default=None)  

    # ── Online Presence
    linkedin_url = Column(String(255), nullable=True)   
    website      = Column(String(255), nullable=True)

    # ── Relationships
    user = relationship("User", back_populates="user_data")

    # ── Validation
    @validates("secondary_email")
    def validate_email(self, key, value):
        if value is None:
            return value
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", value):
            raise ValueError(f"Invalid email address: {value}")
        return value.lower().strip()

    @validates("phone_number")
    def validate_phone(self, key, value):
        if value is None:
            return value
        digits = re.sub(r"\D", "", value)
        if not (7 <= len(digits) <= 15):
            raise ValueError(f"Invalid phone number: {value}")
        return digits

    @validates("linkedin_url")
    def validate_linkedin(self, key, value):
        if value is None:
            return value
        if not re.match(r"^https?://(www\.)?linkedin\.com/", value):
            raise ValueError(f"Invalid LinkedIn URL: {value}")
        return value.strip()

    @validates("state")
    def validate_state(self, key, value):
        if value is None:
            return value
        return value.upper().strip()

    @validates("country")
    def validate_country(self, key, value):
        if value is None:
            return value
        return value.upper().strip()

    def __repr__(self):
        return f"<UserData user_id={self.user_id}>"