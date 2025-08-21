# Personal Assistant Chat API

This module provides a FastAPI-based chat service that integrates with local Ollama LLM using Langchain. It serves as the backend for the chatbot functionality in the Personal Assistant application.

## Features

- **Real-time Chat**: Communicate with local Ollama LLM (gemma3:latest)
- **Conversation Memory**: Maintains conversation context using Langchain memory
- **RESTful API**: Clean HTTP endpoints for chat operations
- **Health Monitoring**: Built-in health checks and status monitoring
- **Session Management**: Support for multiple conversation sessions
- **Error Handling**: Robust error handling with user-friendly messages
- **CORS Support**: Configured for frontend integration

## Prerequisites

1. **Ollama**: Must be installed and running
   ```bash
   # Install Ollama (if not already installed)
   # Visit: https://ollama.ai/download
   
   # Start Ollama service
   ollama serve
   
   # Pull the required model
   ollama pull gemma3:latest
   ```

2. **Python 3.8+**: Required for running the API

3. **Dependencies**: Install from requirements.txt
   ```bash
   pip install -r requirements.txt
   ```

## Quick Start

### Option 1: Using the Startup Script (Recommended)

```bash
# Navigate to the personal_assistant directory
cd backend/personal_assistant

# Run the startup script
python start_chat_api.py
```

The startup script will:
- Check if Ollama is running
- Verify the model is available
- Install dependencies
- Start the API server

### Option 2: Manual Start

```bash
# Navigate to the personal_assistant directory
cd backend/personal_assistant

# Install dependencies
pip install -r requirements.txt

# Start the API server
python main.py
# OR
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## API Endpoints

The API runs on `http://localhost:8001` and provides the following endpoints:

### Chat Endpoints

- **POST** `/api/chat/message` - Send a message to the AI
- **GET** `/api/chat/health` - Check chat service health
- **DELETE** `/api/chat/memory` - Clear conversation memory
- **GET** `/api/chat/history` - Get conversation history
- **GET** `/api/chat/models` - Get model information

### System Endpoints

- **GET** `/` - API information
- **GET** `/health` - API health check
- **GET** `/docs` - Interactive API documentation
- **GET** `/redoc` - Alternative API documentation

## Usage Examples

### Send a Chat Message

```bash
curl -X POST "http://localhost:8001/api/chat/message" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "Hello, how are you?",
       "session_id": "user123_session1"
     }'
```

### Check Health

```bash
curl "http://localhost:8001/api/chat/health"
```

### Clear Memory

```bash
curl -X DELETE "http://localhost:8001/api/chat/memory"
```

## Frontend Integration

The frontend uses the `chatApi.js` service to communicate with this API:

```javascript
import { sendMessage, checkHealth } from '../services/chatApi';

// Send a message
const response = await sendMessage("Hello!", sessionId);

// Check health
const health = await checkHealth();
```

## Configuration

### Environment Variables

You can configure the service using environment variables:

- `OLLAMA_BASE_URL`: Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL`: Model name (default: gemma3:latest)
- `API_PORT`: API server port (default: 8001)
- `LOG_LEVEL`: Logging level (default: INFO)

### Model Configuration

To use a different Ollama model, modify the `ChatService` initialization in `chat_service.py`:

```python
chat_service = ChatService(
    model_name="your-model-name",
    base_url="http://localhost:11434"
)
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Chat API      │    │   Ollama LLM    │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (Local)       │
│   Port: 3000    │    │   Port: 8001    │    │   Port: 11434   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Components

1. **main.py**: FastAPI application entry point
2. **api.py**: HTTP route handlers and request/response models
3. **chat_service.py**: Core chat logic with Langchain integration
4. **start_chat_api.py**: Startup script with health checks

## Development

### Running in Development Mode

