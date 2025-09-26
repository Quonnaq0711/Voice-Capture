#!/bin/bash

set -e 

echo "🚀 Deloying Idii Staging Platform..."

source .env.staging

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

git pull origin main

echo "🏗️ Building... Starting services...."
docker-compose --env-file .env.staging -f docker-compose.staging.yml down
docker-compose --env-file .env.staging -f docker-compose.staging.yml build --no-cache
docker-compose --env-file .env.staging -f docker-compose.staging.yml up -d

echo "Waiting on services..."
sleep 45

echo "🤖 Setting up Ollama models..."
./setup-ollama.sh

echo "🧪 Testing GPU acceleration..."
docker exec idii-ollama-staging nvidia-smi

echo "✅ Deployment Complete!"
echo "🎭 Staging URLs:"
echo "   Frontend: http://$EXTERNAL_IP:3000"
echo "   Backend: http://$EXTERNAL_IP:8000/docs"
echo "   Personal Assistant: http://$EXTERNAL_IP:8001/docs"
echo "   Ollama (GPU): http://$EXTERNAL_IP:11434/api/tags"
echo ""
echo "⚡ GPU Status:"
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader
echo "🌍 Application should be available at: https://Idii.co"