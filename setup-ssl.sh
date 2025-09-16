#!/bin/bash

# Install Certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Get SSL certificate
certbot certonly --standalone -d idii.co -d www.idii.co

# Copy certificates to nginx directory
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/idii.co/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/idii.co/privkey.pem nginx/ssl/

# Start nginx with SSL
docker-compose -f docker-compose.prod.yml start nginx

# Setup auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -