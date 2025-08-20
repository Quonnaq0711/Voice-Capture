#!/usr/bin/env python3
"""
Startup script for the Personal Assistant Chat API.
This script starts the chat API server on localhost:8001.
"""

import os
import sys
import subprocess
import time
import requests
import logging
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def check_ollama_running():
    """
    Check if Ollama is running on localhost:11434
    """
    try:
        response = requests.get('http://localhost:11434/api/tags', timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False

def check_model_available(model_name="gemma3:latest"):
    """
    Check if the specified model is available in Ollama
    """
    try:
        response = requests.get('http://localhost:11434/api/tags', timeout=5)
        if response.status_code == 200:
            models = response.json().get('models', [])
            return any(model.get('name') == model_name for model in models)
        return False
    except requests.exceptions.RequestException:
        return False

def install_dependencies():
    """
    Install required dependencies
    """
    logger.info("Installing dependencies...")
    try:
        subprocess.run([
            sys.executable, '-m', 'pip', 'install', '-r', 'requirements.txt'
        ], check=True, cwd=Path(__file__).parent)
        logger.info("Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install dependencies: {e}")
        return False

def start_chat_api():
    """
    Start the chat API server
    """
    logger.info("Starting Personal Assistant Chat API...")
    
    # Change to the script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    
    try:
        # Start the FastAPI server
        subprocess.run([
            sys.executable, '-m', 'uvicorn', 
            'main:app', 
            '--host', '0.0.0.0', 
            '--port', '8001', 
            '--reload'
        ], check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to start chat API: {e}")
        return False
    except KeyboardInterrupt:
        logger.info("Chat API server stopped by user")
        return True

def main():
    """
    Main function to start the chat API with all necessary checks
    """
    logger.info("=" * 60)
    logger.info("Personal Assistant Chat API Startup")
    logger.info("=" * 60)
    
    # Check if Ollama is running
    logger.info("Checking Ollama service...")
    if not check_ollama_running():
        logger.error("Ollama is not running on localhost:11434")
        logger.error("Please start Ollama first:")
        logger.error("  1. Open a terminal")
        logger.error("  2. Run: ollama serve")
        logger.error("  3. In another terminal, run: ollama run gemma3:latest")
        return False
    
    logger.info("✓ Ollama is running")
    
    # Check if the model is available
    logger.info("Checking model availability...")
    if not check_model_available():
        logger.warning("Model 'gemma3:latest' not found")
        logger.info("Attempting to pull the model...")
        try:
            subprocess.run(['ollama', 'pull', 'gemma3:latest'], check=True)
            logger.info("✓ Model pulled successfully")
        except subprocess.CalledProcessError:
            logger.error("Failed to pull model. Please run manually:")
            logger.error("  ollama pull gemma3:latest")
            return False
    else:
        logger.info("✓ Model 'gemma3:latest' is available")
    
    # Install dependencies
    if not install_dependencies():
        return False
    
    # Start the API server
    logger.info("\n" + "=" * 60)
    logger.info("Starting Chat API Server")
    logger.info("=" * 60)
    logger.info("API will be available at: http://localhost:8001")
    logger.info("API documentation at: http://localhost:8001/docs")
    logger.info("Press Ctrl+C to stop the server")
    logger.info("=" * 60 + "\n")
    
    return start_chat_api()

if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)