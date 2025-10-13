#!/bin/bash

#
# Stop Development Environment Script
# This script stops all locally running development services
#

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
PID_DIR="$PROJECT_ROOT/.dev-pids"

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════════"
echo "  🛑 Stopping Development Environment"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"

# Function to stop a service gracefully
stop_service() {
    local service_name=$1
    local pid_file="$PID_DIR/${service_name}.pid"

    if [ ! -f "$pid_file" ]; then
        echo -e "${YELLOW}⚠️  $service_name: No PID file found${NC}"
        return
    fi

    local pid=$(cat "$pid_file")

    if [ -z "$pid" ]; then
        echo -e "${YELLOW}⚠️  $service_name: Empty PID file${NC}"
        rm -f "$pid_file"
        return
    fi

    if ps -p $pid > /dev/null 2>&1; then
        # Verify this is actually our process
        local cmd=$(ps -p $pid -o comm= 2>/dev/null)
        echo -e "${BLUE}Stopping $service_name (PID: $pid, Command: $cmd)...${NC}"

        # Try graceful shutdown first (SIGTERM)
        kill -TERM $pid 2>/dev/null

        # Wait for process to stop gracefully
        local timeout=10
        while ps -p $pid > /dev/null 2>&1 && [ $timeout -gt 0 ]; do
            sleep 1
            timeout=$((timeout - 1))
        done

        # If still running, try SIGINT
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}Process didn't respond to SIGTERM, trying SIGINT...${NC}"
            kill -INT $pid 2>/dev/null
            sleep 3
        fi

        # Last resort: SIGKILL
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}Process still running, using force kill (SIGKILL)...${NC}"
            kill -9 $pid 2>/dev/null
            sleep 1
        fi

        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${RED}❌ Failed to stop $service_name (PID: $pid still running)${NC}"
            echo -e "${YELLOW}⚠️  You may need to manually kill this process${NC}"
        else
            echo -e "${GREEN}✓${NC} $service_name stopped"
            rm -f "$pid_file"
        fi
    else
        echo -e "${YELLOW}⚠️  $service_name: Process not running (PID: $pid)${NC}"
        rm -f "$pid_file"
    fi
}

# Check if PID directory exists
if [ ! -d "$PID_DIR" ]; then
    echo -e "${YELLOW}⚠️  No development environment is running (.dev-pids directory not found)${NC}"
    exit 0
fi

# Stop all services
echo -e "${BLUE}Stopping services...${NC}"
echo ""

# Stop Frontend
stop_service "frontend"

# Stop Backend Services
stop_service "backend"
stop_service "pa"
stop_service "career"

# Stop Ollama instances
stop_service "ollama1"
stop_service "ollama2"

# Additional cleanup: Find any remaining processes on dev ports (PRECISE MODE)
echo ""
echo -e "${BLUE}Checking for remaining processes on dev ports...${NC}"

# Read ports from .env.dev to ensure we only target dev environment ports
ENV_FILE="$PROJECT_ROOT/.env.dev"
if [ -f "$ENV_FILE" ]; then
    # Extract port values from .env.dev
    BACKEND_PORT=$(grep "^BACKEND_PORT=" "$ENV_FILE" | cut -d'=' -f2)
    PA_PORT=$(grep "^PA_PORT=" "$ENV_FILE" | cut -d'=' -f2)
    CAREER_PORT=$(grep "^CAREER_PORT=" "$ENV_FILE" | cut -d'=' -f2)
    FRONTEND_PORT=$(grep "^FRONTEND_PORT=" "$ENV_FILE" | cut -d'=' -f2)
    OLLAMA1_PORT=$(grep "^OLLAMA1_PORT=" "$ENV_FILE" | cut -d'=' -f2)
    OLLAMA2_PORT=$(grep "^OLLAMA2_PORT=" "$ENV_FILE" | cut -d'=' -f2)

    # Build ports array from .env.dev
    PORTS=()
    [ ! -z "$BACKEND_PORT" ] && PORTS+=("$BACKEND_PORT")
    [ ! -z "$PA_PORT" ] && PORTS+=("$PA_PORT")
    [ ! -z "$CAREER_PORT" ] && PORTS+=("$CAREER_PORT")
    [ ! -z "$FRONTEND_PORT" ] && PORTS+=("$FRONTEND_PORT")
    [ ! -z "$OLLAMA1_PORT" ] && PORTS+=("$OLLAMA1_PORT")
    [ ! -z "$OLLAMA2_PORT" ] && PORTS+=("$OLLAMA2_PORT")

    echo -e "${CYAN}ℹ️  Using ports from .env.dev: ${PORTS[*]}${NC}"
