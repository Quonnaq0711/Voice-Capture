#!/bin/bash

# Install Certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Get SSL certificate
certbot certonly --standalone -d sadora.com -d www.sadora.com

# Copy certificates to nginx directory
mkdir -p nginx/ssl
cp /etc/letsencrypt/live/sadaora.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/sadaora.com/privkey.pem nginx/ssl/

# Start nginx with SSL
docker-compose -f docker-compose.prod.yml start nginx

# Setup auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -