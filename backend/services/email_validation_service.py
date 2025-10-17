from fastapi import HTTPException, logger
from backend.services.email_service import EmailService
from backend.services.otp_service import OTPPurpose, OTPService
from sqlalchemy.orm import Session

class EmailValidationService:
    def __init__(self, otp_service: OTPService, email_service: EmailService):
        self.otp_service = otp_service
        self.email_service = email_service

    async def request_email_validation(self, db: Session, email: str):
        otp = await self.otp_service.otp_request(db, email, OTPPurpose.REGISTRATION)
        await self.email_service.send_email_verification_otp(email, otp, self.otp_service.valid_time)

        return {"message": "Please check your email for your OTP to complete account creation."}
    
    async def verify_email_validation(self, db, email: str, otp: str):
        try:
           await self.otp_service.verify_otp(db, email, otp, OTPPurpose.REGISTRATION)

           user = self.otp_service.user_by_email(db, email)
           if not user:
              raise HTTPException(status_code=400, detail="User not found")
        
           user.is_active = True
           db.commit()

           return {"message": "Email verification completed successfully. Please log in to your account."}
    
        except HTTPException:
            raise  # Re-raise HTTP exceptions
        except Exception as e:
            logger.error(f"Error in verify_email_validation: {type(e).__name__}: {str(e)}", exc_info=True)
            db.rollback()
            raise HTTPException(
                
                status_code=500,
                detail="An error occurred during email verification"
        )