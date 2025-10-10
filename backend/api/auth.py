import email
import os
from fastapi import APIRouter, Body, Depends, HTTPException, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
from typing import List
import aiofiles

from backend.services import password_reset_service

from backend.services.email_service import EmailService
from backend.services.otp_service import OTPService
from backend.services.email_validation_service import EmailValidationService
from backend.services.password_reset_service import PasswordResetService
from backend.models import schemas
from backend.models.user import User
from backend.utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES
)
from backend.db.database import get_db
from backend.services.email_validation_service import EmailValidationService

from backend.services.password_reset_service import PasswordResetService

router = APIRouter()

def get_email_validation_service() -> EmailValidationService:
    otp_service = OTPService()
    email_service = EmailService()
    return EmailValidationService(otp_service, email_service)

def get_password_reset_service() -> PasswordResetService:
    otp_service = OTPService()
    email_service = EmailService()
    return PasswordResetService(otp_service, email_service)

@router.post("/signup", response_model=schemas.User)
async def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    email_validation_service: EmailValidationService = Depends(get_email_validation_service)
):
    # Check if email already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    # Check if username already exists
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
    
    # Create new user (unverified)
    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        is_active=False,
        hotp_secret=None,
        hotp_counter=0,
        otp_requested_at=None,
        otp_failed_attempts=0,
        otp_locked_until=None,
        otp_purpose=None
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # ✅ Send registration OTP (only once, with correct args)
    await email_validation_service.request_email_validation(db, db_user.email)

    return db_user


@router.post("/verify-registration", response_model=schemas.RegistrationVerificationResponse)
async def confirm_registration_otp(
    request: schemas.VerifyRegistrationRequest,
    db: Session = Depends(get_db),
    email_validation_service: EmailValidationService = Depends(get_email_validation_service)
):
    print(f"Received request: {request}") 

    # Verify the registration OTP and activate the user account.

    try:
        result = await email_validation_service.verify_email_validation (
            db, 
            request.email, 
            request.otp,
        )
        return result
    except HTTPException as e:
        # Re-raise the HTTPException from the OTP service
        raise e
    except Exception as e:
        # Handle any unexpected errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="An error occurred during verification")

# Resend verification OTP for users who didn't receive it or it expired.
import logging

logger = logging.getLogger(__name__)

@router.post("/resend-verification-otp")
async def resend_verification_otp(
    request: schemas.ResendOTPRequest,  # Assuming you're using request body
    db: Session = Depends(get_db),
    email_validation_service: EmailValidationService = Depends(get_email_validation_service)
):    
    logger.info(f"Resend verification OTP request for email: {request.email}")
    
    try:
        # Check if user exists and is not already verified
        user = db.query(User).filter(User.email == request.email).first()
        if not user:
            logger.warning(f"User not found for email: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        if user.is_active:
            logger.warning(f"User already verified for email: {request.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already verified"
            )
        
        logger.info(f"Calling email_validation_request for: {request.email}")
        result = await email_validation_service.request_email_validation(db, request.email)
        logger.info(f"Successfully sent verification email to: {request.email}")
        return result
        
    except HTTPException as e:
        logger.warning(f"HTTP exception in resend_verification_otp: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Unexpected error in resend_verification_otp for {request.email}: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email"
        )

@router.post("/token", response_model=schemas.Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Verify user
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last_login timestamp for scheduler tracking
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Password reset endpoints
@router.post("/reset-password-request", response_model=schemas.PasswordResetResponse)
async def reset_password_request(
    request: schemas.PasswordResetRequestModel,  
    db: Session = Depends(get_db),
    password_reset_service: PasswordResetService = Depends(get_password_reset_service)
):
    
   # Request a password reset OTP for the given email address.
    
    try:
        result = await password_reset_service.password_reset_request(db, request.email)
        return result
    except HTTPException as e:
        # Re-raise HTTP exceptions from the OTP service
        raise e
    except Exception as e:
        # Handle unexpected errors
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send password reset email"
        )

import logging

logger = logging.getLogger(__name__)

@router.post("/reset-password-confirm", response_model=schemas.PasswordResetResponse)
async def reset_password_confirm(
    request: schemas.PasswordResetConfirmModel,  
    db: Session = Depends(get_db),
    password_reset_service: PasswordResetService = Depends(get_password_reset_service)
):
    logger.info(f"Password reset attempt for email: {request.email}")
    
    # Basic password validation
    if len(request.new_password) < 8:
        logger.warning(f"Password too short for email: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )
    
    try:
        result = await password_reset_service.verify_password_otp(
            db, 
            request.email, 
            request.otp,  
            new_password=request.new_password
        )
        logger.info(f"Password reset successful for email: {request.email}")
        return result
    except HTTPException as e:
        logger.warning(f"HTTPException during password reset for {request.email}: {e.detail}")
        raise e
    except Exception as e:
        # Log the full exception details
        logger.error(f"Unexpected error during password reset for {request.email}: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset password"
        )


@router.post("/token/refresh", response_model=schemas.Token)
async def refresh_token(current_user: User = Depends(get_current_user)):
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

# Resume Functions

import uuid
from backend.models.resume import Resume

@router.post("/upload-resume", response_model=schemas.ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Validate file extension
    file_extension = os.path.splitext(file.filename)[1].lower()
    if file_extension not in [".pdf", ".txt"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF and TXT files are allowed"
        )

    # Create user directory if not exists
    base_resume_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "resumes")
    user_resume_dir = os.path.join(base_resume_dir, str(current_user.id))
    os.makedirs(user_resume_dir, exist_ok=True)

    # Generate UUID for filename
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(user_resume_dir, unique_filename)

    # Save file
    async with aiofiles.open(file_path, 'wb') as out_file:
        content = await file.read()
        await out_file.write(content)

    # Create resume record in database
    db_resume = Resume(
        filename=unique_filename,
        original_filename=file.filename,
        file_path=file_path,
        file_type=file_extension[1:],  # Remove the dot
        user_id=current_user.id
    )
    db.add(db_resume)
    db.commit()
    db.refresh(db_resume)

    return {
        "filename": unique_filename,
        "message": "Resume uploaded successfully"
    }

@router.get("/resumes", response_model=List[schemas.Resume])
async def get_user_resumes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all resumes for the current user"""
    resumes = db.query(Resume).filter(Resume.user_id == current_user.id).order_by(Resume.created_at.desc()).all()
    return resumes

@router.delete("/resumes/{resume_id}", response_model=schemas.ResumeDeleteResponse)
async def delete_resume(
    resume_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a resume for the current user"""
    # Get the resume
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == current_user.id
    ).first()
    
    if not resume:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume not found"
        )
    
    # Delete the file
    try:
        os.remove(resume.file_path)
    except OSError:
        # If file doesn't exist, continue with database deletion
        pass
    
    # Delete from database
    db.delete(resume)
    db.commit()
    
    return {"message": "Resume deleted successfully"}
