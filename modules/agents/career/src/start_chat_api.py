#!/usr/bin/env python3
"""
Startup script for the Career Agent Chat API.
This script checks that Ollama is running on ollama2-staging:11435 with the required model
and then starts the FastAPI server on localhost:8002.
"""

import os
import sys
import subprocess
import logging
from pathlib import Path
from typing import Optional

import requests

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Get Ollama URL from environment variable, same as chat_service.py
DEFAULT_CAREER_OLLAMA_URL = os.getenv("CAREER_OLLAMA_URL", "https://ollama2-staging:11435")
OLLAMA_TAGS_ENDPOINT = f"{DEFAULT_CAREER_OLLAMA_URL}/api/tags"
MODEL_NAME = "gemma3:latest"
API_HOST = "0.0.0.0"
API_PORT = 8002


def check_ollama_running() -> bool:
    """Return True if an Ollama instance is reachable at OLLAMA_BASE_URL."""
    try:
        response = requests.get(OLLAMA_TAGS_ENDPOINT, timeout=5)
        return response.status_code == 200
    except requests.exceptions.RequestException:
        return False


def check_model_available(model_name: str = MODEL_NAME) -> bool:
    """Return True if the specified model is available in the connected Ollama instance."""
    try:
        response = requests.get(OLLAMA_TAGS_ENDPOINT, timeout=5)
        if response.status_code == 200:
            models = response.json().get("models", [])
            return any(model.get("name") == model_name for model in models)
        return False
    except requests.exceptions.RequestException:
        return False


def install_dependencies() -> bool:
    """Install Python dependencies specified in requirements.txt located next to this script."""
    logger.info("Installing dependencies...")
    try:
        subprocess.run(
            [sys.executable, "-m", "pip", "install", "-r", "requirements.txt"],
            check=True,
            cwd=Path(__file__).parent,
        )
        logger.info("Dependencies installed successfully")
        return True
    except subprocess.CalledProcessError as exc:
        logger.error(f"Failed to install dependencies: {exc}")
        return False


def start_chat_api() -> bool:
    """Launch the FastAPI application using uvicorn with hot-reload enabled."""
    logger.info("Starting Career Agent Chat API...")

    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    try:
        subprocess.run(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                API_HOST,
                "--port",
                str(API_PORT),
                "--reload",
            ],
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        logger.error(f"Failed to start chat API: {exc}")
        return False
    except KeyboardInterrupt:
        logger.info("Chat API server stopped by user")
        return True
    return True


def main() -> Optional[bool]:
    """Entry point performing environment checks before launching the API server."""
    logger.info("=" * 60)
    logger.info("Career Agent Chat API Startup")
    logger.info("=" * 60)

    # Verify Ollama is available
    logger.info("Checking Ollama service at %s...", DEFAULT_CAREER_OLLAMA_URL)
    if not check_ollama_running():
        logger.error("Ollama is not running on %s", DEFAULT_CAREER_OLLAMA_URL)
        logger.error("Please start Ollama first:")
        logger.error("  1. Open a terminal")
        logger.error("  2. Run: ollama serve --address 0.0.0.0:11435")
        logger.error("  3. In another terminal, run: ollama run %s --address 0.0.0.0:11435", MODEL_NAME)
        return False
    logger.info("✓ Ollama is running")

    # Verify the model is available
    logger.info("Checking model availability (%s)...", MODEL_NAME)
    if not check_model_available():
        logger.warning("Model '%s' not found", MODEL_NAME)
        logger.info("Attempting to pull the model...")
        try:
            subprocess.run(["ollama", "pull", MODEL_NAME], check=True)
            logger.info("✓ Model pulled successfully")
        except subprocess.CalledProcessError:
            logger.error("Failed to pull model. Please run manually:\n  ollama pull %s", MODEL_NAME)
            return False
    else:
        logger.info("✓ Model '%s' is available", MODEL_NAME)

    # Install Python dependencies
    if not install_dependencies():
        return False

    # Start the API server
    logger.info("\n" + "=" * 60)
    logger.info("Starting Chat API Server")
    logger.info("=" * 60)
    logger.info("API will be available at: http://%s:%d", API_HOST, API_PORT)
    logger.info("API documentation at: http://%s:%d/docs", API_HOST, API_PORT)
    logger.info("Press Ctrl+C to stop the server")
    logger.info("=" * 60 + "\n")

    return start_chat_api()


if __name__ == "__main__":
    success = main()
    if not success:
        sys.exit(1)