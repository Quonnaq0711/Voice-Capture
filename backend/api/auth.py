import logging
import os
import re
from fastapi import APIRouter, Body, Depends, HTTPException, status, UploadFile, File, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
from typing import List
import aiofiles

from backend.utils.rate_limiter import (
    login_limiter, signup_limiter, password_reset_limiter, otp_limiter,
    get_client_ip, check_rate_limit
)

logger = logging.getLogger(__name__)

from backend.services.email_service import EmailService
from backend.services.otp_service import OTPService
from backend.services.email_validation_service import EmailValidationService
from backend.services.password_reset_service import PasswordResetService
from backend.models import schemas
from backend.models.user import User
from backend.models.refresh_token import RefreshToken
from backend.utils.auth import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    REFRESH_TOKEN_EXPIRE_DAYS
)
from backend.db.database import get_db

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
    request: Request,
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    email_validation_service: EmailValidationService = Depends(get_email_validation_service)
):
    # Rate limiting - prevent brute force registration attempts
    client_ip = get_client_ip(request)
    check_rate_limit(signup_limiter, client_ip, "Too many signup attempts. Please try again later.")

    # Check if email already exists
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    # # Check if username already exists
    # db_user = db.query(User).filter(User.username == user.username).first()
    # if db_user:
    #     raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken")
    
    # Create new user (unverified)
    hashed_password = get_password_hash(user.password)
    db_user = User(
        # username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
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
    # Verify the registration OTP and activate the user account.
    logger.debug(f"Verify registration request for email: {request.email}")

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
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Rate limiting - prevent brute force login attempts
    client_ip = get_client_ip(request)
    check_rate_limit(login_limiter, client_ip, "Too many login attempts. Please try again later.")

    # Verify user (OAuth2PasswordRequestForm uses 'username' field, which contains the email)
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active (email verified)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Please verify your email address before logging in",
        )

    # Verify password
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last_login timestamp for scheduler tracking
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    # Create access token (short-lived)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    # Create refresh token (long-lived)
    refresh_token_expires = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token(
        data={"sub": user.email}, expires_delta=refresh_token_expires
    )

    # Store refresh token in database
    db_refresh_token = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + refresh_token_expires
    )
    db.add(db_refresh_token)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to store refresh token: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete login. Please try again."
        )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

# Password reset endpoints
@router.post("/reset-password-request", response_model=schemas.PasswordResetResponse)
async def reset_password_request(
    http_request: Request,
    request: schemas.PasswordResetRequestModel,
    db: Session = Depends(get_db),
    password_reset_service: PasswordResetService = Depends(get_password_reset_service)
):
    # Rate limiting - prevent password reset abuse
    client_ip = get_client_ip(http_request)
    check_rate_limit(password_reset_limiter, f"{client_ip}:{request.email}",
                    "Too many password reset attempts. Please try again later.")

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

