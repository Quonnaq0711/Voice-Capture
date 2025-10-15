#!/bin/bash

#
# Setup Ollama Models for Development Environment
# This script installs and verifies gemma3:latest on both Ollama instances
# Ollama 1 (PA): Port 12434
# Ollama 2 (Career): Port 12435
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

# Load environment variables
ENV_FILE="$PROJECT_ROOT/.env.dev"

if [ -f "$ENV_FILE" ]; then
    set -a
    source <(grep -v '^#' "$ENV_FILE" | grep -v '^$')
    set +a
fi

OLLAMA1_PORT=${OLLAMA1_PORT:-12434}
OLLAMA2_PORT=${OLLAMA2_PORT:-12435}
MODEL=${OLLAMA_MODEL:-gemma3:latest}

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════════"
echo "  🤖 Setting up Ollama Models (Development)"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"
echo -e "${BLUE}Model:${NC} $MODEL"
echo -e "${BLUE}Ollama 1 (PA):${NC} http://localhost:$OLLAMA1_PORT"
echo -e "${BLUE}Ollama 2 (Career):${NC} http://localhost:$OLLAMA2_PORT"
echo ""

# Function to wait for Ollama to be ready
wait_for_ollama() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for $name to be ready...${NC}"

    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port/api/tags" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ $name is ready!${NC}"
            return 0
        fi

        if [ $((attempt % 5)) -eq 0 ]; then
            echo -e "${YELLOW}   Still waiting... (${attempt}/${max_attempts})${NC}"
        fi

        sleep 2
        attempt=$((attempt + 1))
    done

    echo -e "${RED}❌ $name not responding after ${max_attempts} attempts${NC}"
    return 1
}

# Function to check if model exists
check_model() {
    local port=$1
    local model=$2
    local response=$(curl -s "http://localhost:$port/api/tags")

    if echo "$response" | grep -q "\"$model\""; then
        return 0
    else
        return 1
    fi
}

# Function to pull model
pull_model() {
    local port=$1
    local model=$2
    local name=$3

    echo -e "${BLUE}📥 Pulling model '$model' to $name...${NC}"
    echo -e "${YELLOW}   This may take several minutes...${NC}"

    # Use Ollama CLI with specific port
    OLLAMA_HOST="localhost:$port" ollama pull "$model"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Successfully pulled $model to $name${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to pull $model to $name${NC}"
        return 1
    fi
}

# Function to test model
test_model() {
    local port=$1
    local model=$2
    local name=$3

    echo -e "${BLUE}🧪 Testing model '$model' on $name...${NC}"

    # Simple test using Ollama CLI
    OLLAMA_HOST="localhost:$port" ollama run "$model" "Say hi in 3 words" 2>&1 | head -n 5

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Model test passed on $name${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Model test had issues (might work anyway)${NC}"
        return 1
    fi
}

# Function to setup Ollama instance
setup_ollama_instance() {
    local port=$1
    local name=$2

    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Setting up $name (Port $port)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    # Wait for Ollama to be ready
    if ! wait_for_ollama "$port" "$name"; then
        echo -e "${RED}❌ Failed to setup $name - service not responding${NC}"
        return 1
    fi

    # Check if model already exists
    if check_model "$port" "$MODEL"; then
        echo -e "${GREEN}✅ Model '$MODEL' already exists on $name${NC}"

        # Still test it
        test_model "$port" "$MODEL" "$name"
    else
        echo -e "${YELLOW}⚠️  Model '$MODEL' not found on $name${NC}"

        # Pull the model
        if pull_model "$port" "$MODEL" "$name"; then
            # Test the model
            test_model "$port" "$MODEL" "$name"
        else
            echo -e "${RED}❌ Failed to setup model on $name${NC}"
            return 1
        fi
    fi

    # List all models
    echo ""
    echo -e "${BLUE}📋 Installed models on $name:${NC}"
    OLLAMA_HOST="localhost:$port" ollama list

    echo -e "${GREEN}✅ $name setup complete!${NC}"
    return 0
}

# Main execution
echo -e "${BLUE}Starting Ollama setup for both instances...${NC}"

# Setup Ollama 1 (Personal Assistant)
if setup_ollama_instance "$OLLAMA1_PORT" "Ollama 1 (PA)"; then
    OLLAMA1_OK=true
else
    OLLAMA1_OK=false
fi

# Setup Ollama 2 (Career Agent)
if setup_ollama_instance "$OLLAMA2_PORT" "Ollama 2 (Career)"; then
    OLLAMA2_OK=true
else
    OLLAMA2_OK=false
fi

# Summary
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  📊 Setup Summary${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

if [ "$OLLAMA1_OK" = true ]; then
    echo -e "  Ollama 1 (PA):     ${GREEN}✅ Ready${NC} (http://localhost:$OLLAMA1_PORT)"
else
    echo -e "  Ollama 1 (PA):     ${RED}❌ Failed${NC}"
fi

if [ "$OLLAMA2_OK" = true ]; then
    echo -e "  Ollama 2 (Career): ${GREEN}✅ Ready${NC} (http://localhost:$OLLAMA2_PORT)"
else
    echo -e "  Ollama 2 (Career): ${RED}❌ Failed${NC}"
fi

echo ""
echo -e "${BLUE}🧪 Test your Ollama instances:${NC}"
echo -e "  ${YELLOW}curl http://localhost:$OLLAMA1_PORT/api/tags${NC}"
echo -e "  ${YELLOW}curl http://localhost:$OLLAMA2_PORT/api/tags${NC}"
echo ""

if [ "$OLLAMA1_OK" = true ] && [ "$OLLAMA2_OK" = true ]; then
    echo -e "${GREEN}✅ All Ollama instances ready for development!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some Ollama instances had issues. Check logs above.${NC}"
    exit 1
fi
