import datetime
import secrets
from fastapi import HTTPException
import pyotp
from backend.models.user import User
from backend.services import email_service
from sqlalchemy.orm import Session

class PasswordResetService:
    def __init__(self, email_service: email_service.EmailService):
        self.valid_time = 5
        self.failed_attempts = 3
        self.lockout_time = 15
        self.email_service = email_service
        self.request_timeout = 2

    def user_by_email(self, db: Session, email: str):
        return db.query(User).filter(User.email == email).first()
    
    async def reset_password_request(self, db: Session, email: str):
        user = self.user_by_email(db, email)

        if not user:
            raise HTTPException(status_code=400, detail="User not found")
        
        # Request Timeout
        if user.otp_requested_at and \
            (datetime.datetime.now() - user.otp_requested_at).total() < self.REQUEST_TIMEOUT:
            raise HTTPException(status_code=400, detail="Please wait before requesting a new OTP.")
        
        # OTP Generator
        if not user.hotp_sercret:
            user.hotp_secret = secrets.token_hex(20)
            user.hotp_counter = 0

        #Increment
        user.hotp_counter += 1
        otp = pyotp.HOTP(user.hotp_secret).at(user.hotp_counter)
        user.otp_requested_at = datetime.datetime.now()
        user.otp_failed_attemps = 0
        db.commit()

        await self.email_service.send_password_rest_otp(email, otp, self.OTP_VALID_TIME)
        return {"message": "Please check your email for your OTP"}
    
    async def verify_otp_and_reset_password(self, db: Session, email: str, otp: str, new_password: str):
        user = self.user_by_email(db, email)

        if not user:
            raise HTTPException(status_code=400, detail="User not found")

        if user.otp_locked_until and user.otp_locked_until > datetime.datetime.now():
            timeleft = int((user.otp_locked_until - datetime.datetime.now()).total / 60)
            raise HTTPException(status_code=400, detail=f"You have failed to many times to verify your code. Account locked for {timeleft} minutes.")
        
