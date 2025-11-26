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
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip)

echo "🌐 Staging IP: $EXTERNAL_IP"

echo "👨🏽‍💻 Pulling latest..."

git pull origin containerization

echo "🏗️ Building... Starting services...."
docker-compose --env-file .env.staging -f docker-compose.staging.yml down
docker-compose --env-file .env.staging -f docker-compose.staging.yml build --no-cache
docker-compose --env-file .env.staging -f docker-compose.staging.yml up -d

echo "Waiting on services..."
sleep 45

echo "🤖 Setting up Ollama models..."
./setup-ollama-updated.sh

echo "🗄️  Running database migrations..."
# Run migrations inside the backend container
if docker exec idii-backend-staging python backend/migrations/apply_migration.py; then
    echo "✅ Database migrations completed successfully"
else
    echo "⚠️  Database migration had issues (may already be applied)"
    # Don't fail deployment if migration already exists
fi

echo "🧪 Testing GPU acceleration..."
echo "GPU in Ollama 1 (PA):"
docker exec idii-ollama-staging nvidia-smi
echo ""
echo "GPU in Ollama 2 (Career):"
docker exec idii-ollama2-staging nvidia-smi

echo "✅ Deployment Complete!"
echo "🎭 Staging URLs:"
echo "   Frontend: http://staging.idii.co:3000"
echo "   Backend: http://staging.idii.co:8000/docs"
echo "   Personal Assistant: http://staging.idii.co:8001/docs"
echo "   Career Agent: http://staging.idii.co:8002/docs"
echo "   Ollama 1 (PA GPU): http://staging.idii.co:11434/api/tags"
echo "   Ollama 2 (Career GPU): http://staging.idii.co:11435/api/tags"
echo ""
echo "⚡ GPU Status:"
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader
echo "🌍 Application should be available at: https://staging.idii.co"