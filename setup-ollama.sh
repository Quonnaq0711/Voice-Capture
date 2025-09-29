#!/bin/bash

echo "🤖 Setting up Ollama models..."

# Configuration - adjust container name to match your docker-compose
CONTAINER_NAME="idii-ollama-staging"
COMPOSE_FILE="docker-compose.staging.yml"
SERVICE_NAME="ollama-staging"

# Function to check if Ollama is ready
wait_for_ollama() {
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for Ollama service to start..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" ollama list > /dev/null 2>&1; then
            echo "✅ Ollama service is ready"
            return 0
        fi
        
        echo "⏳ Attempt $attempt/$max_attempts - Ollama not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo "❌ Ollama service failed to start after $max_attempts attempts"
    echo "🔍 Checking container logs..."
    docker logs "$CONTAINER_NAME" --tail 50
    return 1
}

# Wait for Ollama to be ready
if ! wait_for_ollama; then
    exit 1
fi

# Verify GPU is accessible inside container
echo "🔍 Verifying GPU access in Ollama container..."
if docker exec "$CONTAINER_NAME" nvidia-smi > /dev/null 2>&1; then
    echo "✅ GPU accessible in Ollama container"
    docker exec "$CONTAINER_NAME" nvidia-smi
else
    echo "⚠️ GPU not accessible in container, falling back to CPU"
fi

# Pull default models
echo "📥 Pulling Ollama models..."

# Basic models (choose based on your needs and VM resources)
MODELS=(
    "gemma3:latest"      # Default model (note: gemma3 may not exist, using gemma2)
    "gemma3:7b"          # Specific version of Gemma2
    "codellama:7b"       # Code generation
    # "llama2:7b"        # Alternative general purpose
    # "mistral:7b"       # Alternative general model
    # "llama3.2:3b"      # Smaller, faster model
)

for model in "${MODELS[@]}"; do
    echo "📥 Pulling model: $model"
    if docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" ollama pull "$model"; then
        echo "✅ Successfully pulled $model"
        
        # Test model
        echo "🧪 Testing $model..."
        docker exec "$CONTAINER_NAME" ollama run "$model" "Say hi" || echo "⚠️ Model test failed"
    else
        echo "❌ Failed to pull $model"
    fi
done

# Show GPU memory usage after model loading
if docker exec "$CONTAINER_NAME" nvidia-smi > /dev/null 2>&1; then
    echo "📊 GPU memory usage after model loading:"
    docker exec "$CONTAINER_NAME" nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader
fi

# List installed models
echo "📋 Installed models:"
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE_NAME" ollama list

echo "✅ Ollama setup complete!"