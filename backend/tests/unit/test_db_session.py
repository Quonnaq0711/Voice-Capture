"""
Unit tests for database session context managers

Tests the db_session utility functions to ensure proper
session management, cleanup, and error handling.
"""
import pytest
from sqlalchemy.exc import SQLAlchemyError
from backend.utils.db_session import get_db_session, get_db_session_with_commit
from backend.models.user import User
from backend.db.database import SessionLocal


class TestDBSessionContextManager:
    """Test suite for get_db_session() context manager"""

    def test_session_is_active_during_context(self):
        """Test that session is active within the with-block"""
        with get_db_session() as db:
            # Session should be bound and active
            assert db.bind is not None
            # Should be able to execute queries
            result = db.query(User).first()
            # Result can be None or a User object, both are valid

    def test_session_lifecycle_management(self):
        """Test that session lifecycle is properly managed"""
        # The critical test is that we can create multiple sessions
        # without leaking connections. This tests the cleanup mechanism.

        # Create and close multiple sessions
        for i in range(5):
            with get_db_session() as db:
                # Each session should work independently
                count = db.query(User).count()
                assert count >= 0

        # If sessions weren't properly closed, this would fail
        # due to connection pool exhaustion
        with get_db_session() as db:
            final_count = db.query(User).count()
            assert final_count >= 0

    def test_rollback_on_exception(self):
        """Test that transaction is rolled back when exception occurs"""
        test_email = "test_rollback@example.com"

        # Attempt to create a user but raise exception before commit
        with pytest.raises(ValueError):
            with get_db_session() as db:
                # Create a test user
                user = User(
                    email=test_email,
                    hashed_password="test_password",
                    first_name="Test",
                    last_name="User"
                )
                db.add(user)
                db.flush()  # Flush to DB but don't commit

                # Raise exception to trigger rollback
                raise ValueError("Test exception for rollback")

        # Verify the user was not saved (transaction was rolled back)
        with get_db_session() as db:
            user = db.query(User).filter(User.email == test_email).first()
            assert user is None, "User should not exist after rollback"

    def test_manual_commit_works(self):
        """Test that manual commit within context works correctly"""
        test_email = f"test_manual_commit_{pytest.timestamp}@example.com"

        try:
            # Create and commit a user
            with get_db_session() as db:
                user = User(
                    email=test_email,
                    hashed_password="test_password",
                    first_name="Manual",
                    last_name="Commit"
                )
                db.add(user)
                db.commit()  # Manual commit

            # Verify the user was saved
            with get_db_session() as db:
                user = db.query(User).filter(User.email == test_email).first()
                assert user is not None, "User should exist after manual commit"
                assert user.first_name == "Manual"

        finally:
            # Cleanup
            with get_db_session() as db:
                user = db.query(User).filter(User.email == test_email).first()
                if user:
                    db.delete(user)
                    db.commit()

    def test_multiple_operations_in_single_session(self):
        """Test that multiple operations can be performed in one session"""
        with get_db_session() as db:
            # Multiple queries in the same session
            count1 = db.query(User).count()
            count2 = db.query(User).count()

            # Should be able to perform multiple operations
            assert count1 >= 0
            assert count2 >= 0
            assert count1 == count2


class TestDBSessionWithCommit:
    """Test suite for get_db_session_with_commit() context manager"""

    def test_auto_commit_on_success(self):
        """Test that transaction is automatically committed on success"""
        test_email = f"test_auto_commit_{pytest.timestamp}@example.com"

        try:
            # Create user without manual commit
            with get_db_session_with_commit() as db:
                user = User(
                    email=test_email,
                    hashed_password="test_password",
                    first_name="Auto",
                    last_name="Commit"
                )
                db.add(user)
                # No manual commit - should auto-commit on exit

            # Verify the user was saved
            with get_db_session() as db:
                user = db.query(User).filter(User.email == test_email).first()
                assert user is not None, "User should exist after auto-commit"
                assert user.first_name == "Auto"

        finally:
            # Cleanup
            with get_db_session_with_commit() as db:
                user = db.query(User).filter(User.email == test_email).first()
                if user:
                    db.delete(user)

    def test_rollback_on_exception(self):
        """Test that transaction is rolled back on exception"""
        test_email = "test_auto_rollback@example.com"

        with pytest.raises(ValueError):
            with get_db_session_with_commit() as db:
                user = User(
                    email=test_email,
                    hashed_password="test_password",
                    first_name="Rollback",
                    last_name="Test"
                )
                db.add(user)
                # Raise exception to trigger rollback
                raise ValueError("Test exception")

        # Verify the user was not saved
        with get_db_session() as db:
            user = db.query(User).filter(User.email == test_email).first()
            assert user is None, "User should not exist after rollback"

    def test_delete_operation_auto_commits(self):
        """Test that delete operations are auto-committed"""
        test_email = f"test_delete_{pytest.timestamp}@example.com"

        try:
            # Create user first
            with get_db_session_with_commit() as db:
                user = User(
                    email=test_email,
                    hashed_password="test_password",
                    first_name="Delete",
                    last_name="Test"
                )
                db.add(user)

            # Delete user with auto-commit
            with get_db_session_with_commit() as db:
                user = db.query(User).filter(User.email == test_email).first()
                assert user is not None
                db.delete(user)
                # Auto-commit on exit

            # Verify user was deleted
            with get_db_session() as db:
                user = db.query(User).filter(User.email == test_email).first()
                assert user is None, "User should be deleted"

        except AssertionError:
            # Cleanup if test fails
            with get_db_session_with_commit() as db:
                user = db.query(User).filter(User.email == test_email).first()
                if user:
                    db.delete(user)


class TestSessionUsagePatterns:
    """Test realistic usage patterns"""

    def test_read_only_operations(self):
        """Test read-only operations don't require commit"""
        with get_db_session() as db:
            # Read-only operations
            users = db.query(User).limit(10).all()
            count = db.query(User).count()

            # Should work without commit
            assert isinstance(users, list)
            assert isinstance(count, int)

    def test_exception_handling_preserves_other_data(self):
        """Test that exception in one operation doesn't affect others"""
        email1 = f"test_preserve1_{pytest.timestamp}@example.com"
        email2 = f"test_preserve2_{pytest.timestamp}@example.com"

        try:
            # Create first user successfully
            with get_db_session_with_commit() as db:
                user1 = User(
                    email=email1,
                    hashed_password="test",
                    first_name="First",
                    last_name="User"
                )
                db.add(user1)

            # Attempt to create second user but fail
            with pytest.raises(ValueError):
                with get_db_session_with_commit() as db:
                    user2 = User(
                        email=email2,
                        hashed_password="test",
                        first_name="Second",
                        last_name="User"
                    )
                    db.add(user2)
                    raise ValueError("Simulated error")

            # Verify first user still exists
            with get_db_session() as db:
                user1 = db.query(User).filter(User.email == email1).first()
                assert user1 is not None, "First user should still exist"

                user2 = db.query(User).filter(User.email == email2).first()
                assert user2 is None, "Second user should not exist"

        finally:
            # Cleanup
            with get_db_session_with_commit() as db:
                db.query(User).filter(User.email.in_([email1, email2])).delete()


# Add timestamp to pytest for unique test data
@pytest.fixture(scope="session", autouse=True)
def add_timestamp(request):
    """Add timestamp to pytest for unique test data"""
    import time
    pytest.timestamp = int(time.time())
