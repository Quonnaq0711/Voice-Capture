#!/bin/bash

# Exit on error, fail on undefined variables, fail on pipe errors
set -euo pipefail

echo "🚀 Deploying Idii Staging Platform..."

# Safely source environment file (set -a exports all variables)
if [[ -f .env.staging ]]; then
    set -a
    source .env.staging
    set +a
else
    echo "❌ .env.staging not found"
    exit 1
fi

# Verify GPU is available
echo "🔍 Checking GPU availability..."
if ! nvidia-smi > /dev/null 2>&1; then
    echo "❌ NVIDIA GPU not detected. Please check GPU setup."
    exit 1
fi

echo "✅ GPU detected:"
nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

# Get external IP
EXTERNAL_IP=$(curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip 2>/dev/null || echo "unknown")

echo "🌐 Staging IP: $EXTERNAL_IP"

# Determine LLM provider
LLM_PROVIDER="${LLM_PROVIDER:-ollama}"
echo "🤖 LLM Provider: $LLM_PROVIDER"

echo "👨🏽‍💻 Pulling latest..."
git pull origin containerization

# Stop existing containers (including old Ollama to free GPU memory)
echo "🛑 Stopping existing containers..."
docker-compose --env-file .env.staging -f docker-compose.staging.yml down --remove-orphans 2>/dev/null || true

# Also stop any standalone Ollama containers that might be using GPU
docker stop idii-ollama-staging idii-ollama2-staging 2>/dev/null || true
docker rm idii-ollama-staging idii-ollama2-staging 2>/dev/null || true

# Free GPU memory
echo "🧹 Clearing GPU memory..."
sleep 5

echo "🏗️ Building and starting services..."
docker-compose --env-file .env.staging -f docker-compose.staging.yml build --no-cache
docker-compose --env-file .env.staging -f docker-compose.staging.yml up -d

# Wait for services based on LLM provider
if [[ "$LLM_PROVIDER" == "vllm" ]]; then
    echo "⏳ Waiting for vLLM server to load model (this may take 2-5 minutes)..."

    # Wait for vLLM container to be running
    MAX_WAIT=300  # 5 minutes max
    ELAPSED=0
    while [[ $ELAPSED -lt $MAX_WAIT ]]; do
        if docker ps | grep -q "idii-vllm-staging"; then
            echo "   Container started, waiting for model to load..."
            break
        fi
        sleep 5
        ELAPSED=$((ELAPSED + 5))
        echo "   Waiting for container... ($ELAPSED s)"
    done

    # Wait for health check
    echo "   Checking vLLM health endpoint..."
    ELAPSED=0
    while [[ $ELAPSED -lt $MAX_WAIT ]]; do
        if curl -s http://localhost:8888/health 2>/dev/null | grep -q "ok\|healthy"; then
            echo "✅ vLLM server is ready!"
            break
        fi
        sleep 10
        ELAPSED=$((ELAPSED + 10))
        echo "   Model loading... ($ELAPSED s)"
    done

    if [[ $ELAPSED -ge $MAX_WAIT ]]; then
        echo "⚠️  vLLM may still be loading. Check logs with: docker logs idii-vllm-staging"
    fi

    echo "🔍 vLLM Server Status:"
    curl -s http://localhost:8888/v1/models 2>/dev/null | head -20 || echo "   (API not ready yet)"

else
    echo "⏳ Waiting for Ollama services..."
    sleep 45

    echo "🤖 Setting up Ollama models..."
    ./setup-ollama-updated.sh
fi

echo "🗄️  Running database migrations..."
# Run migrations inside the backend container
if docker exec idii-backend-staging python backend/migrations/apply_migration.py 2>/dev/null; then
    echo "✅ Database migrations completed successfully"
else
    echo "⚠️  Database migration had issues (may already be applied)"
    # Don't fail deployment if migration already exists
fi

echo "🧪 Checking GPU allocation..."
echo "GPU Status:"
nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total --format=csv,noheader

echo ""
echo "✅ Deployment Complete!"
echo ""
echo "🎭 Staging URLs:"
echo "   Frontend:           https://staging.idii.co"
echo "   Backend API:        https://staging.idii.co/api/docs"
echo "   Personal Assistant: https://staging.idii.co/pa-api/docs"
echo "   Career Agent:       http://staging.idii.co:8002/docs"

if [[ "$LLM_PROVIDER" == "vllm" ]]; then
    echo "   vLLM Server:        http://staging.idii.co:8888/v1/models"
    echo ""
    echo "📊 vLLM Configuration:"
    echo "   Model: ${VLLM_MODEL:-google/gemma-3-4b-it}"
    echo "   GPU Memory: ${VLLM_GPU_MEMORY_UTILIZATION:-0.85} utilization"
    echo "   Max Context: ${VLLM_MAX_MODEL_LEN:-8192} tokens"
else
    echo "   Ollama 1 (PA):      http://staging.idii.co:11434/api/tags"
    echo "   Ollama 2 (Career):  http://staging.idii.co:11435/api/tags"
fi

echo ""
echo "⚡ GPU Status:"
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader
echo ""
echo "🌍 Application available at: https://staging.idii.co"
