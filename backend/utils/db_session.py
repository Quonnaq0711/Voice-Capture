"""
Database Session Context Manager Utilities

Provides safe database session management with automatic cleanup,
rollback on exceptions, and proper resource handling.
"""
import logging
from contextlib import contextmanager
from typing import Generator
from sqlalchemy.orm import Session
from backend.db.database import SessionLocal

logger = logging.getLogger(__name__)


@contextmanager
def get_db_session() -> Generator[Session, None, None]:
    """
    Context manager for database sessions with automatic cleanup.

    Ensures:
    - Session is always closed, even if exceptions occur
    - Automatic rollback on exceptions
    - Proper commit on success
    - Detailed error logging

    Usage:
        with get_db_session() as db:
            # Your database operations
            user = db.query(User).filter(User.id == 1).first()
            # If exception occurs, transaction is automatically rolled back
            # If no exception, you can manually commit
            db.commit()

    Example with automatic commit:
        with get_db_session() as db:
            user = User(email="test@example.com")
            db.add(user)
            db.commit()  # Explicit commit
        # Session automatically closed here

    Example with rollback on error:
        with get_db_session() as db:
            user = User(email="test@example.com")
            db.add(user)
            db.commit()
            # If error occurs here, rollback happens automatically
            raise ValueError("Something went wrong")
        # Session closed and rolled back

    Yields:
        Session: SQLAlchemy database session

    Raises:
        Any exception from the with-block is re-raised after cleanup
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"Database session error, rolling back: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        try:
            db.close()
            logger.debug("Database session closed successfully")
        except Exception as close_error:
            logger.error(f"Error closing database session: {str(close_error)}", exc_info=True)


@contextmanager
def get_db_session_with_commit() -> Generator[Session, None, None]:
    """
    Context manager for database sessions with automatic commit on success.

    Ensures:
    - Session is always closed, even if exceptions occur
    - Automatic rollback on exceptions
    - Automatic commit if no exceptions occur
    - Detailed error logging

    Usage:
        with get_db_session_with_commit() as db:
            user = User(email="test@example.com")
            db.add(user)
            # No need for explicit commit - happens automatically
        # Session committed and closed here

    Example with rollback on error:
        with get_db_session_with_commit() as db:
            user = User(email="test@example.com")
            db.add(user)
            # If error occurs, rollback happens automatically
            raise ValueError("Something went wrong")
        # Session closed, changes rolled back

    Yields:
        Session: SQLAlchemy database session

    Raises:
        Any exception from the with-block is re-raised after rollback
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
        logger.debug("Database session committed successfully")
    except Exception as e:
        logger.error(f"Database session error, rolling back: {str(e)}", exc_info=True)
        db.rollback()
        raise
    finally:
        try:
            db.close()
            logger.debug("Database session closed successfully")
        except Exception as close_error:
            logger.error(f"Error closing database session: {str(close_error)}", exc_info=True)


class DBSessionManager:
    """
    Context manager class for database sessions (alternative to @contextmanager).

    Provides the same functionality as get_db_session() but as a class.
    Useful when you need more control over the session lifecycle.

    Usage:
        async with DBSessionManager() as db:
            user = db.query(User).filter(User.id == 1).first()
            db.commit()
    """

    def __init__(self, auto_commit: bool = False):
        """
        Initialize the session manager.

        Args:
            auto_commit: If True, automatically commit on successful exit
        """
        self.db: Session | None = None
        self.auto_commit = auto_commit

    def __enter__(self) -> Session:
        """Enter the context manager and create a new session"""
        self.db = SessionLocal()
        logger.debug("Database session created")
        return self.db

    def __exit__(self, exc_type, exc_val, exc_tb):
        """
        Exit the context manager and cleanup.

        Args:
            exc_type: Exception type if error occurred
            exc_val: Exception value if error occurred
            exc_tb: Exception traceback if error occurred

        Returns:
            False to propagate exceptions
        """
        if self.db is None:
            return False

        try:
            if exc_type is not None:
                # Exception occurred, rollback
                logger.error(f"Database session error ({exc_type.__name__}), rolling back", exc_info=True)
                self.db.rollback()
            elif self.auto_commit:
                # No exception and auto_commit enabled, commit
                self.db.commit()
                logger.debug("Database session auto-committed successfully")
        except Exception as e:
            logger.error(f"Error during session cleanup: {str(e)}", exc_info=True)
            try:
                self.db.rollback()
            except Exception as rollback_error:
                logger.error(f"Error during rollback: {str(rollback_error)}", exc_info=True)
        finally:
            try:
                self.db.close()
                logger.debug("Database session closed successfully")
            except Exception as close_error:
                logger.error(f"Error closing database session: {str(close_error)}", exc_info=True)

        # Return False to propagate exceptions
        return False


# Convenience functions for async code
async def get_db_session_async() -> Generator[Session, None, None]:
    """
    Async-compatible wrapper for get_db_session().

    Note: SQLAlchemy sessions are not truly async, but this wrapper
    allows usage in async functions without blocking.

    Usage:
        async def my_async_function():
            async for db in get_db_session_async():
                user = db.query(User).filter(User.id == 1).first()
                db.commit()
    """
    with get_db_session() as db:
        yield db