def validate_password_complexity(password: str) -> tuple[bool, str]:
    """
    Validate password complexity requirements.
    Returns (is_valid, error_message).
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one digit"
    return True, ""

@router.post("/reset-password-confirm", response_model=schemas.PasswordResetResponse)
async def reset_password_confirm(
    request: schemas.PasswordResetConfirmModel,
    db: Session = Depends(get_db),
    password_reset_service: PasswordResetService = Depends(get_password_reset_service)
):
    logger.info(f"Password reset attempt for email: {request.email}")

    # Password complexity validation
    is_valid, error_msg = validate_password_complexity(request.new_password)
    if not is_valid:
        logger.warning(f"Password validation failed for email: {request.email}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
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
async def refresh_token_endpoint(
    refresh_token: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    """
    Refresh access token using refresh token

    This endpoint implements the standard OAuth2 refresh token flow:
    1. Verify the refresh token JWT signature and expiration
    2. Check if the refresh token exists in database and is not revoked
    3. Generate new access token and new refresh token
    4. Revoke old refresh token (one-time use)
    5. Store new refresh token in database

    Security features:
    - Refresh tokens are one-time use only
    - Expired or revoked tokens are rejected
    - All refresh tokens are tracked in database
    """
    # Verify refresh token JWT
    email = verify_refresh_token(refresh_token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if refresh token exists in database and is valid
    db_refresh_token = db.query(RefreshToken).filter(
        RefreshToken.token == refresh_token
    ).first()

    if not db_refresh_token or not db_refresh_token.is_valid():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Get user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Revoke old refresh token (one-time use)
    db_refresh_token.revoke()
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to revoke old refresh token: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh token. Please try again."
        )

    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    new_access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    # Create new refresh token
    refresh_token_expires = timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    new_refresh_token = create_refresh_token(
        data={"sub": user.email}, expires_delta=refresh_token_expires
    )

    # Store new refresh token in database
    new_db_refresh_token = RefreshToken(
        token=new_refresh_token,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + refresh_token_expires
    )
    db.add(new_db_refresh_token)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to store new refresh token: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to refresh token. Please try again."
        )

    return {
        "access_token": new_access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }

@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Logout endpoint - revokes all refresh tokens for the current user

    This endpoint provides secure logout by:
    1. Revoking all active refresh tokens for the user
    2. Preventing token reuse after logout
    3. Following security best practices (OWASP)

    Note: Access tokens cannot be revoked (they are stateless JWT),
    but they will expire after 2 hours. Revoking refresh tokens
    prevents obtaining new access tokens.
    """
    # Revoke all active refresh tokens for this user
    active_tokens = db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked == False
    ).all()

    revoked_count = 0
    for token in active_tokens:
        token.revoke()
        revoked_count += 1

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to revoke tokens during logout: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete logout. Please try again."
        )

    return {
        "message": "Successfully logged out",
        "revoked_tokens": revoked_count
    }

# Resume Functions

import uuid
from backend.models.resume import Resume
from backend.utils.file_validator import FileValidator

@router.post("/upload-resume", response_model=schemas.ResumeUploadResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a resume file for the current user.

    Security features:
    - File size validation (max 10MB)
    - File extension validation (.pdf, .docx, .txt only)
    - Filename sanitization (prevent path traversal)
    - UUID-based filename (prevent overwrites and conflicts)

    Args:
        file: Resume file to upload
        current_user: Current authenticated user
        db: Database session

    Returns:
        ResumeUploadResponse with filename and success message

    Raises:
        HTTPException 400: Invalid file format or empty file
        HTTPException 413: File size exceeds limit
    """
    # Validate file (size, extension, content)
    content, file_extension = await FileValidator.validate_resume(file)

    # Sanitize original filename
    safe_original_filename = FileValidator.validate_filename(file.filename)

    # Create user directory if not exists
    # Use /app/resumes for Docker volume mount, fallback to backend/resumes for local dev
    if os.path.exists("/app/resumes"):
        base_resume_dir = "/app/resumes"
    else:
        base_resume_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "resumes")
    user_resume_dir = os.path.join(base_resume_dir, str(current_user.id))
    os.makedirs(user_resume_dir, exist_ok=True)

    # Generate UUID for filename (prevent overwrites and conflicts)
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(user_resume_dir, unique_filename)

    # Save file to disk
    try:
        async with aiofiles.open(file_path, 'wb') as out_file:
            await out_file.write(content)
    except Exception as e:
        logger.error(f"Failed to save resume file: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save file. Please try again."
        )

    # Create resume record in database
    try:
        db_resume = Resume(
            filename=unique_filename,
            original_filename=safe_original_filename,
            file_path=file_path,
            file_type=file_extension[1:],  # Remove the dot
            user_id=current_user.id
        )
        db.add(db_resume)
        db.commit()
        db.refresh(db_resume)
    except Exception as e:
        # Clean up file if database operation fails
        if os.path.exists(file_path):
            os.remove(file_path)
        logger.error(f"Failed to save resume metadata: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save resume. Please try again."
        )

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
