# Development Setup Guide

This guide provides step-by-step instructions to set up the Sadaora AI Assistant Platform development environment on a fresh computer.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Python Environment Setup](#python-environment-setup)
3. [Node.js Environment Setup](#nodejs-environment-setup)
4. [Project Setup](#project-setup)
5. [Backend Setup](#backend-setup)
6. [Frontend Setup](#frontend-setup)
7. [Database Setup](#database-setup)
8. [Running the Application](#running-the-application)
9. [Running Tests](#running-tests)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have:
- A computer with Windows, macOS, or Linux
- Internet connection for downloading dependencies
- Administrator/sudo privileges for installing software
- Git installed on your system

## Python Environment Setup

### 1. Install Anaconda

#### Windows:
1. Download Anaconda from [https://www.anaconda.com/download](https://www.anaconda.com/download)
2. Run the installer and follow the installation wizard
3. Choose "Add Anaconda to PATH" during installation (recommended)
4. Restart your command prompt/terminal

#### macOS:
1. Download Anaconda for macOS from the official website
2. Run the `.pkg` installer
3. Follow the installation instructions
4. Restart your terminal

#### Linux:
1. Download the Linux installer:
   ```bash
   wget https://repo.anaconda.com/archive/Anaconda3-2023.09-0-Linux-x86_64.sh
   ```
2. Make it executable and run:
   ```bash
   chmod +x Anaconda3-2023.09-0-Linux-x86_64.sh
   ./Anaconda3-2023.09-0-Linux-x86_64.sh
   ```
3. Follow the prompts and restart your terminal

### 2. Verify Python Installation

```bash
# Check Python version (should be 3.8 or higher)
python --version

# Check conda installation
conda --version

# Check pip installation
pip --version
```

### 3. Create Python Virtual Environment

```bash
# Create a new conda environment for the project
conda create -n sadaora python=3.12

# Activate the environment
conda activate sadaora

# Verify the environment is active
which python  # Should show path with 'sadaora' environment
```

## Node.js Environment Setup

### 1. Install Node.js

#### Option A: Using Node Version Manager (Recommended)

**Windows (using nvm-windows):**
1. Download nvm-windows from [https://github.com/coreybutler/nvm-windows/releases](https://github.com/coreybutler/nvm-windows/releases)
2. Run the installer
3. Open a new command prompt as administrator
4. Install and use Node.js:
   ```cmd
   nvm install 18.18.0
   nvm use 18.18.0
   ```

**macOS/Linux (using nvm):**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source the profile
source ~/.bashrc  # or ~/.zshrc for zsh

# Install and use Node.js
nvm install 18.18.0
nvm use 18.18.0
nvm alias default 18.18.0
```

#### Option B: Direct Installation
1. Download Node.js LTS (18.x) from [https://nodejs.org/](https://nodejs.org/)
2. Run the installer and follow the setup wizard
3. Restart your terminal

### 2. Verify Node.js Installation

```bash
# Check Node.js version (should be 18.x or higher)
node --version

# Check npm version
npm --version
```

## Project Setup

### 1. Clone the Repository

```bash
# Clone the project repository
git clone <repository-url>
cd Product

# Or if you already have the project folder
cd path/to/Product
```

### 2. Project Structure Overview

```
Product/
├── backend/          # FastAPI backend application
├── frontend/         # React frontend application
├── docs/            # Documentation
├── modules/         # AI agent modules
├── config/          # Configuration files
└── scripts/         # Utility scripts
```

## Backend Setup

### 1. Navigate to Backend Directory

```bash
cd backend
```

### 2. Activate Python Environment

```bash
# Activate the conda environment
conda activate sadaora
```

### 3. Install Python Dependencies

```bash
# Install all required packages
pip install -r requirements.txt

# Verify FastAPI installation
python -c "import fastapi; print('FastAPI installed successfully')"
```

### 4. Initialize Project Structure

```bash
# Create necessary directories
python scripts/init_dirs.py
```

This script creates the following directories:
- `db/` - Database files
- `resumes/` - Uploaded resume files
- `logs/` - Application logs

## Frontend Setup

### 1. Navigate to Frontend Directory

```bash
cd ../frontend  # From backend directory
# or
cd frontend     # From project root
```

### 2. Install Node.js Dependencies

```bash
# Install all npm packages
npm install

# Verify React installation
npm list react
```

### 3. Install Additional Testing Dependencies (if needed)

```bash
# These should already be in package.json, but install if missing
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

## Database Setup

### 1. Navigate to Backend Directory

```bash
cd backend  # From project root
```

### 2. Create Database Tables

```bash
# Activate Python environment
conda activate sadaora

# Create database tables
python scripts/create_tables.py

# To recreate tables (drops existing data)
python scripts/create_tables.py --force
```

### 3. Verify Database Creation

```bash
# Check if database file was created
ls -la db/app.db  # Linux/macOS
dir db\app.db     # Windows
```

The database file should be created at `backend/db/app.db`.

### 4. Optional: Run Database Migration Scripts

```bash
# If there are additional migration scripts
python scripts/create_sessions_table.py
python scripts/migrate_career_fields.py
```

## Running the Application

### 1. Start the Backend Server

Open a terminal and navigate to the backend directory:

```bash
cd backend
conda activate sadaora

# Method 1: Using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Method 2: Using Python
python main.py

# Method 3: For development with auto-reload
uvicorn main:app --reload
```

The backend server will start at `http://localhost:8000`

#### Verify Backend is Running:
- Open `http://localhost:8000` in your browser
- You should see: `{"message": "Sadaora AI Assistant Platform API"}`
- Check API docs at: `http://localhost:8000/docs`

### 2. Start the Frontend Development Server

Open a new terminal and navigate to the frontend directory:

```bash
cd frontend

# Start the React development server
npm start
```

The frontend will start at `http://localhost:3000` and automatically open in your browser.

### 3. Verify Full Application

1. Frontend should be accessible at `http://localhost:3000`
2. Backend API should be accessible at `http://localhost:8000`
3. Frontend should be able to communicate with backend (check browser console for any errors)

## Running Tests

### Frontend Tests

Navigate to the frontend directory:

```bash
cd frontend
```

#### Run All Tests

```bash
# Run all tests once
npm test -- --watchAll=false

# Run tests in watch mode (auto-rerun on changes)
npm test

# Run tests with coverage report
npm test -- --coverage --watchAll=false
```

#### Run Specific Test Files

```bash
# Run specific test file
npm test -- --testPathPattern=Login.test.js

# Run multiple specific tests
npm test -- --testPathPattern="Login|Register"
```

#### Using Custom Test Runner

```bash
# Show available commands
node tests/runTests.js help

# List all test files
node tests/runTests.js list

# Run all tests
node tests/runTests.js run

# Run specific test
node tests/runTests.js run Login.test.js

# Run tests in watch mode
node tests/runTests.js watch

# Generate coverage report
node tests/runTests.js coverage
```

#### Test Coverage

The frontend tests cover:
- ✅ **API Services** (`api.test.js`) - Authentication endpoints, chat functionality, session management, profile operations, file operations, error handling
- ✅ **Authentication Context** (`AuthContext.test.js`) - Context provider, user state management, login/register/logout operations, local storage integration
- ✅ **Login Component** (`Login.test.js`) - Form rendering and validation, user input handling, success/failure scenarios, navigation logic, loading states
- ✅ **Register Component** (`Register.test.js`) - Registration form, password confirmation validation, first-time user handling, form validation
- ✅ **Dashboard Component** (`Dashboard.test.js`) - Main dashboard rendering, user data display, navigation, personal assistant integration, agent modules
- ✅ **Profile Component** (`Profile.test.js`) - Profile form rendering, avatar upload/delete, password change, resume upload, notification preferences

### Backend Tests

Navigate to the backend directory:

```bash
cd backend
conda activate sadaora
```

#### Install Test Dependencies

```bash
# Test dependencies should already be in requirements.txt
pip install pytest pytest-cov pytest-asyncio httpx
```

#### Run All Tests

```bash
# Run all tests using the test runner script
python tests/run_tests.py

# Run tests with coverage
python tests/run_tests.py --coverage

# Run tests with HTML coverage report
python tests/run_tests.py --html-coverage

# Run with verbose output
python tests/run_tests.py --verbose
```

#### Run Specific API Tests

```bash
# Run tests for specific API
python tests/run_tests.py --api auth
python tests/run_tests.py --api profile
python tests/run_tests.py --api chat
python tests/run_tests.py --api sessions

# Combine options
python tests/run_tests.py --api profile --coverage --verbose
```

#### Using pytest Directly

```bash
# Run all unit tests
pytest tests/unit/

# Run specific test file
pytest tests/unit/test_auth.py

# Run with coverage
pytest tests/unit/ --cov=backend --cov-report=term-missing

# Run with verbose output
pytest tests/unit/ -v

# Run specific test method
pytest tests/unit/test_auth.py::test_register_user_success
```

#### Test Coverage

The backend tests cover:
- ✅ **Authentication API** (`test_auth.py`) - User registration, login, resume upload/delete, duplicate validation, invalid credentials
- ✅ **Profile API** (`test_profile.py`) - Get/create/update profile, password change, avatar upload/delete, validation errors
- ✅ **Chat API** (`test_chat.py`) - Create messages, get history with pagination, clear history, session filtering
- ✅ **Sessions API** (`test_sessions.py`) - Create/get/activate/delete sessions, session messages, active session management

## Troubleshooting

### Common Issues

#### Python/Backend Issues

1. **ModuleNotFoundError**
   ```bash
   # Ensure you're in the correct environment
   conda activate sadaora
   
   # Reinstall dependencies
   pip install -r requirements.txt
   ```

2. **Database Connection Error**
   ```bash
   # Recreate database tables
   python scripts/create_tables.py --force
   ```

3. **Port 8000 Already in Use**
   ```bash
   # Kill process using port 8000
   # Windows
   netstat -ano | findstr :8000
   taskkill /PID <PID> /F
   
   # Linux/macOS
   lsof -ti:8000 | xargs kill -9
   
   # Or use a different port
   uvicorn main:app --port 8001
   ```

#### Node.js/Frontend Issues

1. **npm install fails**
   ```bash
   # Clear npm cache
   npm cache clean --force
   
   # Delete node_modules and reinstall
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Port 3000 Already in Use**
   ```bash
   # Kill process or use different port
   # The React dev server will automatically suggest port 3001
   ```

3. **CORS Errors**
   - Ensure backend is running on port 8000
   - Check that `proxy` in `package.json` points to correct backend URL

#### Test Issues

1. **Frontend Tests Failing**
   ```bash
   # Clear Jest cache
   npm test -- --clearCache
   
   # Run tests with verbose output
   npm test -- --verbose
   
   # Run tests for CI/CD
   npm test -- --coverage --watchAll=false --ci
   ```

2. **Backend Tests Failing**
   ```bash
   # Ensure test database is clean
   rm -f tests/test.db
   
   # Run tests with verbose output
   pytest tests/unit/ -v
   
   # Debug failing tests
   pytest tests/unit/test_profile.py -vvv --tb=long
   
   # Run and drop into debugger on failure
   pytest tests/unit/test_profile.py --pdb
   
   # Run only failed tests from last run
   pytest tests/unit/ --lf
   ```

3. **Import/Module Errors**
   ```bash
   # Ensure you're in the correct directory
   # For frontend tests:
   cd frontend
   
   # For backend tests:
   cd backend
   
   # Check Python path and environment
   conda activate sadaora
   python -c "import sys; print(sys.path)"
   ```

4. **File Permission Errors**
   ```bash
   # Windows: Run as administrator if needed
   # Linux/macOS: Check file permissions
   chmod 755 tests/
   chmod 644 tests/*.py
   ```

### Environment Variables

If the application uses environment variables, create a `.env` file in the backend directory:

```bash
# backend/.env
DATABASE_URL=sqlite:///./db/app.db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

### Development Tips

1. **Use separate terminals** for backend and frontend
2. **Keep both servers running** during development
3. **Check browser console** for frontend errors
4. **Check terminal output** for backend errors
5. **Use API documentation** at `http://localhost:8000/docs`
6. **Run tests frequently** to catch issues early

### Getting Help

1. Check the logs in both frontend and backend terminals
2. Review the API documentation at `/docs`
3. Check the test output for specific error messages
4. Ensure all dependencies are correctly installed
5. Verify that both servers are running on correct ports

## Next Steps

After completing the setup:

1. Explore the codebase structure
2. Read the API documentation
3. Run the test suites to understand the functionality
4. Start developing new features
5. Follow the coding guidelines in `docs/development/coding_guidelines.md`

Congratulations! Your development environment is now ready for the Sadaora AI Assistant Platform.