#!/bin/bash

echo "🤖 Setting up Ollama models for both instances..."

# Configuration
COMPOSE_FILE="docker-compose.staging.yml"

# Ollama 1 - Personal Assistant
CONTAINER_1="idii-ollama-staging"
SERVICE_1="ollama-staging"

# Ollama 2 - Career Agent
CONTAINER_2="idii-ollama2-staging"
SERVICE_2="ollama2-staging"

# Function to check if Ollama is ready
wait_for_ollama() {
    local service_name=$1
    local container_name=$2
    local max_attempts=30
    local attempt=1

    echo "⏳ Waiting for $service_name service to start..."

    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$COMPOSE_FILE" exec -T "$service_name" ollama list > /dev/null 2>&1; then
            echo "✅ $service_name service is ready"
            return 0
        fi

        echo "⏳ Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done

    echo "❌ $service_name service failed to start after $max_attempts attempts"
    echo "🔍 Checking container logs..."
    docker logs "$container_name" --tail 50
    return 1
}

# Function to setup models for an Ollama instance
setup_ollama_instance() {
    local service_name=$1
    local container_name=$2
    local instance_label=$3

    echo ""
    echo "========================================="
    echo "Setting up $instance_label"
    echo "========================================="

    # Wait for Ollama to be ready
    if ! wait_for_ollama "$service_name" "$container_name"; then
        echo "❌ Failed to setup $instance_label"
        return 1
    fi

    # Verify GPU is accessible inside container
    echo "🔍 Verifying GPU access in $container_name..."
    if docker exec "$container_name" nvidia-smi > /dev/null 2>&1; then
        echo "✅ GPU accessible in $container_name"
        docker exec "$container_name" nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
    else
        echo "⚠️ GPU not accessible in $container_name, falling back to CPU"
    fi

    # Pull models
    echo "📥 Pulling models for $instance_label..."

    # Models to install
    MODELS=(
        "gemma3:latest"      # Default model
        # "codellama:7b"     # Uncomment if needed
    )

    for model in "${MODELS[@]}"; do
        echo "📥 Pulling model: $model to $instance_label"
        if docker-compose -f "$COMPOSE_FILE" exec -T "$service_name" ollama pull "$model"; then
            echo "✅ Successfully pulled $model"

            # Test model
            echo "🧪 Testing $model on $instance_label..."
            if docker exec "$container_name" ollama run "$model" "Say hi" > /dev/null 2>&1; then
                echo "✅ Model test passed"
            else
                echo "⚠️ Model test failed (might be normal for first run)"
            fi
        else
            echo "❌ Failed to pull $model"
        fi
    done

    # Show GPU memory usage after model loading
    if docker exec "$container_name" nvidia-smi > /dev/null 2>&1; then
        echo "📊 GPU memory usage for $instance_label:"
        docker exec "$container_name" nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader
    fi

    # List installed models
    echo "📋 Installed models on $instance_label:"
    docker-compose -f "$COMPOSE_FILE" exec -T "$service_name" ollama list

    echo "✅ $instance_label setup complete!"
}

# Setup both Ollama instances
echo "🚀 Starting Ollama setup for both instances..."

# Setup Ollama 1 (Personal Assistant)
setup_ollama_instance "$SERVICE_1" "$CONTAINER_1" "Ollama 1 (Personal Assistant - Port 11434)"

# Setup Ollama 2 (Career Agent)
setup_ollama_instance "$SERVICE_2" "$CONTAINER_2" "Ollama 2 (Career Agent - Port 11435)"

echo ""
echo "========================================="
echo "✅ All Ollama instances setup complete!"
echo "========================================="
echo ""
echo "📊 Summary:"
echo "  Ollama 1 (PA):     http://localhost:11434"
echo "  Ollama 2 (Career): http://localhost:11435"
echo ""
echo "🧪 Test connections:"
echo "  curl http://localhost:11434/api/tags"
echo "  curl http://localhost:11435/api/tags"
