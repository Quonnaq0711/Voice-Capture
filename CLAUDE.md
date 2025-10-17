# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sadaora AI Assistant Platform is an LLM-powered personal assistant that provides personalized insights by analyzing user data (resumes, profiles, hobbies, achievements). The system uses a microservices architecture with a central Personal Assistant orchestrating specialized domain agents (Career, Hobby, Travel, Money, etc.) that provide domain-specific insights.

## Development Modes

The project supports **two independent deployment modes** that can run simultaneously without conflicts:

### 🚀 Quick Start - Development Mode (Recommended for Development)

```bash
# Start all services locally on non-conflicting ports
./deploy-dev.sh

# Access at:
# - Frontend:        http://localhost:1000
# - Backend API:     http://localhost:5000/docs
# - Personal Asst:   http://localhost:6001
# - Career Agent:    http://localhost:6002

# Stop all dev services
./stop-dev.sh
```

### 🐳 Quick Start - Container/Staging Mode (For Testing Deployment)

```bash
# Deploy all services in Docker containers
./deploy-staging.sh

# Access at:
# - Frontend:        https://localhost or https://staging.idii.co
# - Backend API:     :8000
# - Services:        :8001, :8002
```

### Port Allocation Matrix

| Component | Development Mode | Staging/Container Mode | Conflict? |
|-----------|-----------------|------------------------|-----------|
| Frontend | 1000 | 3000 (nginx→80/443) | ✅ No |
| Backend | 5000 | 8000 | ✅ No |
| Personal Assistant | 6001 | 8001 | ✅ No |
| Career Agent | 6002 | 8002 | ✅ No |
| Ollama 1 (PA) | 12434 | 11434 | ✅ No |
| Ollama 2 (Career) | 12435 | 11435 | ✅ No |
| vLLM Server | 8888 | N/A | ✅ No |
| Database | SQLite (local file) | PostgreSQL (container) | ✅ No |

**Both modes can run simultaneously!** Container services won't interfere with local development.

**Note**: vLLM runs on port 8888 in development mode and can be used instead of Ollama by setting `LLM_PROVIDER=vllm` in .env.dev.

---

## Manual Service Commands (Development Mode)

If you need to run services individually instead of using `deploy-dev.sh`:

### Backend (FastAPI - Port 5000 in dev, 8000 in container)

```bash
# Install dependencies
pip install -r backend/requirements.txt

# Development mode (port 5000)
export $(grep -v '^#' .env.dev | xargs)
# Run from project root directory
uvicorn backend.main:app --reload --host 0.0.0.0 --port 5000

# Container mode uses port 8000
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
cd backend
pytest                                    # All tests
pytest --cov=. --cov-report=term-missing # With coverage
pytest -m unit                           # Only unit tests
pytest -m integration                    # Only integration tests
pytest -v                                # Verbose output
```

### Frontend (React - Port 1000 in dev, 3000 in container)

```bash
# Install dependencies
cd frontend
npm install

# Development mode (port 1000)
export $(grep -v '^#' .env.dev | xargs)
PORT=1000 npm start

# Container mode uses port 3000 (via nginx)
npm start

# Run tests
npm test                  # Interactive mode
npm run test:coverage     # With coverage
npm run build            # Production build
```

### Personal Assistant Chat API (Port 6001 in dev, 8001 in container)

```bash
# Development mode (port 6001, Ollama on 12434)
export $(grep -v '^#' .env.dev | xargs)
cd backend/personal_assistant
uvicorn main:app --host 0.0.0.0 --port 6001 --reload

# Container mode (port 8001, Ollama on 11434)
uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Run tests
cd backend/personal_assistant
pytest tests/
pytest tests/unit/test_streaming.py  # Specific test file
```

### Career Agent API (Port 6002 in dev, 8002 in container)

```bash
# Development mode (port 6002, Ollama on 12435)
export $(grep -v '^#' .env.dev | xargs)
cd modules/agents/career/src
uvicorn main:app --host 0.0.0.0 --port 6002 --reload

# Container mode (port 8002, Ollama on 11435)
uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# Run tests
cd modules/agents/career
pytest tests/unit/ -v
pytest tests/unit/ --cov=src --cov-report=term-missing
```

### Ollama Instances

