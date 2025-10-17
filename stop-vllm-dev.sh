#!/bin/bash
# ============================================
# vLLM Server Shutdown Script
# ============================================
# This script stops the running vLLM server
#
# Usage:
#   ./stop-vllm-dev.sh
# ============================================

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🛑 vLLM Server Shutdown${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Find vLLM processes
VLLM_PIDS=$(pgrep -f "vllm.entrypoints.openai.api_server")

if [ -z "$VLLM_PIDS" ]; then
    echo -e "${YELLOW}ℹ️  No vLLM server processes found${NC}"
    echo -e "${GREEN}Server is not running${NC}"
    exit 0
fi

# Display found processes
echo -e "${YELLOW}Found vLLM processes:${NC}"
ps aux | grep "vllm.entrypoints.openai.api_server" | grep -v grep | \
    awk '{print "  PID: " $2 "  CPU: " $3 "%  MEM: " $4 "%"}'
echo ""

# Confirm shutdown
echo -e "${YELLOW}Stopping vLLM server(s)...${NC}"

# Send SIGTERM for graceful shutdown
for PID in $VLLM_PIDS; do
    echo "  Stopping process $PID..."
    kill -TERM $PID 2>/dev/null
done

# Wait for graceful shutdown
sleep 2

# Check if processes are still running
REMAINING_PIDS=$(pgrep -f "vllm.entrypoints.openai.api_server")

if [ -n "$REMAINING_PIDS" ]; then
    echo -e "${YELLOW}⚠️  Processes still running, forcing shutdown...${NC}"

    # Send SIGKILL for forced shutdown
    for PID in $REMAINING_PIDS; do
        echo "  Force stopping process $PID..."
        kill -9 $PID 2>/dev/null
    done

    sleep 1
fi

# Final check
FINAL_CHECK=$(pgrep -f "vllm.entrypoints.openai.api_server")

if [ -z "$FINAL_CHECK" ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ vLLM server stopped successfully${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo ""
    echo -e "${YELLOW}⚠️  Some processes may still be running${NC}"
    echo -e "${YELLOW}Please check manually with: ps aux | grep vllm${NC}"
fi

echo ""
