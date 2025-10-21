from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
import time
from PIL import Image
import io

from backend.db.database import get_db
from backend.models.user import User
from backend.models.profile import UserProfile
from backend.models import schemas
from backend.utils.auth import get_current_user, get_password_hash, verify_password

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
        db.commit()
        db.refresh(profile)
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
        db.commit()
        db.refresh(existing_profile)
        return existing_profile
    else:
        # Create new profile
        new_profile = UserProfile(user_id=current_user.id, **profile_data.dict(exclude_unset=True))
        db.add(new_profile)
        db.commit()
        db.refresh(new_profile)
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
    db.commit()
    
    return {"message": "Password updated successfully"}

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload user avatar"""
    print(f"Received file upload request:")
    print(f"  - Filename: {file.filename}")
    print(f"  - Content-Type: {file.content_type}")
    print(f"  - User ID: {current_user.id}")

    # Validate file type
    if not file.content_type.startswith("image/"):
        print(f"ERROR: Invalid content type: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File must be an image. Received: {file.content_type}"
        )

    # Generate unique filename
    file_extension = file.filename.split(".")[-1].lower()
    print(f"  - File extension: {file_extension}")

    if file_extension not in ["jpg", "jpeg", "png", "gif", "webp"]:
        print(f"ERROR: Unsupported extension: {file_extension}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported image format '{file_extension}'. Please use JPG, PNG, GIF, or WebP"
        )
    
    # Create user-specific directory
    user_avatar_dir = os.path.join(AVATAR_DIR, str(current_user.id))
    os.makedirs(user_avatar_dir, exist_ok=True)
    
    # Generate UUID filename
    filename = f"{uuid.uuid4().hex}.{file_extension}"
    file_path = os.path.join(user_avatar_dir, filename)
    
    # Read and process image
    contents = await file.read()
    
    # Resize image to reasonable size (max 500x500)
    try:
        image = Image.open(io.BytesIO(contents))
        image.thumbnail((500, 500), Image.Resampling.LANCZOS)
        
        # Save processed image
        image.save(file_path, optimize=True, quality=85)
        
        # Remove old avatar files if exist
        for old_file in os.listdir(user_avatar_dir):
            if old_file != filename:
                try:
                    os.remove(os.path.join(user_avatar_dir, old_file))
                except:
                    pass
        
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
        db.commit()
        db.refresh(profile)
        
        return {
            "message": "Avatar uploaded successfully",
            "filename": filename,
            "url": avatar_url_with_cache  # Include timestamp for cache busting
        }
    except Exception as e:
        print(f"ERROR processing image: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
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
        for avatar_file in os.listdir(user_avatar_dir):
            try:
                os.remove(os.path.join(user_avatar_dir, avatar_file))
            except:
                pass
        try:
            os.rmdir(user_avatar_dir)
        except:
            pass
    
    # Update avatar URL in database
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if profile:
        profile.avatar_url = None
        db.commit()
    
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
