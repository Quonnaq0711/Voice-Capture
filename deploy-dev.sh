#!/bin/bash

#
# Development Environment Deployment Script
# This script starts all services locally for development
# Ports: Frontend(1000), Backend(5000), PA(6001), Career(6002), Ollama(12434/12435)
#

set -e  # Exit on error

# Activate conda python3.12 environment for backend dependencies
if [ -f "/root/miniconda3/bin/activate" ]; then
    source /root/miniconda3/bin/activate python3.12
    echo "✓ Activated conda python3.12 environment"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Project paths - Dynamically detect script location
# This works regardless of where the user's home directory is
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
BACKEND_DIR="$PROJECT_ROOT/backend"
PA_DIR="$PROJECT_ROOT/backend/personal_assistant"
CAREER_DIR="$PROJECT_ROOT/modules/agents/career/src"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
PID_DIR="$PROJECT_ROOT/.dev-pids"

# Load environment variables
ENV_FILE="$PROJECT_ROOT/.env.dev"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Error: .env.dev file not found!${NC}"
    exit 1
fi

# Source environment file (remove comments and empty lines safely)
set -a
source <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
set +a

# Ports from .env.dev
BACKEND_PORT=${BACKEND_PORT:-6000}
PA_PORT=${PA_PORT:-6001}
CAREER_PORT=${CAREER_PORT:-6002}
FRONTEND_PORT=${FRONTEND_PORT:-1000}
OLLAMA1_PORT=${OLLAMA1_PORT:-12434}
OLLAMA2_PORT=${OLLAMA2_PORT:-12435}

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Starting Development Environment"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"
echo -e "${BLUE}Project Root:${NC} $PROJECT_ROOT"
echo -e "${BLUE}Environment:${NC} Development (SQLite + Local Services)"
echo ""
echo -e "${YELLOW}Port Configuration:${NC}"
echo "  Frontend:         http://localhost:$FRONTEND_PORT"
echo "  Backend API:      http://localhost:$BACKEND_PORT"
echo "  Personal Asst:    http://localhost:$PA_PORT"
echo "  Career Agent:     http://localhost:$CAREER_PORT"
echo "  Ollama 1 (PA):    http://localhost:$OLLAMA1_PORT"
echo "  Ollama 2 (Career): http://localhost:$OLLAMA2_PORT"
echo ""

# Create PID directory
mkdir -p "$PID_DIR"

# Function to check if port is available
check_port() {
    local port=$1
    local service=$2
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}❌ Error: Port $port ($service) is already in use!${NC}"
        echo -e "${YELLOW}   Check with: lsof -i :$port${NC}"
        return 1
    else
        echo -e "${GREEN}✓${NC} Port $port available for $service"
        return 0
    fi
}

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for $name to be ready...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name is ready!${NC}"
            return 0
        fi

        if [ $((attempt % 5)) -eq 0 ]; then
            echo -e "${YELLOW}   Still waiting... (${attempt}/${max_attempts})${NC}"
        fi

        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ $name failed to start after ${max_attempts} attempts${NC}"
    return 1
}

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Error: Ollama is not installed!${NC}"
    echo -e "${YELLOW}   Install from: https://ollama.ai${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Step 1: Pre-flight Checks${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Check all ports
PORTS_OK=true
check_port $BACKEND_PORT "Backend" || PORTS_OK=false
check_port $PA_PORT "Personal Assistant" || PORTS_OK=false
check_port $CAREER_PORT "Career Agent" || PORTS_OK=false
check_port $FRONTEND_PORT "Frontend" || PORTS_OK=false
check_port $OLLAMA1_PORT "Ollama 1" || PORTS_OK=false
check_port $OLLAMA2_PORT "Ollama 2" || PORTS_OK=false

if [ "$PORTS_OK" = false ]; then
    echo ""
    echo -e "${RED}❌ Port conflicts detected. Please free the ports or stop conflicting services.${NC}"
    echo -e "${YELLOW}💡 Tip: Run './stop-dev.sh' to stop all dev services${NC}"
    exit 1
