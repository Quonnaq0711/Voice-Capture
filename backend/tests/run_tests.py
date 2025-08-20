#!/usr/bin/env python3
"""
Test runner script for the backend API tests.

This script provides convenient ways to run different test suites:
- All tests
- Specific API tests
- Tests with coverage reporting
- Tests with verbose output

Usage:
    python run_tests.py                    # Run all tests
    python run_tests.py --api profile      # Run only profile API tests
    python run_tests.py --coverage         # Run tests with coverage
    python run_tests.py --verbose          # Run tests with verbose output
"""

import argparse
import subprocess
import sys
import os
from pathlib import Path

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n{description}")
    print(f"Running: {' '.join(command)}")
    print("-" * 50)
    
    try:
        result = subprocess.run(command, check=True, capture_output=False)
        return result.returncode == 0
    except subprocess.CalledProcessError as e:
        print(f"Error: Command failed with exit code {e.returncode}")
        return False
    except FileNotFoundError:
        print(f"Error: Command not found. Make sure pytest is installed.")
        return False

def main():
    parser = argparse.ArgumentParser(description="Run backend API tests")
    parser.add_argument(
        "--api", 
        choices=["auth", "profile", "chat", "sessions"],
        help="Run tests for specific API only"
    )
    parser.add_argument(
        "--coverage", 
        action="store_true",
        help="Run tests with coverage reporting"
    )
    parser.add_argument(
        "--verbose", 
        action="store_true",
        help="Run tests with verbose output"
    )
    parser.add_argument(
        "--html-coverage", 
        action="store_true",
        help="Generate HTML coverage report"
    )
    
    args = parser.parse_args()
    
    # Change to the backend directory
    backend_dir = Path(__file__).parent.parent
    os.chdir(backend_dir)
    
    # Base pytest command
    cmd = ["pytest"]
    
    # Add test path
    if args.api:
        test_path = f"tests/unit/test_{args.api}.py"
        cmd.append(test_path)
    else:
        cmd.append("tests/unit/")
    
    # Add verbose flag
    if args.verbose:
        cmd.append("-v")
    
    # Add coverage options
    if args.coverage or args.html_coverage:
        cmd.extend(["--cov=backend", "--cov-report=term-missing"])
        
        if args.html_coverage:
            cmd.append("--cov-report=html")
    
    # Add other useful pytest options
    cmd.extend([
        "--tb=short",  # Shorter traceback format
        "--strict-markers",  # Strict marker checking
        "-ra"  # Show summary of all test results
    ])
    
    # Run the tests
    success = run_command(cmd, "Running Backend API Tests")
    
    if success:
        print("\n✅ All tests passed!")
        
        if args.html_coverage:
            print("\n📊 HTML coverage report generated in 'htmlcov/' directory")
            print("Open 'htmlcov/index.html' in your browser to view the report")
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()