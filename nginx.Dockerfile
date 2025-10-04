FROM nginx:alpine

# Copy certificates
COPY nginx/ssl/origin.crt /etc/nginx/ssl/origin.crt
COPY nginx/ssl/origin.key /etc/nginx/ssl/origin.key

# Set permissions
RUN chmod 644 /etc/nginx/ssl/origin.crt && \
    chmod 600 /etc/nginx/ssl/origin.key