else
    # Fallback to hardcoded ports if .env.dev not found
    echo -e "${YELLOW}⚠️  .env.dev not found, using default ports${NC}"
    PORTS=(5000 6001 6002 1000 12434 12435)
fi

FOUND_ORPHAN=false

# Precise port-based cleanup: Only kill processes on these exact ports
for port in "${PORTS[@]}"; do
    # Get all PIDs listening on this port
    PIDS=$(lsof -ti:$port -sTCP:LISTEN 2>/dev/null)

    if [ ! -z "$PIDS" ]; then
        for PID in $PIDS; do
            # Get process info for display
            CMD=$(ps -p $PID -o comm= 2>/dev/null)
            FULL_CMD=$(ps -p $PID -o args= 2>/dev/null | head -c 80)

            echo -e "${YELLOW}⚠️  Found process on dev port $port (PID: $PID)${NC}"
            echo -e "    Process: ${CMD}"
            echo -e "    Command: ${FULL_CMD}..."
            FOUND_ORPHAN=true

            # Safety check: Verify this is NOT a system-critical or Docker process
            if [[ "$FULL_CMD" =~ (sshd|systemd|dbus|cron|getty|docker-proxy|dockerd|containerd) ]]; then
                echo -e "    ${RED}🛑 SKIPPED: This appears to be a system/Docker process!${NC}"
                continue
            fi

            # Ask user before killing (safer approach)
            read -p "    Kill this process? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                # Graceful shutdown first (SIGTERM)
                kill -TERM $PID 2>/dev/null
                sleep 2

                # Check if still running
                if ps -p $PID > /dev/null 2>&1; then
                    echo -e "    ${YELLOW}Process didn't stop, trying SIGINT...${NC}"
                    kill -INT $PID 2>/dev/null
                    sleep 2
                fi

                # Last resort: SIGKILL
                if ps -p $PID > /dev/null 2>&1; then
                    echo -e "    ${YELLOW}Using force kill (SIGKILL)...${NC}"
                    kill -9 $PID 2>/dev/null
                    sleep 1
                fi

                if ps -p $PID > /dev/null 2>&1; then
                    echo -e "    ${RED}❌ Failed to stop process${NC}"
                else
                    echo -e "    ${GREEN}✓${NC} Process stopped"
                fi
            else
                echo -e "    ${BLUE}Skipped (process left running)${NC}"
            fi
        done
    fi
done

if [ "$FOUND_ORPHAN" = false ]; then
    echo -e "${GREEN}✓${NC} No processes found on dev ports"
fi

# Clean up log files (optional)
echo ""
read -p "Do you want to delete log files? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Cleaning up log files...${NC}"
    rm -f "$PID_DIR"/*.log
    echo -e "${GREEN}✓${NC} Log files deleted"
fi

# Remove PID directory if empty
if [ -d "$PID_DIR" ] && [ -z "$(ls -A $PID_DIR)" ]; then
    rmdir "$PID_DIR"
    echo -e "${GREEN}✓${NC} PID directory removed"
fi

# Clean up frontend development environment file
FRONTEND_ENV_FILE="$PROJECT_ROOT/frontend/.env.development.local"
if [ -f "$FRONTEND_ENV_FILE" ]; then
    echo ""
    echo -e "${BLUE}Cleaning up frontend development environment file...${NC}"
    rm -f "$FRONTEND_ENV_FILE"
    echo -e "${GREEN}✓${NC} Frontend .env.development.local removed"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Development Environment Stopped${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}To start development environment again:${NC}"
echo -e "  ${YELLOW}./deploy-dev.sh${NC}"
echo ""
echo -e "${BLUE}Container services (if running) are unaffected:${NC}"
echo -e "  View: ${YELLOW}docker ps${NC}"
echo -e "  Access: ${YELLOW}https://localhost${NC} or ${YELLOW}https://staging.idii.co${NC}"
echo ""
