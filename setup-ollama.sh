#!/bin/bash

echo "🤖 Setting up Ollama models..."

# Wait for Ollama service to be ready
echo "⏳ Waiting for Ollama service to start..."
sleep 30

# Function to check if Ollama is ready
wait_for_ollama() {
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.prod.yml exec -T ollama ollama list > /dev/null 2>&1; then
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

# Pull default models
echo "📥 Pulling Ollama models..."

# Basic models (choose based on your needs and VM resources)
MODELS=(
    "gemma3:latest"      # Default model as specified
    "gemma3:7b"         # Specific version of Gemma3
    "codellama:7b"       # Code generation
    # "llama2:7b"        # Alternative general purpose
    # "mistral:7b"       # Alternative general model
    # "llama2:13b"       # Larger model (requires more RAM)
)

for model in "${MODELS[@]}"; do
    echo "📥 Pulling model: $model"
    docker-compose -f docker-compose.prod.yml exec -T ollama ollama pull "$model"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully pulled $model"
    else
        echo "❌ Failed to pull $model"
    fi
done

# List installed models
echo "📋 Installed models:"
docker-compose -f docker-compose.prod.yml exec -T ollama ollama list

echo "✅ Ollama setup complete!"