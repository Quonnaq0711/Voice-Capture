import os
import sys
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from PIL import Image
import io
from datetime import datetime, timedelta

# Add the parent directory to Python path to enable package imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
parent_dir = os.path.dirname(backend_dir)
sys.path.insert(0, parent_dir)

from backend.main import app
from backend.db.database import get_db, Base
from backend.models.user import User
from backend.models.profile import UserProfile
from backend.models.chat import ChatMessage
from backend.models.session import ChatSession
from backend.models.resume import Resume
from backend.utils.auth import get_password_hash, create_access_token

# Create test database
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

@pytest.fixture
def db_session():
    """Create a fresh database session for each test"""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    # Create all tables for this connection
    Base.metadata.create_all(bind=connection)
    
    # Override the dependency to use this session
    def override_get_db():
        try:
            yield session
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    
    yield session
    
    session.close()
    transaction.rollback()
    connection.close()
    
    # Clean up the override
    if get_db in app.dependency_overrides:
        del app.dependency_overrides[get_db]

@pytest.fixture
def client():
    """Create test client"""
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def test_user(db_session):
    """Create a test user"""
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=get_password_hash("testpassword123"),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def test_user_no_profile(db_session):
    """Create a test user without profile"""
    import uuid
    unique_id = str(uuid.uuid4())[:8]
    user = User(
        username=f"testuser_no_profile_{unique_id}",
        email=f"test_no_profile_{unique_id}@example.com",
        hashed_password=get_password_hash("testpassword123"),
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user

@pytest.fixture
def test_user_profile(db_session, test_user):
    """Create a test user with profile"""
    profile = UserProfile(
        user_id=test_user.id,
        current_job="Software Engineer",
        company="Tech Corp",
        industry="Technology",
        experience="3-5 years",
        skills=["Python", "JavaScript", "React"],
        career_goals="Become a senior developer",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(profile)
    db_session.commit()
    db_session.refresh(profile)
    return test_user

@pytest.fixture
def auth_headers(test_user):
    """Create authentication headers for test user"""
    access_token = create_access_token(
        data={"sub": test_user.email},
        expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def auth_headers_no_profile(test_user_no_profile):
    """Create authentication headers for test user without profile"""
    access_token = create_access_token(
        data={"sub": test_user_no_profile.email},
        expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}

@pytest.fixture
def test_session(db_session, test_user):
    """Create a test chat session"""
    session = ChatSession(
        user_id=test_user.id,
        session_name="Test Session",
        first_message_time=datetime.utcnow(),
        is_active=False,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)
    return session

@pytest.fixture
def temp_avatar_dir():
    """Create temporary directory for avatar uploads"""
    with tempfile.TemporaryDirectory() as temp_dir:
        yield temp_dir

@pytest.fixture
def sample_image_file():
    """Create a sample image file for testing"""
    from PIL import Image
    import io
    
    # Create a simple test image
    image = Image.new('RGB', (100, 100), color='red')
    img_bytes = io.BytesIO()
    image.save(img_bytes, format='PNG')
    img_bytes.seek(0)
    
    return img_bytes