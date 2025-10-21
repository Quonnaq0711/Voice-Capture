# Sadaora AI Assistant Platform

An intelligent personal assistant platform powered by Large Language Models (LLMs) that delivers personalized insights by analyzing user data including resumes, profiles, hobbies, and achievements.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![Docker](https://img.shields.io/badge/docker-required-blue.svg)](https://www.docker.com/)

---

## Overview

The Sadaora AI Assistant Platform operates through a sophisticated workflow where a central **Personal Assistant** orchestrates specialized domain agents (Career, Hobby, Travel, Money, etc.) to provide personalized insights. The system generates three types of prompts (Manual, Selected, and Auto) based on user input and context, distributes them to domain-specific agents that leverage their knowledge bases and external tools, then synthesizes the results into coherent recommendations delivered through an intuitive web interface.

**Key Features:**
- 🤖 **Multi-Agent Architecture** - Specialized AI agents for different life domains
- 💬 **Intelligent Chat Interface** - Context-aware conversation with memory
- 📄 **Resume Analysis** - AI-powered career insights and recommendations
- 🔄 **Real-time Streaming** - Progressive analysis with live updates
- 🚀 **GPU-Accelerated** - Fast LLM inference with NVIDIA GPU support
- 🗄️ **Dual Database Support** - SQLite for dev, PostgreSQL for production
- 🐳 **Containerized Deployment** - Docker-based microservices architecture

For detailed architecture, see [architecture documentation](docs/architecture/high_level_architecture.md).

---

## Technology Stack

### Frontend
- **React** 18.2 - UI framework
- **JavaScript** (ES6+) - Primary language
- **Tailwind CSS** - Styling framework
- **Axios** - HTTP client
- **React Router** - Navigation
- **React Markdown** - Markdown rendering

### Backend
- **Python** 3.10+ - Primary language
- **FastAPI** - REST API framework
- **SQLAlchemy** - ORM for database operations
- **Ollama** - Local LLM inference (gemma3:latest)
- **LangChain** - LLM application framework
- **Uvicorn/Gunicorn** - ASGI server

### Database
- **PostgreSQL** 15 - Production database (staging/production)
- **SQLite** 3 - Development database (local)

### Infrastructure
- **Docker** & **Docker Compose** - Containerization
- **Nginx** - Reverse proxy and SSL termination
- **Google Cloud Platform (GCP)** - VM hosting
- **NVIDIA GPU** - LLM acceleration

### AI/ML
- **Ollama** - LLM serving platform
- **gemma3:latest** - Primary language model
- **NVIDIA CUDA** - GPU acceleration

---

## System Architecture

### Service Stack

```
┌─────────────────────────────────────────────────────┐
│ nginx (80, 443) - Reverse Proxy & SSL              │
│   ├─► Frontend (React SPA)                         │
│   ├─► Backend API :8000 (FastAPI)                  │
│   ├─► Personal Assistant :8001 (Chat API)          │
│   └─► Career Agent :8002 (Career Analysis)         │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Data & AI Services                                  │
│   ├─► PostgreSQL :5432 (Database)                  │
│   ├─► Ollama 1 :11434 (PA LLM + GPU)              │
│   └─► Ollama 2 :11435 (Career LLM + GPU)          │
└─────────────────────────────────────────────────────┘
```

### Core Components

| Component | Technology | Port | Purpose |
|-----------|-----------|------|---------|
| **Frontend** | React + Nginx | 80/443 | Web interface |
| **Backend API** | FastAPI | 8000 | Main REST API |
| **Personal Assistant** | FastAPI + Ollama | 8001 | Chat orchestration |
| **Career Agent** | FastAPI + Ollama | 8002 | Career insights |
| **PostgreSQL** | PostgreSQL 15 | 5432 | Database (staging) |
| **Ollama PA** | Ollama + gemma3 | 11434 | LLM for PA |
| **Ollama Career** | Ollama + gemma3 | 11435 | LLM for Career |

### Data Persistence

**Staging/Production** (`/home/idii/data/`):
- PostgreSQL database
- User uploads (resumes, avatars)
- Ollama models and cache

**Development** (project root):
- SQLite database (`backend/db/app.db`)
- Local user uploads
- Local Ollama models

---

## System Requirements

### Minimum Requirements
- **OS**: Linux (Ubuntu 20.04+, Debian 11+) or WSL2
- **CPU**: 4 cores (8 cores recommended)
- **RAM**: 16 GB (32 GB recommended)
- **Disk**: 50 GB free space
- **GPU**: NVIDIA GPU with 8GB+ VRAM (optional, but highly recommended)

### Software Dependencies
- **Docker** 24.0+
- **Docker Compose** 2.20+
- **Python** 3.10+
- **Node.js** 18+
- **NVIDIA Drivers** 525+ (if using GPU)
- **NVIDIA Container Toolkit** (for GPU support)

---

## Getting Started

### Quick Start - Development Environment (Linux)

```bash
# Clone the repository
git clone https://github.com/your-org/Product.git
cd Product

# Start all development services
./deploy-dev.sh

# Services will be available at:
# - Frontend:        http://localhost:1000
# - Backend API:     http://localhost:5000/docs
# - Personal Asst:   http://localhost:6001
# - Career Agent:    http://localhost:6002
```

**Development Mode** uses:
- Ports: 1000, 5000-6002, 12434-12435
- Database: SQLite (`backend/db/app.db`)
- Ollama: Local instances on ports 12434-12435

See [development_setup_automated.md](docs/development/development_setup_automated.md) for details.

### Quick Start - Staging/Production Deployment

```bash
# Deploy all services in Docker containers
./deploy-staging.sh

# Services will be available at:
# - Frontend:        https://staging.idii.co (or https://localhost)
# - Backend API:     http://localhost:8000/docs
# - Personal Asst:   http://localhost:8001
# - Career Agent:    http://localhost:8002
```

**Staging Mode** uses:
- Ports: 80/443, 8000-8002, 11434-11435
- Database: PostgreSQL (container)
- Ollama: Docker containers with GPU

See [deployment_guide.md](docs/deployment/deployment_guide.md) for details.

### Manual Setup (All Platforms)

For manual step-by-step installation on Windows, macOS, or Linux:

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/Product.git
   cd Product
   ```

2. **Follow platform-specific setup**
   - See [development_setup_manual.md](docs/development/development_setup_manual.md)

3. **Initialize database**
   ```bash
   python backend/scripts/create_tables.py
   ```

4. **Start backend**
   ```bash
   uvicorn backend.main:app --reload --port 5000
   ```

5. **Start frontend**
   ```bash
   cd frontend
   PORT=1000 npm start
   ```

6. **Access the application**
   - Frontend: http://localhost:1000
   - API docs: http://localhost:5000/docs

---

## Environment Modes

The platform supports two independent deployment modes:

| Feature | Development Mode | Staging/Production Mode |
|---------|-----------------|-------------------------|
| **Purpose** | Local testing & iteration | Production deployment |
| **Services** | Local processes | Docker containers |
| **Ports** | 1000, 5000-6002, 12434-12435 | 80/443, 8000-8002, 11434-11435 |
| **Database** | SQLite (file-based) | PostgreSQL (container) |
| **Frontend** | Port 1000 (hot reload) | Nginx on 80/443 |
| **Ollama** | Local instances | Docker with GPU |
| **Start** | `./deploy-dev.sh` | `./deploy-staging.sh` |
| **Stop** | `./stop-dev.sh` | `docker-compose down` |

**Both modes can run simultaneously** without conflicts!

---

## Project Structure

```
Product/
├── README.md                       # This file
├── .gitignore                      # Git ignore rules
├── .env.dev                        # Development environment config
├── .env.staging                    # Staging environment config
│
├── deploy-dev.sh                   # Development deployment script
├── deploy-staging.sh               # Staging deployment script
├── stop-dev.sh                     # Stop development services
├── setup-ollama-dev.sh             # Setup Ollama for dev mode
├── docker-compose.staging.yml      # Docker Compose for staging
│
├── backend/                        # Backend services
│   ├── main.py                     # Main FastAPI application
│   ├── api/                        # API route definitions
│   ├── db/                         # Database connections
│   │   ├── database.py             # SQLAlchemy setup
│   │   └── app.db                  # SQLite database (dev)
│   ├── models/                     # SQLAlchemy models
│   │   ├── user.py                 # User authentication
│   │   ├── profile.py              # User profiles
│   │   ├── resume.py               # Resume metadata
│   │   ├── career_insight.py       # Career insights
│   │   ├── chat.py                 # Chat messages
│   │   ├── session.py              # Chat sessions
│   │   ├── activity.py             # User activities
│   │   └── daily_recommendation.py # Daily recommendations
│   ├── services/                   # Business logic
│   │   ├── email_service.py        # Email sending
│   │   ├── otp_service.py          # OTP verification
│   │   └── scheduler_service.py    # Background tasks
│   ├── personal_assistant/         # Personal Assistant service
│   │   ├── main.py                 # PA API server (port 8001)
│   │   └── chat_service.py         # Chat logic
│   ├── scripts/                    # Utility scripts
│   │   ├── create_tables.py        # Database initialization
│   │   ├── init_postgres.sh        # PostgreSQL setup
│   │   └── init_postgres.sql       # PostgreSQL schema
│   └── avatars/                    # User avatar uploads (dev)
│   └── resumes/                    # User resume uploads (dev)
│
├── frontend/                       # React frontend
│   ├── package.json                # NPM dependencies
│   ├── public/                     # Static assets
│   └── src/
│       ├── components/             # React components
│       │   ├── PersonalAssistant.js # PA chat interface
│       │   ├── CareerAgent.js      # Career agent interface
│       │   ├── Dashboard.js        # Main dashboard
│       │   ├── Profile.js          # User profile
│       │   └── OnboardingWizard.js # User onboarding
│       ├── services/               # API clients
│       │   ├── chatApi.js          # Chat API
│       │   ├── authApi.js          # Authentication
│       │   └── careerApi.js        # Career agent API
│       └── setupProxy.js           # Dev proxy config
│
├── modules/agents/                 # Specialized AI agents
│   ├── career/                     # Career guidance agent
│   │   ├── src/
│   │   │   ├── main.py             # Career API (port 8002)
│   │   │   └── chat_service.py     # Career analysis logic
│   │   └── Dockerfile.prod         # Production container
│   ├── hobby/                      # Hobby agent (future)
│   ├── travel/                     # Travel agent (future)
│   ├── money/                      # Finance agent (future)
│   └── ...                         # Other domain agents
│
├── docs/                           # Documentation
│   ├── architecture/               # System architecture
│   │   └── high_level_architecture.md
│   ├── deployment/                 # Deployment guides
│   │   ├── README.md               # Deployment index
│   │   ├── deployment_guide.md     # Complete deployment guide
│   │   └── database_initialization.md
│   └── development/                # Development guides
│       ├── development_setup_automated.md  # Linux automated
│       ├── development_setup_manual.md     # Manual setup
│       ├── coding_guidelines.md    # Code standards
│       └── testing_strategy.md     # Testing approach
│
├── scripts/                        # Project scripts
│   ├── init_postgres.sh            # PostgreSQL initialization
│   └── init_postgres.sql           # PostgreSQL schema
│
├── data/                           # Docker volumes (staging)
│   ├── ollama-staging/             # PA Ollama models
│   └── ollama2-staging/            # Career Ollama models
│
└── tests/                          # Test suites
    ├── integration_tests/          # Integration tests
    ├── performance_tests/          # Performance tests
    └── smoke_tests/                # Smoke tests
```

---

## Key Features

### 1. Multi-Agent System
- **Personal Assistant**: Central orchestrator managing conversation flow
- **Career Agent**: Specialized in resume analysis and career guidance
- **Future Agents**: Hobby, Travel, Money, Health, etc. (modular architecture)

### 2. Intelligent Chat
- Context-aware conversations with memory
- Real-time streaming responses
- Multi-turn dialogue support
- Integration with user profile data

### 3. Resume Analysis
- PDF and TXT file support
- AI-powered insights extraction
- Real-time streaming analysis
- Section-by-section progress updates

### 4. User Management
- Secure authentication (JWT)
- OTP verification for registration/password reset
- Profile management with customizable fields
- Activity tracking and recommendations

### 5. Data Persistence
- User uploads organized by user ID
- Database migration support (SQLite ↔ PostgreSQL)
- Automatic backups and recovery

---

## Quick Commands

### Development Mode

```bash
# Start all services
./deploy-dev.sh

# Stop all services
./stop-dev.sh

# Initialize database
python backend/scripts/create_tables.py

# Setup Ollama models
./setup-ollama-dev.sh

# View logs
tail -f .dev-pids/*.log

# Check running processes
ps aux | grep -E "(uvicorn|npm|ollama)"
```

### Staging Mode

```bash
# Deploy all services
./deploy-staging.sh

# Stop all services
docker-compose -f docker-compose.staging.yml down

# View logs
docker logs -f idii-backend-staging

# Restart a service
docker restart idii-PA-staging

# Check container status
docker ps

# Database backup
docker exec idii-db-staging pg_dump -U postgres idii-staging > backup.sql
```

---

## Contributing

We welcome contributions to improve the Sadaora AI Assistant Platform!

### Development Workflow

1. **Fork the repository** and create your branch from `main`

2. **Setup development environment**
   - Linux: [development_setup_automated.md](docs/development/development_setup_automated.md)
   - Other platforms: [development_setup_manual.md](docs/development/development_setup_manual.md)

3. **Make your changes**
   - Follow [coding guidelines](docs/development/coding_guidelines.md)
   - Add tests for new features
   - Update documentation

4. **Test your changes**
   ```bash
   # Backend tests
   cd backend
   pytest

   # Frontend tests
   cd frontend
   npm test
   ```

5. **Submit a pull request** to the `main` branch

### Branch Strategy

- `main` - Production-ready code
- `qa-v1` - QA testing branch
- Feature branches - `feature/descriptive-name`
- Bug fixes - `bugfix/issue-description`
- Hotfixes - `hotfix/critical-fix`

### Code Standards

- Follow [coding guidelines](docs/development/coding_guidelines.md)
- Write meaningful commit messages
- Add docstrings for all public functions
- Maintain >80% code coverage
- Use type hints in Python code

### Documentation

- Update relevant documentation
- Add examples for new features
- Keep architecture diagrams current
- Document breaking changes

For detailed guidelines, see [contribution_guidelines.md](docs/development/contribution_guidelines.md).

---

## Documentation

### For Developers
- [Development Setup (Automated)](docs/development/development_setup_automated.md) - Quick Linux setup
- [Development Setup (Manual)](docs/development/development_setup_manual.md) - Step-by-step guide
- [Coding Guidelines](docs/development/coding_guidelines.md) - Code standards
- [Testing Strategy](docs/development/testing_strategy.md) - Testing approach

### For DevOps
- [Deployment Guide](docs/deployment/deployment_guide.md) - Complete deployment handbook
- [Database Initialization](docs/deployment/database_initialization.md) - PostgreSQL setup
- [Deployment Index](docs/deployment/README.md) - Quick navigation

### Architecture
- [High-Level Architecture](docs/architecture/high_level_architecture.md) - System design
- [Component Overview](docs/architecture/) - Detailed component docs

---

## Troubleshooting

### Common Issues

**Issue**: Services fail to start in development mode
```bash
# Check ports are not in use
lsof -i :5000
lsof -i :1000

# Stop conflicting services
./stop-dev.sh
```

**Issue**: Database connection errors
```bash
# Development: Check SQLite database exists
ls -la backend/db/app.db

# Staging: Check PostgreSQL container
docker exec idii-db-staging pg_isready -U postgres
```

**Issue**: Ollama model not found
```bash
# Development
OLLAMA_HOST="localhost:12434" ollama pull gemma3:latest

# Staging
docker exec idii-ollama-staging ollama pull gemma3:latest
```

**Issue**: GPU not detected
```bash
# Check NVIDIA drivers
nvidia-smi

# Check Docker GPU runtime
docker info | grep -i runtime
```

For more troubleshooting, see:
- Development: [development_setup_automated.md - Troubleshooting](docs/development/development_setup_automated.md#troubleshooting)
- Deployment: [deployment_guide.md - Troubleshooting](docs/deployment/deployment_guide.md#troubleshooting)

---

## Security Configuration

### CORS (Cross-Origin Resource Sharing)

The platform implements **environment-based CORS configuration** to balance development flexibility with production security.

#### Configuration

CORS origins are controlled via the `CORS_ALLOWED_ORIGINS` environment variable in `.env.dev` and `.env.staging`:

**Development** (`.env.dev`):
```bash
CORS_ALLOWED_ORIGINS=http://localhost:1000,http://localhost:3000,http://127.0.0.1:1000,http://127.0.0.1:3000
```
- Allows all common development ports
- Supports localhost and 127.0.0.1 variants
- Enables Swagger UI access

**Staging** (`.env.staging`):
```bash
CORS_ALLOWED_ORIGINS=https://staging.idii.co,https://idii.co
```
- Restricted to known production domains
- HTTPS only
- Prevents unauthorized API access

**Production**:
```bash
CORS_ALLOWED_ORIGINS=https://idii.co
```
- Single domain only
- Maximum security

#### Implementation

Located in `backend/config/cors_config.py`:
- `get_allowed_origins()` - Returns allowed origins based on `ENVIRONMENT` variable
- `get_allowed_methods()` - Returns allowed HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS)
- `log_cors_configuration()` - Logs CORS settings at startup

#### Startup Logs

The backend displays CORS configuration on startup:

```
============================================================
🔒 CORS Security Configuration
============================================================
Environment: development
Allowed Origins (6):
  ✓ http://localhost:1000
  ✓ http://localhost:3000
  ✓ http://127.0.0.1:1000
  ✓ http://127.0.0.1:3000
  ✓ http://localhost:5000
  ✓ http://127.0.0.1:5000
Allowed Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
Credentials Allowed: True
============================================================
```

#### Security Benefits

| Feature | Development | Staging/Production |
|---------|-------------|-------------------|
| **CSRF Protection** | Limited | ✅ Full |
| **Domain Whitelist** | Local only | ✅ Strict |
| **Credential Safety** | Local scope | ✅ Protected |
| **Flexibility** | ✅ High | Restricted |

### File Upload Security

File uploads enforce server-side validation to prevent DoS attacks and malicious file uploads.

#### Resume Uploads

- **Max Size**: 10 MB
- **Allowed Formats**: `.pdf`, `.docx`, `.txt`
- **Validation**: `backend/utils/file_validator.py`
- **Error Code**: HTTP 413 (Payload Too Large) for oversized files

#### Avatar Uploads

- **Max Size**: 5 MB
- **Allowed Formats**: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- **Processing**: Automatic resize to 500x500 max
- **Optimization**: Quality 85%, optimized for web

#### Security Features

- ✅ Server-side size validation (frontend validation can be bypassed)
- ✅ File extension whitelist
- ✅ Filename sanitization (prevents path traversal)
- ✅ Empty file detection
- ✅ Orphan file cleanup on database failure

Configuration in `backend/config/file_upload_config.py`:
```python
MAX_RESUME_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_AVATAR_SIZE = 5 * 1024 * 1024   # 5 MB
```

### Authentication & Tokens

- **Access Token**: 30-minute expiry, JWT-based
- **Refresh Token**: 7-day expiry, one-time use, database-tracked
- **Token Rotation**: Automatic refresh before expiration
- **Revocation**: Immediate token invalidation on logout

See `backend/utils/auth.py` and `backend/models/refresh_token.py` for implementation.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **Ollama** - For providing local LLM inference
- **FastAPI** - For the excellent Python web framework
- **React** - For the powerful UI library
- **LangChain** - For LLM application framework

---

## Contact & Support

- **Documentation**: See [docs/](docs/) directory
- **Issues**: Report bugs and request features via GitHub Issues
- **Email**: support@sadaora.com

---
