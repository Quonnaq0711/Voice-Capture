#!/bin/bash

echo "🤖 Setting up Ollama models..."

run ollama pull gemma3@lastest

# Wait for Ollama service to be ready
echo "⏳ Waiting for Ollama service to start..."
sleep 30

# Function to check if Ollama is ready
wait_for_ollama() {
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.staging.yml exec -T idii-ollama-staging ollama list > /dev/null 2>&1; then
            echo "✅ Ollama service is ready"
            return 0
        fi
        
        echo "⏳ Attempt $attempt/$max_attempts - Ollama not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo "❌ Ollama service failed to start after $max_attempts attempts"
    return 1
}

# Wait for Ollama to be ready
if ! wait_for_ollama; then
    exit 1
fi

# Verify GPU is accessible inside container
echo "🔍 Verifying GPU access in Ollama container..."
if docker exec sadaora-ollama-staging nvidia-smi > /dev/null 2>&1; then
    echo "✅ GPU accessible in Ollama container"
else
    echo "⚠️ GPU not accessible in container, falling back to CPU"
fi

# Pull default models
echo "📥 Pulling Ollama models..."

# Basic models (choose based on your needs and VM resources)
MODELS=(
    "gemma3:latest"      # Default model as specified
    #"gemma3:7b"         # Specific version of Gemma3
    #"codellama:7b"       # Code generation
    # "llama2:7b"        # Alternative general purpose
    # "mistral:7b"       # Alternative general model
    # "llama2:13b"       # Larger model (requires more RAM)
)

for model in "${MODELS[@]}"; do
    echo "📥 Pulling model: $model"
    docker-compose -f docker-compose.staging.yml exec -T idii.ollama.staging ollama pull "$model"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully pulled $model"
        # Test model with GPU
        echo "🧪 Testing $model with GPU acceleration..."
        docker exec sadaora-ollama-staging ollama run "$model" "Hello" --verbose || echo "⚠️ Model test failed"
    else
        echo "❌ Failed to pull $model"
    fi
done

# Show GPU memory usage after model loading
echo "📊 GPU memory usage after model loading:"
docker exec idii-ollama-staging nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader

# List installed models
echo "📋 Installed models:"
docker-compose -f docker-compose.staging.yml exec -T idii.ollama.staging ollama list

echo "✅ Ollama setup complete!"