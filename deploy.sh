#!/bin/bash

set -e 

echo "🚀 Deloying Sadaora Platform..."

source .env.prod

echo "👨🏽‍💻 Pulling latest..."

git pull orgin main

echo "🏗️ Building... Starting services...."
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

echo "Waiting on services..."
sleep 30

echo "🤖 Setting up Ollama models..."
./setup-ollama.sh

echo "✅ Deployment Complete!"
echo "🌍 Application should be available at: https://sadaora.com"