"""
Custom SQLAlchemy types for timezone-aware datetime handling.
This ensures consistent timezone handling across SQLite and PostgreSQL.
"""
from datetime import datetime, timezone
from sqlalchemy import types


class TZDateTime(types.TypeDecorator):
    """
    Custom DateTime type that ensures timezone-aware datetimes.

    - Stores datetimes in UTC
    - Returns timezone-aware datetimes when reading from database
    - Works with both SQLite (no native timezone support) and PostgreSQL
    """
    impl = types.DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """
        Convert timezone-aware datetime to naive UTC before storing.
        SQLite doesn't support timezone, so we store as naive UTC.
        """
        if value is not None:
            if value.tzinfo is None:
                # If naive, assume it's already UTC
                return value
            # Convert to UTC and make it naive for storage
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        """
        Convert naive UTC datetime from database to timezone-aware.
        This ensures consistency when comparing with datetime.now(timezone.utc).
        """
        if value is not None and value.tzinfo is None:
            # Assume stored datetime is UTC, make it timezone-aware
            return value.replace(tzinfo=timezone.utc)
        return value
