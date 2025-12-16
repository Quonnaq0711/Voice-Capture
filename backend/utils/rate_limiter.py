"""
Rate limiting utilities for API endpoints.

This module provides a simple in-memory rate limiter to protect
against brute force attacks on authentication endpoints.
"""

import time
import threading
from collections import defaultdict
from typing import Tuple
from fastapi import HTTPException, Request, status
import logging

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Thread-safe in-memory rate limiter using sliding window algorithm.

    Attributes:
        requests_per_window: Maximum number of requests allowed per window
        window_seconds: Time window in seconds
    """

    def __init__(self, requests_per_window: int = 5, window_seconds: int = 60):
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self._requests = defaultdict(list)  # key -> list of timestamps
        self._lock = threading.Lock()

    def _cleanup_old_requests(self, key: str, current_time: float) -> None:
        """Remove requests outside the current window."""
        cutoff = current_time - self.window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

    def is_allowed(self, key: str) -> Tuple[bool, int]:
        """
        Check if a request is allowed for the given key.

        Args:
            key: Identifier for rate limiting (e.g., IP address, email)

        Returns:
            Tuple of (is_allowed, retry_after_seconds)
        """
        current_time = time.time()

        with self._lock:
            self._cleanup_old_requests(key, current_time)

            if len(self._requests[key]) >= self.requests_per_window:
                # Calculate when the oldest request will expire
                oldest = min(self._requests[key])
                retry_after = int(oldest + self.window_seconds - current_time) + 1
                return False, max(1, retry_after)

            self._requests[key].append(current_time)
            return True, 0

    def get_remaining(self, key: str) -> int:
        """Get remaining requests for the given key in the current window."""
        current_time = time.time()

        with self._lock:
            self._cleanup_old_requests(key, current_time)
            return max(0, self.requests_per_window - len(self._requests[key]))


# Global rate limiters for different endpoints
# Login: 5 attempts per minute per IP
login_limiter = RateLimiter(requests_per_window=5, window_seconds=60)

# Signup: 3 attempts per minute per IP
signup_limiter = RateLimiter(requests_per_window=3, window_seconds=60)

# Password reset: 3 attempts per minute per email
password_reset_limiter = RateLimiter(requests_per_window=3, window_seconds=60)

# OTP verification: 5 attempts per minute per email
otp_limiter = RateLimiter(requests_per_window=5, window_seconds=60)


def get_client_ip(request: Request) -> str:
    """Extract client IP from request, handling proxies."""
    # Check X-Forwarded-For header (set by reverse proxies)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # Take the first IP in the chain (original client)
        return forwarded_for.split(",")[0].strip()

    # Check X-Real-IP header (set by nginx)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct client IP
    return request.client.host if request.client else "unknown"


def check_rate_limit(
    limiter: RateLimiter,
    key: str,
    error_message: str = "Too many requests. Please try again later."
) -> None:
    """
    Check rate limit and raise HTTPException if exceeded.

    Args:
        limiter: The RateLimiter instance to use
        key: The key to check (IP address, email, etc.)
        error_message: Custom error message

    Raises:
        HTTPException: 429 Too Many Requests if rate limit exceeded
    """
    allowed, retry_after = limiter.is_allowed(key)

    if not allowed:
        logger.warning(f"Rate limit exceeded for key: {key}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=error_message,
            headers={"Retry-After": str(retry_after)}
        )
