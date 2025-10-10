from passlib.hash import bcrypt
from fastapi import HTTPException
from backend.services import otp_service
from backend.services.email_service import EmailService
from backend.services.otp_service import OTPPurpose, OTPService
from sqlalchemy.orm import Session


class PasswordResetService:
    def __init__(self, otp_service: OTPService, email_service: EmailService):
        self.otp_service = otp_service
        self.email_service = email_service

    async def password_reset_request(self, db: Session, email: str):
        # Generate OTP
        otp = await self.otp_service.otp_request(db, email, OTPPurpose.PASSWORD_RESET)

        # Send OTP by email
        await self.email_service.send_password_reset_otp(
            email, otp, self.otp_service.valid_time
        )

        return {"message": "Please check your email for your OTP to complete password reset."}

    async def verify_password_otp(self, db: Session, email: str, otp: str, new_password: str):
        if not new_password:
            raise HTTPException(status_code=400, detail="New password is required for password reset.")
        
        # Validate OTP
        await self.otp_service.verify_otp(db, email, otp, OTPPurpose.PASSWORD_RESET)

        # Fetch user
        user = self.otp_service.user_by_email(db, email)

        # Update password
        user.hashed_password = bcrypt.hash(new_password)  # with passlib
        # or: bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        db.commit()

        return {"message": "Password reset completed successfully"}
