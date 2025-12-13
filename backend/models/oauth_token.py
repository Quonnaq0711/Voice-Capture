"""
OAuth Token Model

Stores encrypted OAuth tokens for third-party integrations (Google, Microsoft, Slack, etc.).
Tokens are encrypted at rest using Fernet symmetric encryption.
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from cryptography.fernet import Fernet
import os
import json
import base64

from backend.db.database import Base
from backend.db.types import TZDateTime


def utc_now():
    """Return current UTC time as timezone-aware datetime"""
    return datetime.now(timezone.utc)


def get_encryption_key():
    """Get or generate encryption key for OAuth tokens."""
    key = os.getenv("OAUTH_ENCRYPTION_KEY")
    if not key:
        # For development, generate a key (in production, this should be set in env)
        key = Fernet.generate_key().decode()
        os.environ["OAUTH_ENCRYPTION_KEY"] = key
    # Ensure key is proper base64 format
    if len(key) == 44:  # Standard Fernet key length
        return key.encode()
    # If stored as regular string, convert to valid Fernet key
    return base64.urlsafe_b64encode(key.encode()[:32].ljust(32, b'0'))


class OAuthToken(Base):
    """
    OAuth Token storage model.

    Stores encrypted OAuth tokens for various providers:
    - google: Gmail, Google Calendar
    - microsoft: Outlook, Teams, OneDrive
    - slack: Slack workspace
    - atlassian: Jira, Confluence
    - github: GitHub

    Each user can have multiple tokens per provider (multiple accounts).
    """
    __tablename__ = "oauth_tokens"

    # Ensure unique combination of user + provider + account identifier
    __table_args__ = (
        UniqueConstraint('user_id', 'provider', 'account_email', name='unique_user_provider_account'),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)

    # Provider info
    provider = Column(String(50), nullable=False, index=True)  # google, microsoft, slack, etc.
    account_email = Column(String(255), nullable=True)  # Email/identifier for the connected account
    account_name = Column(String(255), nullable=True)  # Display name

    # Encrypted tokens
    access_token_encrypted = Column(Text, nullable=False)
    refresh_token_encrypted = Column(Text, nullable=True)

    # Token metadata
    token_type = Column(String(50), default="Bearer")
    expires_at = Column(DateTime, nullable=True)
    scopes = Column(Text, nullable=True)  # JSON array of granted scopes

    # Additional provider-specific data (JSON)
    # e.g., workspace for Slack, organization for GitHub
    # Note: 'metadata' is reserved in SQLAlchemy, using 'extra_data' instead
    extra_data = Column(Text, nullable=True)

    # Token status - tracks if token has been revoked or is otherwise invalid
    is_revoked = Column(Integer, default=0)  # 0 = valid, 1 = revoked/invalid
    revoked_reason = Column(String(255), nullable=True)  # Reason for revocation

    # Timestamps
    created_at = Column(TZDateTime, default=utc_now)
    updated_at = Column(TZDateTime, default=utc_now, onupdate=utc_now)

    # Relationship
    user = relationship("User", back_populates="oauth_tokens")

    @staticmethod
    def _get_cipher():
        """Get Fernet cipher for encryption/decryption."""
        key = get_encryption_key()
        return Fernet(key)

    def set_access_token(self, token: str):
        """Encrypt and store access token."""
        if token:
            cipher = self._get_cipher()
            self.access_token_encrypted = cipher.encrypt(token.encode()).decode()

    def get_access_token(self) -> str:
        """Decrypt and return access token."""
        if self.access_token_encrypted:
            cipher = self._get_cipher()
            return cipher.decrypt(self.access_token_encrypted.encode()).decode()
        return None

    def set_refresh_token(self, token: str):
        """Encrypt and store refresh token."""
        if token:
            cipher = self._get_cipher()
            self.refresh_token_encrypted = cipher.encrypt(token.encode()).decode()

    def get_refresh_token(self) -> str:
        """Decrypt and return refresh token."""
        if self.refresh_token_encrypted:
            cipher = self._get_cipher()
            return cipher.decrypt(self.refresh_token_encrypted.encode()).decode()
        return None

    def set_scopes(self, scopes: list):
        """Store scopes as JSON."""
        self.scopes = json.dumps(scopes) if scopes else None

    def get_scopes(self) -> list:
        """Return scopes as list."""
        if self.scopes:
            return json.loads(self.scopes)
        return []

    def set_metadata(self, data: dict):
        """Store additional metadata as JSON."""
        self.extra_data = json.dumps(data) if data else None

    def get_metadata(self) -> dict:
        """Return metadata as dict."""
        if self.extra_data:
            return json.loads(self.extra_data)
        return {}

    def is_expired(self) -> bool:
        """Check if access token is expired."""
        if self.expires_at:
            return datetime.now(timezone.utc) >= self.expires_at.replace(tzinfo=timezone.utc)
        return False

    def is_valid(self) -> bool:
        """Check if token connection is valid.

        Note: Access tokens expire frequently (~1 hour for Google), but this doesn't
        mean the connection is invalid. As long as we have a refresh token and
        the token hasn't been explicitly revoked, the connection is valid.

        Returns False only if token is explicitly revoked (e.g., user revoked
        access in Google settings, or refresh failed multiple times).
        """
        return not self.is_revoked

    def needs_refresh(self) -> bool:
        """Check if access token needs to be refreshed."""
        return self.is_expired()

    def mark_as_revoked(self, reason: str = "Token refresh failed"):
        """Mark token as revoked/invalid."""
        self.is_revoked = 1
        self.revoked_reason = reason

    def reactivate(self):
        """Reactivate a previously revoked token (e.g., after re-authorization)."""
        self.is_revoked = 0
        self.revoked_reason = None

    def to_dict(self) -> dict:
        """Return safe dictionary representation (no tokens)."""
        return {
            "id": self.id,
            "provider": self.provider,
            "account_email": self.account_email,
            "account_name": self.account_name,
            "scopes": self.get_scopes(),
            "metadata": self.get_metadata(),
            "is_valid": self.is_valid(),  # True unless explicitly revoked
            "needs_refresh": self.needs_refresh(),  # True if access token expired
            "is_expired": self.is_expired(),  # Deprecated: use needs_refresh
            "is_revoked": bool(self.is_revoked),
            "revoked_reason": self.revoked_reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