```bash
# Start with auto-reload
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

### Testing

The Personal Assistant Chat API includes a comprehensive test suite that covers both synchronous and asynchronous endpoints, including streaming functionality.

#### Test Structure

```
tests/
├── conftest.py              # Test fixtures and configuration
└── unit/                    # Unit tests directory
    ├── __init__.py          # Unit test package initialization
    ├── test_api.py          # Core API endpoint tests
    └── test_streaming.py    # Streaming endpoint tests
```

#### Test Coverage

**Core API Tests (`test_api.py`)**:
- ✅ Send message endpoint (success, error handling)
- ✅ Health check endpoint
- ✅ Memory management (clear memory)
- ✅ Chat history retrieval
- ✅ Model information endpoint
- ✅ Root endpoint information

**Streaming API Tests (`test_streaming.py`)**:
- ✅ Server-Sent Events (SSE) streaming responses
- ✅ Real-time message streaming with proper content-type headers
- ✅ Multi-part streaming response handling
- ✅ Stream completion detection

#### Prerequisites

Install the required test dependencies:

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx
```

#### Running Tests

**Run all tests:**
```bash
# From the personal_assistant directory
pytest tests/

# With verbose output
pytest tests/ -v

# With coverage reporting
pytest tests/ --cov=. --cov-report=term-missing
```

**Run specific test files:**
```bash
# Run only API tests
pytest tests/unit/test_api.py

# Run only streaming tests
pytest tests/unit/test_streaming.py

# Run specific test method
pytest tests/unit/test_api.py::TestChatApi::test_send_message_success
```

**Run tests with different options:**
```bash
# Run tests in parallel (if pytest-xdist is installed)
pytest tests/ -n auto

# Run tests with detailed output on failures
pytest tests/ --tb=long

# Run only failed tests from last run
pytest tests/ --lf
```

#### Test Configuration

The test suite uses several fixtures defined in `conftest.py`:

- **MockChatService**: Simulates the Ollama chat service for testing
- **Test Client**: Provides both synchronous and asynchronous HTTP clients
- **Database Mocking**: Isolates tests from external dependencies
- **Session Management**: Handles test session isolation

#### Continuous Integration

For CI/CD pipelines, use:

```bash
# Run tests with JUnit XML output for CI systems
pytest tests/ --junitxml=test-results.xml

# Run tests with coverage and generate XML report
pytest tests/ --cov=. --cov-report=xml --cov-report=term
```

#### Debugging Tests

For debugging failing tests:

```bash
# Run with Python debugger on failure
pytest tests/ --pdb

# Run with maximum verbosity
pytest tests/ -vvv

# Run and stop on first failure
pytest tests/ -x
```

### Adding New Features

1. **New Endpoints**: Add routes in `api.py`
2. **Chat Logic**: Extend `ChatService` in `chat_service.py`
3. **Models**: Define Pydantic models in `api.py`

## Troubleshooting

### Common Issues

1. **"Connection refused" errors**
   - Ensure Ollama is running: `ollama serve`
   - Check if port 11434 is accessible

2. **"Model not found" errors**
   - Pull the model: `ollama pull gemma3:latest`
   - Verify model name in configuration

3. **"Port already in use" errors**
   - Change the port in `main.py` or use environment variable
   - Kill existing processes on port 8001

4. **Slow responses**
   - Check Ollama performance
   - Consider using a smaller model
   - Adjust model parameters in `chat_service.py`

### Logs

The API provides detailed logging. Check the console output for:
- Startup information
- Request/response details
- Error messages
- Health check results

### Health Monitoring

Monitor the API health using:
- `/health` endpoint for API status
- `/api/chat/health` endpoint for chat service status
- Console logs for detailed information

## Security Considerations

- The API runs on localhost by default
- CORS is configured for local development
- No authentication is implemented (suitable for local development)
- For production deployment, consider adding authentication and HTTPS

## Performance

- **Response Time**: Depends on Ollama model and hardware
- **Concurrency**: Supports multiple concurrent requests
- **Memory**: Conversation memory is maintained per session
- **Scalability**: Designed for single-user local development

## License

This module is part of the Personal Assistant project and follows the same license terms.