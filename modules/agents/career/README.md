# Career Agent API

This module provides a FastAPI-based career counseling service that integrates with local Ollama LLM using Langchain. It serves as a specialized career agent that analyzes resumes, provides career insights, and offers professional guidance through chat interactions.

## Features

- **Career-Focused Chat**: Specialized AI agent for career-related conversations
- **Resume Analysis**: Comprehensive resume analysis with detailed insights
- **Streaming Analysis**: Real-time resume processing with progress updates
- **Workflow Engine**: Sequential and parallel processing pipelines for resume analysis
- **Career Insights**: Professional data extraction and career recommendations
- **Session Management**: Support for multiple conversation sessions
- **Error Handling**: Robust error handling with retry mechanisms
- **RESTful API**: Clean HTTP endpoints for career services
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

4. **Database**: Ensure the main application database is running for user profiles and career insights storage

## Quick Start

### Manual Start

```bash
# Navigate to the career agent directory
cd modules/agents/career/src

# Install dependencies
pip install -r requirements.txt

# Start the API server
python main.py
# OR
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

## API Endpoints

The API runs on `http://localhost:8002` and provides the following endpoints:

### Chat Endpoints

- **POST** `/api/chat/message` - Send a message to the career AI
- **GET** `/api/chat/message/stream` - Stream chat responses with real-time updates
- **GET** `/api/chat/health` - Check chat service health
- **GET** `/api/chat/health/deep` - Comprehensive health check with model verification
- **GET** `/api/chat/insights/{user_id}` - Get career insights for a specific user

### Streaming Analysis Endpoints

- **POST** `/api/streaming/analyze` - Start streaming resume analysis
- **GET** `/api/streaming/status/{analysis_id}` - Get analysis status and progress
- **DELETE** `/api/streaming/cancel/{analysis_id}` - Cancel ongoing analysis
- **GET** `/api/streaming/health` - Check streaming service health

### System Endpoints

- **GET** `/` - API information
- **GET** `/docs` - Interactive API documentation
- **GET** `/redoc` - Alternative API documentation

## Usage Examples

### Send a Career Chat Message

```bash
curl -X POST "http://localhost:8002/api/chat/message" \
     -H "Content-Type: application/json" \
     -d '{
       "message": "How can I improve my software engineering resume?",
       "session_id": "user123_career_session",
       "user_id": 1
     }'
```

### Start Resume Analysis

```bash
curl -X POST "http://localhost:8002/api/streaming/analyze" \
     -H "Content-Type: application/json" \
     -d '{
       "resume_content": "Your resume text here...",
       "user_id": 1,
       "analysis_type": "comprehensive"
     }'
```

### Check Analysis Status

```bash
curl "http://localhost:8002/api/streaming/status/analysis_123"
```

### Check Health

```bash
curl "http://localhost:8002/api/chat/health"
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Career API    │    │   Ollama LLM    │
│   (React)       │◄──►│   (FastAPI)     │◄──►│   (Local)       │
│   Port: 3000    │    │   Port: 8002    │    │   Port: 11435 (ext) / 11434 (int)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Database      │
                       │   (PostgreSQL)  │
                       └─────────────────┘
```

### Components

1. **main.py**: FastAPI application entry point
2. **api.py**: HTTP route handlers for chat and career services
3. **streaming_api.py**: Streaming endpoints for real-time resume analysis
4. **chat_service.py**: Core chat logic with Langchain integration
5. **resume_analyzer.py**: Resume analysis service using LLM
6. **streaming_analyzer.py**: Streaming resume analyzer with progress updates
7. **workflow_engine.py**: Sequential workflow pipeline for resume analysis
8. **parallel_workflow_engine.py**: Parallel processing workflow engine
9. **error_handler.py**: Error handling and retry mechanisms
10. **prompts.py**: System prompts and templates for career analysis

## Configuration

### Environment Variables

You can configure the service using environment variables:

- `OLLAMA_BASE_URL`: Ollama server URL (default: http://ollama2-staging:11434 in Docker, http://localhost:11435 for local)
- `OLLAMA_MODEL`: Model name (default: gemma3:latest)
- `API_PORT`: API server port (default: 8002)
- `LOG_LEVEL`: Logging level (default: INFO)
- `NOTIFICATION_SERVICE_URL`: Personal assistant notification service URL

### Model Configuration

To use a different Ollama model, modify the `ChatService` initialization in `chat_service.py`:

```python
chat_service = ChatService(
    model_name="your-model-name",
    base_url="http://ollama2-staging:11434"  # In Docker
)
```

## Development

### Running in Development Mode

```bash
# Start with auto-reload
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

### Testing

The Career Agent includes a comprehensive test suite covering all major components and functionality.

#### Test Structure

```
tests/
├── unit/                        # Unit tests directory
│   ├── conftest.py             # Test fixtures and configuration
│   ├── test_api.py             # Core API endpoint tests
│   ├── test_streaming_api.py   # Streaming API endpoint tests
│   ├── test_chat_service.py    # Chat service tests
│   ├── test_resume_analyzer.py # Resume analyzer tests
│   ├── test_streaming_analyzer.py # Streaming analyzer tests
│   └── test_workflow_engine.py # Workflow engine tests
```

#### Test Coverage

**Core API Tests (`test_api.py`)**:
- ✅ Send message endpoint (success, error handling)
- ✅ Health check endpoints (basic and deep)
- ✅ Career insights retrieval
- ✅ Session management
- ✅ Error handling and validation

**Streaming API Tests (`test_streaming_api.py`)**:
- ✅ Resume analysis initiation
- ✅ Analysis status tracking
- ✅ Analysis cancellation
- ✅ Progress updates and streaming responses
- ✅ Error handling in streaming context

**Chat Service Tests (`test_chat_service.py`)**:
- ✅ Message generation and response handling
- ✅ Session history management
- ✅ LLM integration and conversation flow
- ✅ Error handling and recovery

**Resume Analyzer Tests (`test_resume_analyzer.py`)**:
- ✅ Intent detection for career insights
- ✅ Resume content analysis
- ✅ Professional data extraction
- ✅ Career recommendations generation

**Streaming Analyzer Tests (`test_streaming_analyzer.py`)**:
- ✅ Real-time analysis processing
- ✅ Progress tracking and updates
- ✅ Parallel and sequential processing modes
- ✅ Error handling and retry mechanisms

**Workflow Engine Tests (`test_workflow_engine.py`)**:
- ✅ Workflow state management
- ✅ Sequential processing pipeline
- ✅ Section-by-section analysis
- ✅ Progress calculation and reporting

#### Prerequisites

Install the required test dependencies:

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx pytest-mock
```

#### Running Tests

**Run all tests:**
```bash
# From the career agent directory
cd modules/agents/career
pytest tests/unit/ -v

# With coverage reporting
pytest tests/unit/ --cov=src --cov-report=term-missing
```

**Run specific test files:**
```bash
# Run only API tests
pytest tests/unit/test_api.py -v

# Run only streaming tests
pytest tests/unit/test_streaming_api.py -v

# Run specific test method
pytest tests/unit/test_chat_service.py::TestChatService::test_generate_response_success -v
```

**Run tests with different options:**
```bash
# Run tests in parallel (if pytest-xdist is installed)
pytest tests/unit/ -n auto

# Run tests with detailed output on failures
pytest tests/unit/ --tb=long

# Run only failed tests from last run
pytest tests/unit/ --lf
```

#### Test Configuration

The test suite uses several fixtures defined in `conftest.py`:

- **MockChatService**: Simulates the Ollama chat service for testing
- **MockResumeAnalyzer**: Mocks resume analysis functionality
- **MockStreamingAnalyzer**: Simulates streaming analysis processes
- **Test Clients**: Provides both synchronous and asynchronous HTTP clients
- **Database Mocking**: Isolates tests from external dependencies
- **Session Management**: Handles test session isolation

#### Continuous Integration

For CI/CD pipelines, use:

```bash
# Run tests with JUnit XML output for CI systems
pytest tests/unit/ --junitxml=test-results.xml

# Run tests with coverage and generate XML report
pytest tests/unit/ --cov=src --cov-report=xml --cov-report=term
```

#### Debugging Tests

For debugging failing tests:

```bash
# Run with Python debugger on failure
pytest tests/unit/ --pdb

# Run with maximum verbosity
pytest tests/unit/ -vvv

# Run and stop on first failure
pytest tests/unit/ -x
```

### Adding New Features

1. **New Endpoints**: Add routes in `api.py` or `streaming_api.py`
2. **Chat Logic**: Extend `ChatService` in `chat_service.py`
3. **Analysis Features**: Modify `ResumeAnalyzer` or `StreamingResumeAnalyzer`
4. **Workflow Steps**: Add new nodes to `WorkflowEngine`
5. **Models**: Define Pydantic models in respective API files
6. **Prompts**: Add new prompts in `prompts.py`

## Troubleshooting

### Common Issues

1. **"Connection refused" errors**
   - Ensure Ollama is running: `ollama serve`
   - Check if port 11435 (external) or 11434 (container-internal) is accessible
   - Verify the base_url configuration

2. **"Model not found" errors**
   - Pull the model: `ollama pull gemma3:latest`
   - Verify model name in configuration
   - Check available models: `ollama list`

3. **"Port already in use" errors**
   - Change the port in `main.py` or use environment variable
   - Kill existing processes on port 8002
   - Use `netstat -ano | findstr :8002` to find conflicting processes

4. **Database connection errors**
   - Ensure the main application database is running
   - Check database connection settings
   - Verify user permissions and table existence

5. **Slow analysis responses**
   - Check Ollama performance and resource usage
   - Consider using a smaller model for faster responses
   - Adjust timeout settings in `error_handler.py`
   - Monitor system resources (CPU, memory, GPU)

6. **Streaming analysis failures**
   - Check notification service availability
   - Verify retry configuration settings
   - Monitor workflow engine logs for detailed error information

### Logs

The API provides detailed logging. Check the console output for:
- Startup information and configuration
- Request/response details
- Analysis progress and results
- Error messages and stack traces
- Health check results
- Workflow execution steps

### Health Monitoring

Monitor the API health using:
- `/api/chat/health` endpoint for basic chat service status
- `/api/chat/health/deep` endpoint for comprehensive health check
- `/api/streaming/health` endpoint for streaming service status
- Console logs for detailed system information
- Database connection status through career insights endpoints

## Performance Considerations

- **Response Time**: Depends on Ollama model size and hardware capabilities
- **Concurrency**: Supports multiple concurrent requests and analysis sessions
- **Memory Usage**: Conversation memory and analysis results are maintained per session
- **Scalability**: Designed for moderate concurrent usage with local LLM
- **Resource Usage**: Monitor CPU, memory, and GPU usage during analysis
- **Parallel Processing**: Enable parallel analysis for faster resume processing

## Security Considerations

- The API runs on localhost by default for development
- CORS is configured for local frontend development
- No authentication is implemented (suitable for local development)
- Resume content and career data are processed locally
- For production deployment, consider adding:
  - Authentication and authorization
  - HTTPS encryption
  - Input validation and sanitization
  - Rate limiting
  - Audit logging

## Integration with Main Application

The Career Agent integrates with the main Personal Assistant application through:

- **Database**: Shares user profiles, career insights, and chat sessions
- **Frontend**: Provides specialized career counseling interface
- **Notification Service**: Sends real-time updates during analysis
- **Session Management**: Maintains conversation context across services

## License

This module is part of the Personal Assistant project and follows the same license terms.