fi

# Check Python dependencies
echo ""
echo -e "${BLUE}Checking Python dependencies...${NC}"
if ! python3 -c "import fastapi, uvicorn, sqlalchemy" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Some Python dependencies missing. Installing...${NC}"
    pip install -r "$PROJECT_ROOT/backend/requirements.txt"
fi
echo -e "${GREEN}✓${NC} Python dependencies OK"

# Check Node dependencies
echo -e "${BLUE}Checking Node dependencies...${NC}"
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${YELLOW}⚠️  Node modules not installed. Installing...${NC}"
    cd "$FRONTEND_DIR"
    npm install
    cd "$PROJECT_ROOT"
fi
echo -e "${GREEN}✓${NC} Node dependencies OK"

# Check SQLite database
echo -e "${BLUE}Checking SQLite database...${NC}"
if [ ! -f "$PROJECT_ROOT/backend/db/app.db" ]; then
    echo -e "${YELLOW}⚠️  SQLite database not found. It will be created on first backend start.${NC}"
else
    DB_SIZE=$(du -h "$PROJECT_ROOT/backend/db/app.db" | cut -f1)
    echo -e "${GREEN}✓${NC} SQLite database exists ($DB_SIZE)"
fi

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Step 2: Starting Ollama Instances${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Start Ollama 1 (Personal Assistant)
echo -e "${BLUE}Starting Ollama 1 (Personal Assistant) on port $OLLAMA1_PORT...${NC}"
OLLAMA_HOST="0.0.0.0:$OLLAMA1_PORT" nohup ollama serve > "$PID_DIR/ollama1.log" 2>&1 &
OLLAMA1_PID=$!
echo $OLLAMA1_PID > "$PID_DIR/ollama1.pid"
echo -e "${GREEN}✓${NC} Ollama 1 started (PID: $OLLAMA1_PID)"

sleep 3

# Start Ollama 2 (Career Agent)
echo -e "${BLUE}Starting Ollama 2 (Career Agent) on port $OLLAMA2_PORT...${NC}"
OLLAMA_HOST="0.0.0.0:$OLLAMA2_PORT" nohup ollama serve > "$PID_DIR/ollama2.log" 2>&1 &
OLLAMA2_PID=$!
echo $OLLAMA2_PID > "$PID_DIR/ollama2.pid"
echo -e "${GREEN}✓${NC} Ollama 2 started (PID: $OLLAMA2_PID)"

sleep 3

# Wait for Ollama instances to be ready
wait_for_service "http://localhost:$OLLAMA1_PORT/api/tags" "Ollama 1" || exit 1
wait_for_service "http://localhost:$OLLAMA2_PORT/api/tags" "Ollama 2" || exit 1

# Setup Ollama models
echo ""
echo -e "${BLUE}Setting up Ollama models (gemma3:latest)...${NC}"
bash "$PROJECT_ROOT/setup-ollama-dev.sh"

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Step 3: Starting Backend Services${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Start Backend (Port 6000)
echo -e "${BLUE}Starting Backend on port $BACKEND_PORT...${NC}"
cd "$PROJECT_ROOT"
nohup python3 -m uvicorn backend.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload \
    > "$PID_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$PID_DIR/backend.pid"
echo -e "${GREEN}✓${NC} Backend started (PID: $BACKEND_PID)"
echo -e "${YELLOW}   Logs: tail -f $PID_DIR/backend.log${NC}"

# Start Personal Assistant (Port 6001)
echo -e "${BLUE}Starting Personal Assistant on port $PA_PORT...${NC}"
cd "$PA_DIR"
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port $PA_PORT --reload \
    > "$PID_DIR/pa.log" 2>&1 &
PA_PID=$!
echo $PA_PID > "$PID_DIR/pa.pid"
cd "$PROJECT_ROOT"
echo -e "${GREEN}✓${NC} Personal Assistant started (PID: $PA_PID)"
echo -e "${YELLOW}   Logs: tail -f $PID_DIR/pa.log${NC}"

# Start Career Agent (Port 6002)
echo -e "${BLUE}Starting Career Agent on port $CAREER_PORT...${NC}"
cd "$CAREER_DIR"
nohup python3 -m uvicorn main:app --host 0.0.0.0 --port $CAREER_PORT --reload \
    > "$PID_DIR/career.log" 2>&1 &
CAREER_PID=$!
echo $CAREER_PID > "$PID_DIR/career.pid"
cd "$PROJECT_ROOT"
echo -e "${GREEN}✓${NC} Career Agent started (PID: $CAREER_PID)"
echo -e "${YELLOW}   Logs: tail -f $PID_DIR/career.log${NC}"

# Wait for services to be ready
echo ""
wait_for_service "http://localhost:$BACKEND_PORT/docs" "Backend" || exit 1
wait_for_service "http://localhost:$PA_PORT/api/chat/health" "Personal Assistant" || exit 1
wait_for_service "http://localhost:$CAREER_PORT/api/chat/health" "Career Agent" || exit 1

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Step 4: Starting Frontend${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Create frontend .env.development.local for dev mode (overrides package.json proxy)
echo -e "${BLUE}Creating frontend development environment file...${NC}"
cat > "$FRONTEND_DIR/.env.development.local" << EOF
# Auto-generated by deploy-dev.sh for development mode
# This file is temporary and will be removed by stop-dev.sh
# DO NOT COMMIT - This is in .gitignore

# Backend URLs for development mode
REACT_APP_BACKEND_URL=http://localhost:$BACKEND_PORT
REACT_APP_PA_URL=http://localhost:$PA_PORT
REACT_APP_CAREER_URL=http://localhost:$CAREER_PORT
REACT_APP_ENVIRONMENT=development

# Development mode flag
REACT_APP_DEV_MODE=true
EOF
echo -e "${GREEN}✓${NC} Frontend environment file created"
echo -e "${YELLOW}   Backend URL: http://localhost:$BACKEND_PORT${NC}"

echo -e "${BLUE}Starting Frontend on port $FRONTEND_PORT...${NC}"
echo -e "${YELLOW}📝 Note: Frontend will run in foreground with hot reload${NC}"
echo -e "${YELLOW}   Press Ctrl+C to stop (other services will keep running)${NC}"
echo ""

cd "$FRONTEND_DIR"

# Save frontend PID for cleanup
echo "$$" > "$PID_DIR/frontend.pid"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Development Environment Started Successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Access your application:${NC}"
echo -e "  🌐 Frontend:         ${GREEN}http://localhost:$FRONTEND_PORT${NC}"
echo -e "  📡 Backend API:      ${GREEN}http://localhost:$BACKEND_PORT/docs${NC}"
echo -e "  🤖 Personal Asst:    ${GREEN}http://localhost:$PA_PORT/api/chat/health${NC}"
echo -e "  💼 Career Agent:     ${GREEN}http://localhost:$CAREER_PORT/api/chat/health${NC}"
echo -e "  🧠 Ollama 1 (PA):    ${GREEN}http://localhost:$OLLAMA1_PORT/api/tags${NC}"
echo -e "  🧠 Ollama 2 (Career): ${GREEN}http://localhost:$OLLAMA2_PORT/api/tags${NC}"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo -e "  Stop all services:   ${CYAN}./stop-dev.sh${NC}"
echo -e "  View backend logs:   ${CYAN}tail -f .dev-pids/backend.log${NC}"
echo -e "  View PA logs:        ${CYAN}tail -f .dev-pids/pa.log${NC}"
echo -e "  View career logs:    ${CYAN}tail -f .dev-pids/career.log${NC}"
echo ""
echo -e "${BLUE}Starting frontend (Ctrl+C to stop)...${NC}"
echo ""

# Start frontend in foreground
PORT=$FRONTEND_PORT npm start

# Cleanup on exit
echo ""
echo -e "${YELLOW}Frontend stopped. Backend services are still running.${NC}"
echo -e "${YELLOW}Run './stop-dev.sh' to stop all services.${NC}"
