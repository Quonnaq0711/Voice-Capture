from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
import time
from PIL import Image
import io
import logging

from backend.db.database import get_db
from backend.models.user import User
from backend.models.profile import UserProfile
from backend.models import schemas
from backend.utils.auth import get_current_user, get_password_hash, verify_password

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/profile", tags=["profile"])

# Avatar upload directory
# Use /app/avatars for Docker volume mount, fallback to backend/avatars for local dev
if os.path.exists("/app/avatars"):
    AVATAR_DIR = "/app/avatars"
else:
    AVATAR_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

@router.get("/me", response_model=schemas.UserWithProfile)
async def get_current_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user information with profile"""
    user = db.query(User).filter(User.id == current_user.id).first()
    return user

@router.get("/profile", response_model=schemas.UserProfile)
async def get_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user profile"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        # Create empty profile if doesn't exist with default avatar
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)
        try:
            db.commit()
            db.refresh(profile)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create profile: {str(e)}"
            )
    return profile

@router.post("/profile", response_model=schemas.UserProfile)
async def create_or_update_profile(
    profile_data: schemas.UserProfileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update user profile"""
    existing_profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    
    if existing_profile:
        # Update existing profile
        for field, value in profile_data.dict(exclude_unset=True).items():
            setattr(existing_profile, field, value)
        try:
            db.commit()
            db.refresh(existing_profile)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update profile: {str(e)}"
            )
        return existing_profile
    else:
        # Create new profile
        new_profile = UserProfile(user_id=current_user.id, **profile_data.dict(exclude_unset=True))
        db.add(new_profile)
        try:
            db.commit()
            db.refresh(new_profile)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create profile: {str(e)}"
            )
        return new_profile

@router.put("/password")
async def change_password(
    password_data: schemas.PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update password: {str(e)}"
        )

    return {"message": "Password updated successfully"}

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload user avatar image with comprehensive security validations.

    Security features:
    - File size validation (max 5MB)
    - File type validation (images only)
    - Filename sanitization (prevent path traversal)
    - Image processing and optimization
    - Automatic resize to 500x500 max

    Args:
        file: Avatar image file to upload
        current_user: Current authenticated user
        db: Database session

    Returns:
        Success message with avatar URL

    Raises:
        HTTPException 400: Invalid file format or empty file
        HTTPException 413: File size exceeds limit
    """
    from backend.utils.file_validator import FileValidator

    logger.info(f"Avatar upload request - User: {current_user.id}, Filename: {file.filename}, Type: {file.content_type}")

    # Validate file (size, extension, content)
    contents, file_extension = await FileValidator.validate_avatar(file)

    # file_extension comes with dot, so remove it
    file_extension = file_extension[1:] if file_extension.startswith('.') else file_extension

    # Validate user_id doesn't contain path traversal characters
    user_id_str = str(current_user.id)
    if any(char in user_id_str for char in ['/', '\\', '..']):
        logger.error(f"Invalid user_id detected: {user_id_str}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID"
        )

    # Create user-specific directory with path traversal protection
    user_avatar_dir = os.path.normpath(os.path.join(AVATAR_DIR, user_id_str))

    # Security check: ensure final path is still under AVATAR_DIR
    if not user_avatar_dir.startswith(os.path.normpath(AVATAR_DIR)):
        logger.error(f"Path traversal attempt detected: {user_avatar_dir}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    os.makedirs(user_avatar_dir, exist_ok=True)

    # Generate UUID filename
    filename = f"{uuid.uuid4().hex}.{file_extension}"
    file_path = os.path.normpath(os.path.join(user_avatar_dir, filename))

    # Final security check: ensure file path is under user_avatar_dir
    if not file_path.startswith(user_avatar_dir):
        logger.error(f"Path traversal attempt in file path: {file_path}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Process image (contents already read during validation)
    # Resize image to reasonable size (max 500x500)
    try:
        image = Image.open(io.BytesIO(contents))
        image.thumbnail((500, 500), Image.Resampling.LANCZOS)
        
        # Save processed image
        image.save(file_path, optimize=True, quality=85)
        
        # Remove old avatar files if exist
        for old_file in os.listdir(user_avatar_dir):
            if old_file != filename:
                old_file_path = os.path.join(user_avatar_dir, old_file)
                try:
                    os.remove(old_file_path)
                    logger.debug(f"Removed old avatar file: {old_file_path}")
                except FileNotFoundError:
                    logger.debug(f"Old avatar file already removed: {old_file_path}")
                except PermissionError as e:
                    logger.error(f"Permission denied removing old avatar {old_file_path}: {str(e)}")
                except Exception as e:
                    logger.error(f"Unexpected error removing old avatar {old_file_path}: {str(e)}", exc_info=True)
        
        # Update avatar URL in database with timestamp for cache busting
        timestamp = int(time.time())
        avatar_url = f"/avatars/{current_user.id}/{filename}"
        avatar_url_with_cache = f"{avatar_url}?t={timestamp}"
        
        profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
        if not profile:
            profile = UserProfile(user_id=current_user.id, avatar_url=avatar_url)
            db.add(profile)
        else:
            profile.avatar_url = avatar_url
        try:
            db.commit()
            db.refresh(profile)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save avatar URL: {str(e)}"
            )
        
        return {
            "message": "Avatar uploaded successfully",
            "filename": filename,
            "url": avatar_url_with_cache  # Include timestamp for cache busting
        }
    except Exception as e:
        logger.error(f"Error processing avatar image for user {current_user.id}: {type(e).__name__}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process image: {str(e)}"
        )

@router.delete("/avatar")
async def delete_avatar(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Delete user avatar"""
    # Delete user's avatar directory and files
    user_avatar_dir = os.path.join(AVATAR_DIR, str(current_user.id))
    
    if os.path.exists(user_avatar_dir):
        # Delete all avatar files in the directory
        for avatar_file in os.listdir(user_avatar_dir):
            avatar_file_path = os.path.join(user_avatar_dir, avatar_file)
            try:
                os.remove(avatar_file_path)
                logger.debug(f"Deleted avatar file: {avatar_file_path}")
            except FileNotFoundError:
                logger.debug(f"Avatar file already deleted: {avatar_file_path}")
            except PermissionError as e:
                logger.error(f"Permission denied deleting avatar {avatar_file_path}: {str(e)}")
            except Exception as e:
                logger.error(f"Unexpected error deleting avatar {avatar_file_path}: {str(e)}", exc_info=True)

        # Delete the directory itself
        try:
            os.rmdir(user_avatar_dir)
            logger.debug(f"Removed avatar directory: {user_avatar_dir}")
        except OSError as e:
            # Directory might not be empty or permission issue
            logger.warning(f"Could not remove avatar directory {user_avatar_dir}: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error removing avatar directory {user_avatar_dir}: {str(e)}", exc_info=True)
    
    # Update avatar URL in database
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.avatar_url = None
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update profile after avatar deletion: {str(e)}"
            )

    return {"message": "Avatar deleted successfully"}

@router.get("/avatar")
async def get_avatar_url(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user's avatar URL"""
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()

    if profile is not None and profile.avatar_url is not None and profile.avatar_url.strip():
        # Return relative path for frontend to handle (works in both dev and prod)
        return {"url": profile.avatar_url}
    else:
        # Return default avatar URL when user has no custom avatar
        return {"url": "/avatars/default.png"}
