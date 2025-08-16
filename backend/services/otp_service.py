import datetime
from email.policy import HTTP
import secrets
import bcrypt
from fastapi import HTTPException
import pyotp
from backend.models.user import User
from backend.services import email_service
from sqlalchemy.orm import Session
from enum import Enum


class OTPPurpose(str, Enum):
    REGISTRATION = "registration"
    PASSWORD_RESET = "password_reset"

class OTPService:
    def __init__(self, email_service):
        self.valid_time = 5  # minutes
        self.failed_attempts = 3
        self.lockout_time = 15  # minutes
        self.email_service = email_service
        self.request_timeout = 2  # minutes

    def user_by_email(self, db: Session, email: str):
        return db.query(User).filter(User.email == email).first()
    
    async def otp_request(self, db: Session, email: str, purpose: OTPPurpose):
        user = self.user_by_email(db, email)

        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        # Request Timeout 
        if user.otp_requested_at and \
            (datetime.datetime.now() - user.otp_requested_at).total_seconds() < self.request_timeout * 60:
            raise HTTPException(status_code=400, detail="Please wait before requesting a new OTP.")
        
        # OTP Generator 
        if not user.hotp_secret:
            user.hotp_secret = secrets.token_hex(20)
            user.hotp_counter = 0

        # Increment
        user.hotp_counter += 1
        otp = pyotp.HOTP(user.hotp_secret).at(user.hotp_counter)
        user.otp_requested_at = datetime.datetime.now()
        user.otp_failed_attempts = 0 
        user.otp_purpose = purpose.value
        db.commit()

        
        if purpose == OTPPurpose.PASSWORD_RESET:
            await self.email_service.send_password_reset_otp(email, otp, self.valid_time)
        elif purpose == OTPPurpose.REGISTRATION:
            await self.email_service.send_email_verification_otp(email, otp, self.valid_time)

        # Fixed: f-string formatting
        return {"message": f"Please check your email for your OTP to complete {purpose.value.replace('_', ' ')}."}
    
    async def verify_otp(self, db: Session, email: str, otp: str, purpose: OTPPurpose, new_password: str = None):
        user = self.user_by_email(db, email)

        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        # Timeout check
        if user.otp_locked_until and user.otp_locked_until > datetime.datetime.now():
            timeleft = int((user.otp_locked_until - datetime.datetime.now()).total_seconds() / 60)
            raise HTTPException(status_code=400, detail=f"You have failed too many times to verify your code. Account locked for {timeleft} minutes.")
        
        # Purpose Check
        if user.otp_purpose != purpose.value:
            raise HTTPException(status_code=400, detail="No OTP found for this request.")
        
        # Expiration check
        if not user.otp_requested_at or (datetime.datetime.now() - user.otp_requested_at).total_seconds() > self.valid_time * 60:
            raise HTTPException(status_code=400, detail="OTP password is no longer active.")
        
        # OTP verification
        if not pyotp.HOTP(user.hotp_secret).verify(otp, user.hotp_counter):
            user.otp_failed_attempts += 1  
            if user.otp_failed_attempts >= self.failed_attempts:
                user.otp_locked_until = datetime.datetime.now() + datetime.timedelta(minutes=self.lockout_time)
                db.commit()
                raise HTTPException(status_code=400, detail=f"You have failed too many times to verify your code. Account locked for {self.lockout_time} minutes.")
            else:
                db.commit() 
                raise HTTPException(status_code=400, detail=f'Invalid Passcode. You made {user.otp_failed_attempts} attempts out of {self.failed_attempts}.')
            
        # Password reset
        if purpose == OTPPurpose.PASSWORD_RESET:
            if not new_password:
                raise HTTPException(status_code=400, detail="New password is required for password reset.")
            user.hashed_password = bcrypt.hash(new_password)  #hashpw(new_password.encode('utf-8'), bcrypt.gensalt())  # Fixed: proper bcrypt usage
        elif purpose == OTPPurpose.REGISTRATION:
            user.is_active = True

        # Clean up OTP data after successful verification
        user.otp_failed_attempts = 0  
        user.otp_locked_until = None
        user.otp_requested_at = None
        user.otp_purpose = None 
        db.commit()

        return {"message": f"{purpose.value.replace('_', ' ').capitalize()} completed successfully"}