```bash
# Development mode - Two separate Ollama instances
# Ollama 1 (PA) on port 12434
OLLAMA_HOST="0.0.0.0:12434" ollama serve

# Ollama 2 (Career) on port 12435
OLLAMA_HOST="0.0.0.0:12435" ollama serve

# Pull models (run for both ports)
OLLAMA_HOST="localhost:12434" ollama pull gemma3:latest
OLLAMA_HOST="localhost:12435" ollama pull gemma3:latest

# Or use the automated setup script
./setup-ollama-dev.sh

# Container mode uses ports 11434 and 11435 (Docker manages this)
```

### Prompt Evaluator/Filter

```bash
cd backend/prompt_evaluator_filter

# Demo run
python Prompt_Evaluator.py --demo

# With JSON input
python Prompt_Evaluator.py --input input.json --output result.json
```

## Architecture Overview

### System Flow
1. **Personal Assistant** (backend/main.py) - Central orchestrator that:
   - Manages user sessions and conversation context
   - Generates/evaluates P1 (Manual), P2 (Selected), P3 (Auto) prompts via Prompt Generator Engine
   - Routes prompts to Agents Manager for domain-specific processing
   - Executes tool calls via Tool Executor
   - Synthesizes final insights via Insight Synthesizer
   - Returns responses to Frontend

