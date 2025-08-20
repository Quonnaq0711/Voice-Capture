@echo off
REM Frontend Test Runner for Windows
REM This script provides convenient commands to run frontend tests

setlocal enabledelayedexpansion

if "%1"=="" goto :help
if "%1"=="help" goto :help
if "%1"=="list" goto :list
if "%1"=="run" goto :run
if "%1"=="watch" goto :watch
if "%1"=="coverage" goto :coverage
if "%1"=="install" goto :install
goto :help

:help
echo.
echo Frontend Test Runner
echo ====================
echo.
echo Available commands:
echo   help      - Show this help message
echo   list      - List all available test files
echo   run       - Run all tests once
echo   run [file] - Run specific test file
echo   watch     - Run tests in watch mode
echo   coverage  - Run tests with coverage report
echo   install   - Install missing test dependencies
echo.
echo Examples:
echo   test-runner.bat run
echo   test-runner.bat run Login.test.js
echo   test-runner.bat watch
echo   test-runner.bat coverage
echo.
goto :end

:list
echo.
echo Available test files:
echo =====================
if exist "tests\*.test.js" (
    for %%f in (tests\*.test.js) do (
        echo   %%~nxf
    )
) else (
    echo   No test files found in tests directory
)
echo.
goto :end

:install
echo.
echo Installing test dependencies...
echo ================================
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
if %errorlevel% equ 0 (
    echo.
    echo Dependencies installed successfully!
) else (
    echo.
    echo Error installing dependencies. Please check your npm configuration.
)
echo.
goto :end

:run
if "%2"=="" (
    echo.
    echo Running all tests...
    echo ====================
    npm test -- --watchAll=false
) else (
    echo.
    echo Running test file: %2
    echo ========================
    npm test -- --testPathPattern=%2 --watchAll=false
)
echo.
goto :end

:watch
echo.
echo Starting tests in watch mode...
echo =================================
echo Press 'q' to quit, 'a' to run all tests
echo.
npm test
goto :end

:coverage
echo.
echo Running tests with coverage report...
echo ====================================
npm test -- --coverage --watchAll=false
echo.
echo Coverage report generated in 'coverage' directory
echo Open 'coverage/lcov-report/index.html' to view detailed report
echo.
goto :end

:end
endlocal