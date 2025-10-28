import datetime
from datetime import timezone
from email.policy import HTTP
import secrets
import bcrypt
import os
from fastapi import HTTPException
import pyotp
from backend.models.user import User
from backend.services import email_service
from sqlalchemy.orm import Session
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class OTPPurpose(str, Enum):
    REGISTRATION = "registration"
    PASSWORD_RESET = "password_reset"

class OTPService:
    def __init__(self):
        self.valid_time = 5  # minutes
        self.failed_attempts = 3
        self.lockout_time = 15  # minutes
        self.request_timeout = 2  # minutes

    def user_by_email(self, db: Session, email: str):
        return db.query(User).filter(User.email == email).first()
    
    async def otp_request(self, db: Session, email: str, purpose: OTPPurpose):
        user = self.user_by_email(db, email)

        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        # Request Timeout
        if user.otp_requested_at and \
            (datetime.datetime.now(timezone.utc) - user.otp_requested_at).total_seconds() < self.request_timeout * 60:
            raise HTTPException(status_code=400, detail="Please wait before requesting a new OTP.")
        
        # OTP Generator
        if not user.hotp_secret:
            user.hotp_secret = pyotp.random_base32() #secrets.token_hex(20)
            user.hotp_counter = 0
            try:
                db.commit()
            except Exception as e:
                db.rollback()
                raise HTTPException(status_code=500, detail=f"Failed to initialize OTP secret: {str(e)}")
            

        # Increment
        user.hotp_counter += 1
        otp = pyotp.HOTP(user.hotp_secret).at(user.hotp_counter)
        user.otp_requested_at = datetime.datetime.now(timezone.utc)
        user.otp_failed_attempts = 0
        user.otp_purpose = purpose.value
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to generate OTP: {str(e)}")

        # Development mode: Print OTP to console
        if os.getenv('ENVIRONMENT') == 'development':
            logger.info("="*60)
            logger.info("🔐 DEVELOPMENT MODE - OTP GENERATED")
            logger.info("="*60)
            logger.info(f"📧 Email: {email}")
            logger.info(f"🎯 Purpose: {purpose.value}")
            logger.info(f"🔑 OTP Code: {otp}")
            logger.info(f"⏰ Valid for: {self.valid_time} minutes")
            logger.info("="*60)
            print("\n" + "="*60)
            print("🔐 DEVELOPMENT MODE - OTP GENERATED")
            print("="*60)
            print(f"📧 Email: {email}")
            print(f"🎯 Purpose: {purpose.value}")
            print(f"🔑 OTP Code: {otp}")
            print(f"⏰ Valid for: {self.valid_time} minutes")
            print("="*60 + "\n")

        return otp

    async def verify_otp(self, db: Session, email: str, otp: str, purpose: OTPPurpose):
        user = self.user_by_email(db, email)

        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        # Timeout check
        if user.otp_locked_until and user.otp_locked_until > datetime.datetime.now(timezone.utc):
            timeleft = int((user.otp_locked_until - datetime.datetime.now(timezone.utc)).total_seconds() / 60)
            raise HTTPException(status_code=400, detail=f"You have failed too many times to verify your code. Account locked for {timeleft} minutes.")
        
        # Purpose Check
        if user.otp_purpose != purpose.value:
            raise HTTPException(status_code=400, detail="No OTP found for this request.")
        
        # Expiration check
        if not user.otp_requested_at or (datetime.datetime.now(timezone.utc) - user.otp_requested_at).total_seconds() > self.valid_time * 60:
            raise HTTPException(status_code=400, detail="OTP password is no longer active.")
        
        # OTP verification
        if not pyotp.HOTP(user.hotp_secret).verify(otp, user.hotp_counter):
            user.otp_failed_attempts += 1
            if user.otp_failed_attempts >= self.failed_attempts:
                user.otp_locked_until = datetime.datetime.now(timezone.utc) + datetime.timedelta(minutes=self.lockout_time)
                try:
                    db.commit()
                except Exception as e:
                    db.rollback()
                    raise HTTPException(status_code=500, detail=f"Failed to lock account: {str(e)}")
                raise HTTPException(status_code=400, detail=f"You have failed too many times to verify your code. Account locked for {self.lockout_time} minutes.")
            else:
                try:
                    db.commit()
                except Exception as e:
                    db.rollback()
                    raise HTTPException(status_code=500, detail=f"Failed to record failed attempt: {str(e)}")
                raise HTTPException(status_code=400, detail=f'Invalid Passcode. You made {user.otp_failed_attempts} attempts out of {self.failed_attempts}.')

        # Clean up OTP data after successful verification
        user.otp_failed_attempts = 0
        user.otp_locked_until = None
        user.otp_requested_at = None
        user.otp_purpose = None
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to clear OTP data: {str(e)}")

        return True