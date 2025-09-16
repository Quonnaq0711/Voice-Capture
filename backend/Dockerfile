FROM python:3.11-slim

WORKDIR /workspace

# Install system dependencies for PostgreSQL
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --no-cache-dir --upgrade pip

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app /workspace/app

# PYTHONPATH to the workspace
ENV PYTHONPATH=/workspace:${PYTHONPATH:-}

# Change ownership
RUN chown -R appuser:appuser /workspace

# Switch to non-root user
USER appuser

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]