2. **Specialized Agents** (modules/agents/*) - Domain experts:
   - Career Agent (port 8002): Resume analysis, career insights, professional guidance
   - Other agents: Hobby, Travel, Money, Body, Mind, Spiritual, etc.
   - Each agent has its own LLM configuration and knowledge base

3. **Supporting Services**:
   - **Prompt Evaluator/Filter**: Safety filtering, quality scoring, relevance evaluation
   - **Tool Executor**: Gateway for external tool invocations (APIs, database queries, web search)
   - **Insight Synthesizer**: Integrates multi-agent insights into coherent responses
   - **User Feedback Service**: Collects explicit/implicit feedback for optimization

### Key Directories
- `backend/`: Main FastAPI application with API routes, models, services
- `frontend/`: React application with components, hooks, services
- `modules/agents/`: Specialized AI agents (each with own API server)
- `backend/personal_assistant/`: Personal Assistant chat service (port 8001)
- `backend/prompt_evaluator_filter/`: Prompt quality control and filtering
- `config/`: Environment-specific configurations (development, production, test)

## LLM Configuration

The platform supports **multiple LLM providers** with a factory pattern for easy switching:

### LLM Provider Selection

The system uses a **Factory Pattern** to select between different LLM providers:

```bash
# In .env.dev or .env.staging:
LLM_PROVIDER=ollama  # Use Ollama (default, local LLM)
LLM_PROVIDER=vllm    # Use vLLM (high-performance inference)
```

### Architecture

- **Factory**: `backend/personal_assistant/chat_service_factory.py` - Creates appropriate chat service
- **Base Class**: `backend/personal_assistant/base_chat_service.py` - Abstract interface
- **Implementations**:
  - `backend/personal_assistant/chat_service.py` - Ollama implementation
  - `backend/personal_assistant/chat_service_vllm.py` - vLLM implementation

### Provider 1: Ollama (Default)

**Best for**: Local development, resource-constrained environments, easy setup

#### Personal Assistant (Port 8001)
- Model: `PA_LLM_MODEL` (default: gemma3:latest)
- Base URL: `PA_LLM_BASE_URL` (default: http://localhost:12434 in dev, http://localhost:11434 in container)
- Temperature: `PA_LLM_TEMPERATURE` (default: 0.7)
- Max Tokens: `PA_LLM_MAX_TOKENS` (default: 2048)

#### Career Agent (Port 8002)
- Model: `CAREER_LLM_MODEL` (default: gemma3:latest)
- Base URL: `CAREER_LLM_BASE_URL` (default: http://localhost:12435 in dev, http://ollama2-staging:11434 in container)
- Temperature: `CAREER_LLM_TEMPERATURE` (default: 0.7)
- Max Tokens: `CAREER_LLM_MAX_TOKENS` (default: 2048)

### Provider 2: vLLM (High-Performance)

**Best for**: Production deployments, high concurrency, GPU servers

vLLM provides **2-5x faster inference** and **5-10x better concurrent request handling** compared to Ollama, using advanced techniques like PagedAttention and continuous batching.

#### Quick Start with vLLM

```bash
# 1. Start vLLM server (loads model and starts OpenAI-compatible API)
./start-vllm-dev.sh

# 2. Configure Personal Assistant to use vLLM
# Edit .env.dev:
LLM_PROVIDER=vllm

# 3. Start Personal Assistant
cd backend/personal_assistant
export $(grep -v '^#' ../../.env.dev | xargs)
uvicorn main:app --host 0.0.0.0 --port 6001 --reload

# 4. Test the API
curl http://localhost:6001/api/chat/health

# 5. Stop vLLM server when done
./stop-vllm-dev.sh
```

#### vLLM Configuration (.env.dev)

```bash
# Provider Selection
LLM_PROVIDER=vllm

# Model Configuration
VLLM_MODEL=Qwen/Qwen2.5-3B-Instruct  # Default: 3B model (~7GB VRAM)
# Alternative models (larger models require more VRAM):
# VLLM_MODEL=Qwen/Qwen2.5-7B-Instruct  # Requires ~14GB VRAM
# VLLM_MODEL=mistralai/Mistral-7B-Instruct-v0.3  # Requires ~14GB VRAM
# VLLM_MODEL=meta-llama/Meta-Llama-3-8B-Instruct  # Requires ~16GB VRAM
# VLLM_MODEL=google/gemma-2-7b-it  # Requires ~14GB VRAM

# API Settings
VLLM_API_BASE=http://localhost:8888/v1  # OpenAI-compatible endpoint
VLLM_TEMPERATURE=0.7
VLLM_MAX_TOKENS=2048
VLLM_TOP_P=0.9
VLLM_FREQUENCY_PENALTY=0.0
VLLM_PRESENCE_PENALTY=0.0

# Server Configuration (for start-vllm-dev.sh)
VLLM_HOST=0.0.0.0
VLLM_PORT=8888
VLLM_GPU_MEMORY_UTILIZATION=0.7   # Use 70% of GPU memory (safer for 3B model)
VLLM_MAX_MODEL_LEN=4096           # Max context length (4K tokens)
VLLM_DTYPE=float16                # Use FP16 for efficiency
VLLM_TRUST_REMOTE_CODE=true
VLLM_TENSOR_PARALLEL_SIZE=1       # Number of GPUs to use

# Optional: Quantization (saves VRAM, not needed for 3B model)
# VLLM_QUANTIZATION=awq  # Options: awq, gptq, squeezellm
```

#### vLLM Requirements

- **GPU**: NVIDIA GPU with CUDA support (tested on L4, A10G, A100)
- **VRAM**:
  - 3B models (Qwen2.5-3B-Instruct): ~7-8GB VRAM
  - 7B models (Qwen2.5-7B-Instruct): ~14-16GB VRAM
  - 13B+ models: 28GB+ VRAM
- **Python**: Python 3.12 environment with vLLM installed
- **Dependencies**:
  ```bash
  /root/miniconda3/envs/python3.12/bin/pip install vllm==0.11.0
  /root/miniconda3/envs/python3.12/bin/pip install langchain-openai>=0.2.0
  ```

#### vLLM Performance Comparison

| Metric | Ollama | vLLM | Improvement |
|--------|---------|------|-------------|
| Single Request Latency | ~2-3s | ~0.5-1s | 2-3x faster |
| Concurrent Requests (10) | ~20-30s | ~3-5s | 5-6x faster |
| Throughput (tokens/sec) | ~50-100 | ~200-500 | 3-5x higher |
| GPU Memory Efficiency | Standard | PagedAttention | 2x better |
| Batch Processing | Sequential | Continuous | 10x better |

#### vLLM Scripts

- `start-vllm-dev.sh` - Start vLLM server with configuration from .env.dev
- `stop-vllm-dev.sh` - Stop running vLLM server gracefully
- Both scripts provide colored output and detailed status information

### Switching Between Providers

The system uses dependency injection through FastAPI's `Depends()` mechanism:

```python
# In backend/personal_assistant/api.py:
from backend.personal_assistant.chat_service_factory import get_chat_service

@router.post("/message")
async def send_message(
    chat_service: BaseChatService = Depends(get_chat_service)
):
    # Automatically uses Ollama or vLLM based on LLM_PROVIDER
    result = await chat_service.generate_response(...)
```

**No code changes needed** - just update `LLM_PROVIDER` in .env.dev and restart!

### Configuration Files
- `.env.dev` - Development environment configuration
- `.env.staging` - Staging/container environment configuration
- `config/production/.env.prod` - Production environment (if using config/)
- `config/test/.env.test` - Test environment (if using config/)

The system automatically loads the correct config based on environment.

## Database Architecture

The system supports **dual database configurations** based on environment:

### Development Mode - SQLite
- **Location**: `backend/db/app.db`
- **Configured via**: `.env.dev` with `DB_TYPE=sqlite`
- **Benefits**: Simple, file-based, no Docker required
- **Use case**: Local development and testing
- **Size**: ~98KB (lightweight)

### Staging/Production Mode - PostgreSQL
- **Location**: Container volume at `/home/idii/data/postgres-staging/`
- **Configured via**: `.env.staging` with `DB_TYPE=postgresql`
- **Benefits**: Production-grade, concurrent connections, better performance
- **Use case**: Container deployments, staging, production
- **Database name**: `idii-staging`

The database layer (`backend/db/database.py`) automatically switches between SQLite and PostgreSQL based on the `DB_TYPE` environment variable.

### SQLite Database (Development)
- Location: `backend/db/app.db`
- ORM: SQLAlchemy with declarative models
- Session management: `backend/db/database.py`

### Key Models (backend/models/)
- `user.py`: User authentication and profiles
- `profile.py`: Extended user profile data
- `chat.py`: Chat messages
- `session.py`: Chat sessions
- `resume.py`: Resume uploads and metadata
- `activity.py`: User activity tracking
- `career_insight.py`: Career-specific insights
- `daily_recommendation.py`: Daily AI recommendations

### Database Setup
```bash
# Tables are auto-created on app startup via:
# Base.metadata.create_all(bind=engine) in backend/main.py
```

## API Routes

### Main Backend (Port 8000)
- `/api/v1/auth/*` - Authentication (login, register, password reset, OTP verification)
- `/api/v1/chat/*` - Chat and session management
- `/api/v1/profile/*` - User profile management
- `/api/v1/activities/*` - Activity tracking
- `/api/v1/career_insights/*` - Career insights retrieval
- `/api/v1/daily_recommendations/*` - Daily recommendations
- `/avatars/*` - Static avatar files
- `/resumes/*` - Static resume files

### Personal Assistant API (Port 8001)
- `/api/chat/message` - Send chat messages
- `/api/chat/message/stream` - Streaming chat responses
- `/api/chat/health` - Health check
- `/api/chat/memory` - Clear conversation memory
- `/api/chat/history` - Get conversation history

### Career Agent API (Port 8002)
- `/api/chat/message` - Career-focused chat
- `/api/chat/insights/{user_id}` - Get career insights
- `/api/streaming/analyze` - Start streaming resume analysis
- `/api/streaming/status/{analysis_id}` - Check analysis status
- `/api/streaming/cancel/{analysis_id}` - Cancel analysis

## Service Integration Patterns

### Agent Communication Flow
1. Frontend → Main Backend (port 8000) → Personal Assistant (port 8001)
2. Personal Assistant → Agents Manager → Career Agent (port 8002)
3. Career Agent → Database (for profile/resume data)
4. Career Agent → Ollama LLM (for AI responses)
5. Results flow back through chain to Frontend

### Streaming Analysis Workflow
Career Agent uses `workflow_engine.py` for sequential resume analysis:
- Parallel/sequential processing modes
- Progress tracking and real-time updates
- Error handling with retry mechanisms
- Notification service integration

## Testing Guidelines

### Backend Tests
- Test markers: `@pytest.mark.unit`, `@pytest.mark.integration`, `@pytest.mark.auth`, etc.
- Configuration: `backend/pytest.ini`
- Coverage requirement: 80% minimum
- Async tests: Use `pytest-asyncio` with `asyncio_mode = auto`

### Frontend Tests
- Framework: Jest with React Testing Library
- Configuration: `frontend/jest.config.js`
- Run with: `npm test` or `npm run test:coverage`

### Running Specific Tests
```bash
# Backend - specific markers
pytest -m "auth"        # Authentication tests
pytest -m "database"    # Database tests
pytest -m "slow"        # Slow tests

# Frontend - specific tests
npm test -- ChatDialog.test.js
npm test -- --coverage --watchAll=false
```

## Important Development Notes

### Memory Leak Prevention
- See `MEMORY_LEAK_FIXES.md` for documented memory leak fixes
- Key areas: Event listeners cleanup, WebSocket connections, React component unmounting

### Email Service
- Uses Mailgun for production (configured in .env.prod)
- SMTP fallback available
- OTP service integrated for password reset and registration verification

### Scheduler Service
- APScheduler runs daily recommendation generation
- Starts on app startup, stops on shutdown
- See `backend/services/scheduler_service.py`

### Static File Handling
- Avatars: `backend/avatars/` (mounted at `/avatars`)
- Resumes: `backend/resumes/` (mounted at `/resumes`)
- Frontend builds served via CORS-enabled endpoints

### Branch Strategy
- `main`: Production-ready code
- `dev`: Development branch (current)
- Feature branches: `feature/descriptive-name`
- Bug fixes: `bugfix/issue-number-description`
- Hotfixes: `hotfix/critical-issue-description`

## Common Pitfalls & Solutions

1. **Port Conflicts**:
   - **Container mode** uses: 8000-8002, 11434-11435, 3000
   - **Development mode** uses: 5000-6002, 12434-12435, 1000, 8888 (vLLM)
   - **Solution**: Use `./deploy-dev.sh` and `./deploy-staging.sh` - they use different ports!
   - Both modes can run simultaneously without conflicts

2. **Ollama Model Missing**:
   - **Development**: Run `./setup-ollama-dev.sh` or manually: `OLLAMA_HOST="localhost:12434" ollama pull gemma3:latest`
   - **Container**: Run `./setup-ollama-updated.sh`

3. **vLLM Server Not Starting**:
   - **Check GPU**: Run `nvidia-smi` to verify GPU is available
   - **Check vLLM installation**: `/root/miniconda3/envs/python3.12/bin/python -c "import vllm"`
   - **Check port**: `lsof -i :8888` - if occupied, change `VLLM_PORT` in .env.dev
   - **Out of memory**: Reduce `VLLM_GPU_MEMORY_UTILIZATION` (try 0.7 or 0.6)
   - **Model download**: First run downloads model from HuggingFace (may take 5-15 mins)
   - **Logs**: Check server logs for detailed error messages

4. **vLLM Performance Issues**:
   - **Slow first request**: Model loading takes time, subsequent requests are fast
   - **Low throughput**: Check GPU utilization with `nvidia-smi` - should be 80-95%
   - **Out of memory errors**:
     - Reduce `VLLM_MAX_MODEL_LEN` (try 4096 or 2048)
     - Enable quantization: `VLLM_QUANTIZATION=awq`
     - Use smaller model: Switch to 3B or 1.5B model
   - **Connection refused**: Ensure vLLM server is running: `./start-vllm-dev.sh`

5. **Database Not Found**:
   - **Development**: SQLite auto-creates at `backend/db/app.db` on first run
   - **Container**: PostgreSQL initializes automatically via Docker
   - Tables auto-create on first run via SQLAlchemy

4. **Wrong Database Connection**:
   - **Development**: Ensure `.env.dev` has `DB_TYPE=sqlite`
   - **Container**: Ensure `.env.staging` has `DB_TYPE=postgresql`
   - Check: `backend/db/database.py` logs which DB it's using

5. **CORS Issues**:
   - **Development**: Frontend proxy points to `localhost:5000`
   - **Container**: Nginx handles CORS at reverse proxy level
   - Check: `frontend/package.json` proxy setting

6. **Environment Loading**:
   - **Development**: `./deploy-dev.sh` loads `.env.dev`
   - **Container**: Docker Compose loads `.env.staging`
   - Manual mode: `export $(grep -v '^#' .env.dev | xargs)`

7. **Services Won't Start**:
   - Check ports: `lsof -i :5000` (development) or `docker ps` (container)
   - Check logs: `tail -f .dev-pids/backend.log` (development)
   - Container logs: `docker logs idii-backend-staging`

8. **Switching Between Modes**:
   - Stop dev services: `./stop-dev.sh`
   - Stop containers: `docker-compose -f docker-compose.staging.yml down`
   - Both modes use different ports, so you can run both simultaneously if needed

## Frontend Component Architecture

### Key Components
- `PersonalAssistant.js`: Main chat interface with Personal Assistant
- `CareerAgent.js`: Career-specific chat and resume analysis interface
- `Dashboard.js`: User dashboard with AI insights and daily recommendations
- `Profile.js`: User profile management and resume upload
- `OnboardingWizard.js`: Multi-step user onboarding flow
- `CircularAgents.js`: Visual representation of available domain agents

### Services (frontend/src/services/)
- Authentication, chat, profile, career, activities, recommendations APIs
- All services use axios with configured base URLs from environment variables
