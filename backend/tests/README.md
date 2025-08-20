# Backend API Tests

This directory contains comprehensive unit tests for all backend API endpoints.

## Test Structure

```
tests/
├── __init__.py              # Test package initialization
├── conftest.py              # Shared test fixtures and configuration
├── run_tests.py             # Test runner script
├── README.md                # This file
└── unit/                    # Unit tests directory
    ├── __init__.py          # Unit test package initialization
    ├── test_auth.py         # Authentication API tests
    ├── test_profile.py      # Profile API tests
    ├── test_chat.py         # Chat API tests
    └── test_sessions.py     # Sessions API tests
```

## Test Coverage

### Authentication API (`test_auth.py`)
- ✅ User registration (success, duplicate email/username, invalid email)
- ✅ User login (success, invalid credentials)
- ✅ Resume upload (PDF/TXT success, invalid format, unauthorized)
- ✅ Get user resumes (success, empty list, unauthorized)
- ✅ Delete resume (success, not found, not owner, unauthorized, file not exists)

### Profile API (`test_profile.py`)
- ✅ Get current user profile (success, unauthorized, no profile)
- ✅ Get user profile by ID (success, unauthorized, not found)
- ✅ Create/Update user profile (success, unauthorized, validation errors)
- ✅ Change password (success, unauthorized, wrong current password, same password)
- ✅ Upload avatar (success, unauthorized, invalid format, file too large)
- ✅ Delete avatar (success, unauthorized, no avatar)
- ✅ Get avatar URL (success, unauthorized, no avatar)

### Chat API (`test_chat.py`)
- ✅ Create chat message (success with/without active session, unauthorized, invalid sender, empty text)
- ✅ Get chat history (success with/without session filter, pagination, empty history, unauthorized)
- ✅ Clear chat history (success, no messages, unauthorized)

### Sessions API (`test_sessions.py`)
- ✅ Create session (success, unauthorized, invalid data, database error)
- ✅ Get user sessions (success, empty list, unauthorized)
- ✅ Get session messages (success, unauthorized, session not found, not owner)
- ✅ Activate session (success, unauthorized, session not found, not owner)
- ✅ Get active session (success, no active session, unauthorized)
- ✅ Delete session (success, unauthorized, session not found, not owner)

## Prerequisites

Before running tests, make sure you have the following installed:

```bash
pip install pytest pytest-cov pytest-asyncio httpx
```

## Running Tests

### Using the Test Runner Script

The easiest way to run tests is using the provided test runner script:

```bash
# Run all tests
python tests/run_tests.py

# Run tests for specific API
python tests/run_tests.py --api profile
python tests/run_tests.py --api auth
python tests/run_tests.py --api chat
python tests/run_tests.py --api sessions

# Run tests with coverage reporting
python tests/run_tests.py --coverage

# Run tests with HTML coverage report
python tests/run_tests.py --html-coverage

# Run tests with verbose output
python tests/run_tests.py --verbose

# Combine options
python tests/run_tests.py --api profile --coverage --verbose
```

### Using pytest Directly

You can also run tests directly with pytest:

```bash
# Run all unit tests
pytest tests/unit/

# Run specific test file
pytest tests/unit/test_profile.py

# Run with coverage
pytest tests/unit/ --cov=backend --cov-report=term-missing

# Run with verbose output
pytest tests/unit/ -v

# Run specific test method
pytest tests/unit/test_profile.py::test_get_current_user_profile_success
```

## Test Configuration

The `conftest.py` file contains shared test fixtures and configuration:

- **Database Setup**: Creates a temporary SQLite database for testing
- **Test Client**: Provides a FastAPI test client
- **User Fixtures**: Creates test users with and without profiles
- **Authentication**: Generates auth headers for testing protected endpoints
- **File Handling**: Creates temporary directories and files for testing file uploads

## Test Database

Tests use a separate SQLite database (`test.db`) that is:
- Created fresh for each test session
- Automatically cleaned up after tests complete
- Isolated from the main application database

## Mocking and Fixtures

The test suite uses pytest fixtures for:
- Database sessions
- Test users and profiles
- Authentication tokens
- Temporary files and directories
- Mock external dependencies

## Best Practices

1. **Isolation**: Each test is independent and doesn't rely on other tests
2. **Cleanup**: All test data is automatically cleaned up
3. **Realistic Data**: Tests use realistic test data that matches production scenarios
4. **Error Cases**: Tests cover both success and error scenarios
5. **Authentication**: Tests verify proper authentication and authorization
6. **Edge Cases**: Tests include edge cases like empty data, invalid formats, etc.

## Adding New Tests

When adding new API endpoints or modifying existing ones:

1. Add test cases to the appropriate test file
2. Follow the existing naming convention: `test_<endpoint>_<scenario>`
3. Include both success and error test cases
4. Use appropriate fixtures from `conftest.py`
5. Ensure proper cleanup of any created resources

## Continuous Integration

These tests are designed to run in CI/CD pipelines. The test runner script provides:
- Clear exit codes (0 for success, 1 for failure)
- Detailed output for debugging
- Coverage reporting for code quality metrics

## Troubleshooting

### Common Issues

1. **Import Errors**: Make sure you're running tests from the backend directory
2. **Database Errors**: Ensure no other processes are using the test database
3. **File Permission Errors**: Check that the test process has write permissions for temporary files
4. **Missing Dependencies**: Install all required packages with `pip install -r requirements.txt`

### Debug Mode

For debugging failing tests:

```bash
# Run with maximum verbosity
pytest tests/unit/test_profile.py -vvv --tb=long

# Run and drop into debugger on failure
pytest tests/unit/test_profile.py --pdb

# Run only failed tests from last run
pytest tests/unit/ --lf
```