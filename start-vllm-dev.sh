#!/bin/bash
# ============================================
# vLLM OpenAI-Compatible Server Launcher
# ============================================
# This script starts vLLM server with configuration from .env.dev
#
# Usage:
#   ./start-vllm-dev.sh
#
# Requirements:
#   - NVIDIA GPU with CUDA support
#   - vLLM installed in python3.12 environment
#   - Model access (will auto-download from HuggingFace if needed)
#
# Configuration:
#   All settings are loaded from .env.dev
#   Edit .env.dev to change model, GPU memory, etc.
# ============================================

# NOTE: We do NOT use 'set -e' here because this script needs to tolerate
# temporary failures from health checks (grep, curl, lsof, etc.) while waiting
# for the server to start up.

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 vLLM OpenAI-Compatible Server Launcher${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Load environment variables from .env.dev
if [ -f .env.dev ]; then
    echo -e "${GREEN}📂 Loading configuration from .env.dev${NC}"
    # Load VLLM configuration
    export $(grep -v '^#' .env.dev | grep VLLM | xargs)
    # Load HuggingFace token (required for gated models)
    export $(grep -v '^#' .env.dev | grep HF_TOKEN | xargs)

    # Check if HF_TOKEN is set for gated models
    if [ -n "$HF_TOKEN" ] && [ "$HF_TOKEN" != "your_hf_token_here" ]; then
        echo -e "${GREEN}✓ HuggingFace token detected (for gated models)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.dev not found, using default configuration${NC}"
fi

# Set HuggingFace cache directory to /home/idii/data/vllm-cache
export HF_HOME="/home/idii/data/vllm-cache"
mkdir -p "$HF_HOME"
echo -e "${GREEN}📁 HuggingFace cache directory: $HF_HOME${NC}"

# Read configuration (with defaults)
MODEL=${VLLM_MODEL:-"Qwen/Qwen2.5-3B-Instruct"}
HOST=${VLLM_HOST:-"0.0.0.0"}
PORT=${VLLM_PORT:-"8888"}
GPU_MEM=${VLLM_GPU_MEMORY_UTILIZATION:-"0.7"}
MAX_LEN=${VLLM_MAX_MODEL_LEN:-"4096"}
DTYPE=${VLLM_DTYPE:-"float16"}
TRUST_REMOTE_CODE=${VLLM_TRUST_REMOTE_CODE:-"true"}
TENSOR_PARALLEL=${VLLM_TENSOR_PARALLEL_SIZE:-"1"}
QUANTIZATION=${VLLM_QUANTIZATION:-""}
LOG_FILE=${VLLM_LOG_FILE:-"vllm_server.log"}

# Display configuration
echo -e "${GREEN}📋 Configuration:${NC}"
echo "  Model:                    $MODEL"
echo "  Host:                     $HOST:$PORT"
echo "  GPU Memory Utilization:   ${GPU_MEM}"
echo "  Max Model Length:         ${MAX_LEN} tokens"
echo "  Data Type:                $DTYPE"
echo "  Tensor Parallel Size:     $TENSOR_PARALLEL"
echo "  Tool Calling:             ${ENABLE_TOOL_CHOICE:-true} (parser: ${TOOL_CALL_PARSER:-hermes})"
[ -n "$QUANTIZATION" ] && echo "  Quantization:             $QUANTIZATION"
echo ""

# Check if vLLM is installed
if ! /root/miniconda3/envs/python3.12/bin/python -c "import vllm" 2>/dev/null; then
    echo -e "${RED}❌ Error: vLLM is not installed in python3.12 environment${NC}"
    echo -e "${YELLOW}Please install vLLM:${NC}"
    echo "  /root/miniconda3/envs/python3.12/bin/pip install vllm==0.11.0"
    exit 1
fi

# Check GPU availability
if ! nvidia-smi &>/dev/null; then
    echo -e "${RED}❌ Error: NVIDIA GPU not detected!${NC}"
    echo -e "${YELLOW}vLLM requires NVIDIA GPU with CUDA support${NC}"
    exit 1
fi

# Display GPU information
echo -e "${GREEN}✅ GPU Information:${NC}"
nvidia-smi --query-gpu=name,memory.total,memory.free,driver_version --format=csv,noheader | \
    awk '{print "  " $0}'
echo ""

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port $PORT is already in use!${NC}"
    echo -e "${YELLOW}Please stop the existing service or change VLLM_PORT in .env.dev${NC}"
    echo ""
    echo "To stop existing vLLM server, run:"
    echo "  ./stop-vllm-dev.sh"
    exit 1
fi

echo -e "${GREEN}🚀 Starting vLLM server...${NC}"
echo -e "${BLUE}This may take a few minutes on first run (model download)${NC}"
echo ""

# Read max_num_batched_tokens from env (optional)
MAX_NUM_BATCHED_TOKENS=${VLLM_MAX_NUM_BATCHED_TOKENS:-""}

# Tool calling configuration
ENABLE_TOOL_CHOICE=${VLLM_ENABLE_TOOL_CHOICE:-"true"}
TOOL_CALL_PARSER=${VLLM_TOOL_CALL_PARSER:-"hermes"}

# Build startup command
CMD="/root/miniconda3/envs/python3.12/bin/python -m vllm.entrypoints.openai.api_server \
  --model \"$MODEL\" \
  --host \"$HOST\" \
  --port \"$PORT\" \
  --gpu-memory-utilization \"$GPU_MEM\" \
  --max-model-len \"$MAX_LEN\" \
  --dtype \"$DTYPE\" \
  --tensor-parallel-size \"$TENSOR_PARALLEL\""

# Add optional parameters
if [ "$TRUST_REMOTE_CODE" = "true" ]; then
    CMD="$CMD --trust-remote-code"
fi

if [ -n "$QUANTIZATION" ]; then
    CMD="$CMD --quantization \"$QUANTIZATION\""
fi

if [ -n "$MAX_NUM_BATCHED_TOKENS" ]; then
    CMD="$CMD --max-num-batched-tokens \"$MAX_NUM_BATCHED_TOKENS\""
fi

# Add tool calling support (required for LangGraph agents)
if [ "$ENABLE_TOOL_CHOICE" = "true" ]; then
    CMD="$CMD --enable-auto-tool-choice --tool-call-parser \"$TOOL_CALL_PARSER\""
    echo -e "${GREEN}✓ Tool calling enabled (parser: $TOOL_CALL_PARSER)${NC}"
fi

# Log command for debugging
echo -e "${BLUE}Command:${NC}"
echo "$CMD"
echo ""

# Execute startup command in background with logging
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Set HuggingFace token environment variable for vLLM process
# HuggingFace Hub library will automatically read HF_TOKEN from environment
# (already exported from .env.dev in line 40)
if [ -n "$HF_TOKEN" ] && [ "$HF_TOKEN" != "your_hf_token_here" ]; then
    echo -e "${GREEN}✓ HuggingFace authentication configured (HF_TOKEN set)${NC}"
    echo -e "${BLUE}  Token will be used automatically by huggingface_hub library${NC}"
fi

eval "$CMD > $LOG_FILE 2>&1 &"

# Wait for server to start with proper health check
echo ""
echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
echo -e "${YELLOW}Logs are being written to: $LOG_FILE${NC}"
echo -e "${BLUE}Note: First startup may take 5-20 minutes if model needs to be downloaded${NC}"
echo -e "${BLUE}      Subsequent starts take only 30-40 seconds (model cached locally)${NC}"
echo ""

# Function to check download progress
check_download_progress() {
    # Check for download-related messages in log
    if grep -q "Downloading" "$LOG_FILE" 2>/dev/null; then
        # Extract download progress if available
        DOWNLOAD_LINE=$(tail -20 "$LOG_FILE" | grep -E "Downloading|download" | tail -1)
        if [ -n "$DOWNLOAD_LINE" ]; then
            echo -e "${BLUE}  📥 $DOWNLOAD_LINE${NC}"
            return 0
        fi
    fi

    # Check for model loading messages
    if grep -q "Loading model" "$LOG_FILE" 2>/dev/null; then
        echo -e "${BLUE}  🔄 Loading model into GPU memory...${NC}"
        return 0
    fi

    return 1
}

# Poll for server readiness (up to 20 minutes for first download, 2 minutes for cached model)
MAX_ATTEMPTS=1200  # 20 minutes (1200 seconds)
ATTEMPT=1
SERVER_READY=false
LAST_PROGRESS=""
STARTUP_COMPLETE_FOUND=false

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    # First check if "Application startup complete" appears in log
    if ! $STARTUP_COMPLETE_FOUND && grep -q "Application startup complete" "$LOG_FILE" 2>/dev/null; then
        STARTUP_COMPLETE_FOUND=true
        echo -e "${BLUE}  ✅ Detected 'Application startup complete' in logs${NC}"
        echo -e "${BLUE}  🔍 Verifying API availability...${NC}"
    fi

    # Check if process is listening on port
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        # Port is open, now check if API is responding
        # Give it a few retries in case the API just started accepting connections
        for retry in 1 2 3; do
            if curl -s -f "http://localhost:$PORT/v1/models" >/dev/null 2>&1; then
                SERVER_READY=true
                break 2  # Break out of both loops
            fi
            [ $retry -lt 3 ] && sleep 1
        done
    fi

    # Show progress every 10 seconds
    if [ $((ATTEMPT % 10)) -eq 0 ]; then
        # Check for download progress
        PROGRESS_MSG=$(check_download_progress 2>&1)

        if [ -n "$PROGRESS_MSG" ] && [ "$PROGRESS_MSG" != "$LAST_PROGRESS" ]; then
            # Show download progress
            echo "$PROGRESS_MSG"
            LAST_PROGRESS="$PROGRESS_MSG"
        else
            # Show elapsed time
            MINUTES=$((ATTEMPT / 60))
            SECONDS=$((ATTEMPT % 60))
            if [ $MINUTES -gt 0 ]; then
                echo -e "${YELLOW}  Still initializing... (${MINUTES}m ${SECONDS}s elapsed)${NC}"
            else
                echo -e "${YELLOW}  Still initializing... (${SECONDS}s elapsed)${NC}"
            fi

            # Show helpful hints at specific intervals
            if [ $ATTEMPT -eq 60 ]; then
                echo -e "${BLUE}  💡 Model download may be in progress, check logs: tail -f $LOG_FILE${NC}"
            elif [ $ATTEMPT -eq 300 ]; then
                echo -e "${BLUE}  💡 Large models (4B+) can take 10-20 minutes to download${NC}"
            elif [ $ATTEMPT -eq 600 ]; then
                echo -e "${BLUE}  💡 Still working... This is normal for first-time setup${NC}"
            fi
        fi
    fi

    # Early timeout for cached models (if no download detected after 2 minutes, likely an error)
    if [ $ATTEMPT -eq 120 ]; then
        if ! grep -q "Downloading\|download" "$LOG_FILE" 2>/dev/null; then
            if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
                # No download activity and port not open = likely an error
                echo ""
                echo -e "${YELLOW}⚠️  Server hasn't started after 2 minutes and no download detected${NC}"
                echo -e "${YELLOW}   This may indicate an error. Recent logs:${NC}"
                echo ""
                tail -10 "$LOG_FILE" | sed 's/^/   /'
                echo ""
                echo -e "${YELLOW}   Continuing to wait, but you may want to check the full logs...${NC}"
            fi
        fi
    fi

    sleep 1
    ATTEMPT=$((ATTEMPT + 1))
done

# Check if server is running and ready
if [ "$SERVER_READY" = true ]; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ vLLM Server started successfully!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${GREEN}📊 Server Information:${NC}"
    echo "  API Base URL:         http://localhost:$PORT/v1"
    echo "  API Documentation:    http://localhost:$PORT/docs"
    echo "  Health Check:         http://localhost:$PORT/health"
    echo "  Model:                $MODEL"
    echo ""
    echo -e "${GREEN}🔧 To test the server:${NC}"
    echo "  curl http://localhost:$PORT/v1/models"
    echo ""
    echo -e "${GREEN}🛑 To stop the server:${NC}"
    echo "  ./stop-vllm-dev.sh"
    echo ""
    echo -e "${GREEN}📝 Logs:${NC}"
    echo "  Server is running in background"
    echo "  Log file: $LOG_FILE"
    echo "  Check logs with: tail -f $LOG_FILE"
    echo ""
    echo -e "${GREEN}💡 Model Information:${NC}"
    echo "  Model: $MODEL uses ~7-8GB VRAM"
    echo "  Context length: ${MAX_LEN} tokens"
    echo "  GPU memory utilization: ${GPU_MEM} (70%)"
    echo ""
else
    echo ""
    ELAPSED_MINUTES=$((MAX_ATTEMPTS / 60))
    echo -e "${RED}❌ Failed to start vLLM server after ${ELAPSED_MINUTES} minutes${NC}"
    echo ""
    echo -e "${YELLOW}📋 Last 20 lines of log:${NC}"
    tail -20 "$LOG_FILE" | sed 's/^/   /'
    echo ""
    echo -e "${YELLOW}🔍 Common issues:${NC}"
    echo "  1. Model download still in progress - Check: tail -f $LOG_FILE"
    echo "  2. Insufficient GPU memory - Check: nvidia-smi"
    echo "  3. Network issues downloading model - Try: HF_ENDPOINT=https://hf-mirror.com"
    echo "  4. CUDA/driver compatibility issues"
    echo "  5. Model not found on HuggingFace - Verify model name"
    echo ""
    echo -e "${BLUE}💡 Tips:${NC}"
    echo "  - For large models, download can take 10-20 minutes"
    echo "  - Check full logs: tail -f $LOG_FILE"
    echo "  - Monitor GPU: watch -n 1 nvidia-smi"
    echo "  - Try manual download: huggingface-cli download $MODEL"
    exit 1
fi
