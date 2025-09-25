#!/bin/bash

# Update system
apt-get update
apt-get upgrade -y

# Docker Install
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Install Git
apt-get install -y git

# Install Nginx (for reverse proxy)
apt-get install -y nginx

# Create application directory
mkdir -p /opt/idii-platform
mkdir -p /opt/idii-platform/data/ollama
cd /opt/idii-platform

# Clone your repository (replace with your actual repo)
git clone https://github.com/sadaora/Product.git .

# Create necessary directories
mkdir -p logs
mkdir -p data/postgres
mkdir -p data/ollama


# Set permissions
chown -R ubuntu:ubuntu /opt/idii-platform