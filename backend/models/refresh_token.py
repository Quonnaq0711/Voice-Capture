"""
Refresh Token Model

This model stores refresh tokens for JWT authentication.
Refresh tokens have a longer lifespan than access tokens and are used
to obtain new access tokens without requiring re-authentication.

Security features:
- Each refresh token is stored in the database for tracking
- Tokens can be revoked (e.g., on logout or security breach)
- Automatic cleanup of expired tokens
- One-time use: each refresh generates a new refresh token
"""

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from backend.db.database import Base


class RefreshToken(Base):
    """Refresh Token Model"""
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)  # Already indexed (unique)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)  # Index for user queries

    # Expiry and revocation
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)  # Index for cleanup queries
    revoked = Column(Boolean, default=False, nullable=False, index=True)  # Index for validity checks

    # Metadata for security tracking
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    # Optional: track device/IP for security
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)

    # Relationship
    user = relationship("User", back_populates="refresh_tokens")

    def is_valid(self) -> bool:
        """Check if refresh token is still valid"""
        if self.revoked:
            return False
        if self.expires_at < datetime.now(timezone.utc):
            return False
        return True

    def revoke(self):
        """Revoke this refresh token"""
        self.revoked = True
        self.revoked_at = datetime.now(timezone.utc)
