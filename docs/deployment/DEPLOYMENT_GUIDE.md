# Deployment Guide - Staging Environment

This guide provides complete instructions for deploying the IDII platform to the staging environment using Docker containers.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quick Start](#quick-start)
4. [Detailed Deployment Steps](#detailed-deployment-steps)
5. [Service Verification](#service-verification)
6. [Data Persistence](#data-persistence)
7. [Common Operations](#common-operations)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### Service Stack

| Service | Container Name | Internal Port | External Port | Purpose |
|---------|---------------|---------------|---------------|---------|
| Backend | idii-backend-staging | 8000 | 8000 | Main FastAPI backend |
| Personal Assistant | idii-PA-staging | 8001 | 8001 | PA chat API |
| Career Agent | idii-career-agent-staging | 8002 | 8002 | Career-specific AI agent |
| Frontend | idii-frontend-staging | 80 | - | React application |
| Database | idii-db-staging | 5432 | 5432 | PostgreSQL database |
| Ollama (PA) | idii-ollama-staging | 11434 | 11434 | LLM for Personal Assistant |
| Ollama (Career) | idii-ollama2-staging | 11434 | 11435 | LLM for Career Agent |
| Nginx | idii-nginx-staging | 80, 443 | 80, 443 | Reverse proxy & SSL |

### Network Architecture

- **Network Name**: `idii-staging`
- **DNS Aliases**:
  - `ollama-staging` → idii-ollama-staging (port 11434)
  - `ollama2-staging` → idii-ollama2-staging (port 11434)
  - `db-staging` → idii-db-staging (port 5432)

**Important**: All inter-container communication uses internal ports and DNS aliases, not external ports.

### Data Volumes

All persistent data is stored under `/home/idii/data/` for centralized management:

| Host Path | Container Mount | Purpose |
|-----------|----------------|---------|
| `/home/idii/data/postgres-staging/` | `/var/lib/postgresql/data` | PostgreSQL database files |
| `/home/idii/data/user-uploads/resumes/` | `/app/resumes` | User resume uploads (organized by user_id) |
| `/home/idii/data/user-uploads/avatars/` | `/app/avatars` | User avatar images (organized by user_id) |
| `/home/idii/data/database/` | `/app/db-backup` | SQLite backup (migration reference, read-only) |
| `Projects/Product/data/ollama-staging/` | `/root/.ollama` | Ollama PA models and cache |
| `Projects/Product/data/ollama2-staging/` | `/root/.ollama` | Ollama Career models and cache |

---

## Prerequisites

### System Requirements

1. **Operating System**: Linux (Ubuntu 20.04+ recommended)
2. **GPU**: NVIDIA GPU with CUDA support
3. **GPU Drivers**: NVIDIA drivers 525+ installed
4. **Docker**: Version 24.0+
5. **Docker Compose**: Version 2.20+
6. **NVIDIA Container Toolkit**: For GPU access in containers

### Pre-deployment Checklist

- [ ] NVIDIA drivers installed and working (`nvidia-smi` shows GPU info)
- [ ] Docker installed with GPU runtime support
- [ ] Docker Compose installed
- [ ] SSL certificates available at `Projects/Product/data/ssl/` (origin.crt, origin.key)
- [ ] Environment file `.env.staging` configured
- [ ] Data directories created:
  ```bash
  sudo mkdir -p /home/idii/data/{postgres-staging,user-uploads/{resumes,avatars},database}
  sudo chmod -R 755 /home/idii/data
  ```

### Create Docker Network

```bash
# Check if network exists
docker network ls | grep idii-staging

# Create network if it doesn't exist
docker network create idii-staging
```

---

## Quick Start

For experienced users, use the automated deployment script:

```bash
cd Projects/Product
./deploy-staging.sh
```

This script will:
1. Stop and remove existing containers
2. Build all Docker images
3. Start all services
4. Pull Ollama models
5. Verify service health

For first-time deployment or troubleshooting, follow the [Detailed Deployment Steps](#detailed-deployment-steps).

---

## Detailed Deployment Steps

### Step 1: Prepare Environment

```bash
# Navigate to project root
cd Projects/Product

# Verify environment file exists
ls -la .env.staging

# Check key environment variables
grep -E "(DB_HOST|OLLAMA)" .env.staging
```

Expected output:
```
DB_HOST=db-staging
DASHBOARD_OLLAMA_URL=http://ollama-staging:11434
CAREER_OLLAMA_URL=http://ollama2-staging:11434
```

### Step 2: Build and Start Services

```bash
# Build all images and start containers in detached mode
docker-compose -f docker-compose.staging.yml up -d --build
```

**Build time**: 5-15 minutes depending on system resources.

### Step 3: Verify Container Status

```bash
# Check all containers are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output (all containers should show "Up"):
```
NAMES                           STATUS          PORTS
idii-nginx-staging             Up 2 minutes    0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
idii-frontend-staging          Up 2 minutes    80/tcp
idii-backend-staging           Up 2 minutes    0.0.0.0:8000->8000/tcp
idii-PA-staging                Up 2 minutes    0.0.0.0:8001->8001/tcp
idii-career-agent-staging      Up 2 minutes    0.0.0.0:8002->8002/tcp
idii-db-staging                Up 2 minutes    0.0.0.0:5432->5432/tcp
idii-ollama-staging            Up 2 minutes    0.0.0.0:11434->11434/tcp
idii-ollama2-staging           Up 2 minutes    0.0.0.0:11435->11434/tcp
```

### Step 4: Pull LLM Models

```bash
# Pull model for Personal Assistant (Ollama instance 1)
docker exec idii-ollama-staging ollama pull gemma3:latest

# Pull model for Career Agent (Ollama instance 2)
docker exec idii-ollama2-staging ollama pull gemma3:latest
```

**Download time**: 5-10 minutes per model depending on internet speed.

### Step 5: Verify Model Installation

```bash
# List models in Personal Assistant Ollama
docker exec idii-ollama-staging ollama list

# List models in Career Agent Ollama
docker exec idii-ollama2-staging ollama list
```

Expected output:
```
NAME              ID              SIZE      MODIFIED
gemma3:latest     a1b2c3d4e5f6    5.0 GB    2 minutes ago
```

---

## Service Verification

### Health Check Endpoints

```bash
# Backend health check
curl http://localhost:8000/api/health
# Expected: {"status":"healthy"}

# Personal Assistant health check
curl http://localhost:8001/api/chat/health
# Expected: {"status":"healthy","model":"gemma3:latest","base_url":"http://ollama-staging:11434"}

# Career Agent health check
curl http://localhost:8002/api/health
# Expected: {"status":"healthy","model":"gemma3:latest","base_url":"http://ollama2-staging:11434"}

# Database connection check
docker exec idii-db-staging pg_isready -U postgres
# Expected: /var/run/postgresql:5432 - accepting connections
```

### Frontend Access

```bash
# Test HTTPS redirect
curl -I http://localhost
# Expected: 301 redirect to https://

# Test frontend loading (self-signed cert)
curl -k https://localhost
# Expected: HTML response with React app
```

### Ollama Connectivity Tests

```bash
# Test PA → Ollama connection
docker exec idii-PA-staging curl -s http://ollama-staging:11434/api/tags | jq

# Test Career Agent → Ollama2 connection
docker exec idii-career-agent-staging curl -s http://ollama2-staging:11434/api/tags | jq
```

### Log Inspection

```bash
# View real-time logs for all services
docker-compose -f docker-compose.staging.yml logs -f

# View logs for specific service
docker logs -f idii-backend-staging
docker logs -f idii-PA-staging
docker logs -f idii-career-agent-staging

# View last 100 lines
docker logs --tail 100 idii-nginx-staging
```

---

## Data Persistence

All persistent data is centrally managed under `/home/idii/data/` for easy backup and management.

### Data Directory Structure

```
/home/idii/data/
├── postgres-staging/          # PostgreSQL database files (71MB currently)
│   ├── base/                  # Database cluster base directory
│   ├── global/                # Cluster-wide tables
│   ├── pg_wal/                # Write-ahead logs
│   └── ...                    # Other PostgreSQL system files
├── user-uploads/              # All user-uploaded files
│   ├── resumes/               # Resume files organized by user_id
│   │   ├── 1/                 # User ID 1's resumes
│   │   ├── 3/                 # User ID 3's resumes
│   │   └── ...
│   └── avatars/               # Avatar images organized by user_id
│       ├── 1/                 # User ID 1's avatar
│       └── ...
└── database/                  # SQLite backup (migration reference)
    └── app.db                 # Original SQLite database (420KB, read-only)
```

### PostgreSQL Database

**Location**: `/home/idii/data/postgres-staging/`

This directory contains all PostgreSQL data and persists across container restarts and rebuilds.

```bash
# Check database size
docker exec idii-db-staging du -sh /var/lib/postgresql/data

# Backup database
docker exec idii-db-staging pg_dump -U postgres idii-staging > backup_$(date +%Y%m%d).sql

# Restore database
cat backup_20250112.sql | docker exec -i idii-db-staging psql -U postgres idii-staging

# Verify data integrity
docker exec idii-db-staging psql -U postgres idii-staging -c "\dt"
```

### User Uploads

**Resumes**: `/home/idii/data/user-uploads/resumes/`
**Avatars**: `/home/idii/data/user-uploads/avatars/`

Each user's files are stored in a subdirectory named by their user_id:

```bash
# Check upload directories structure
ls -lh /home/idii/data/user-uploads/resumes/
ls -lh /home/idii/data/user-uploads/avatars/

# Example: View files for user_id 1
ls -lh /home/idii/data/user-uploads/resumes/1/
ls -lh /home/idii/data/user-uploads/avatars/1/

# Check total upload size
du -sh /home/idii/data/user-uploads/
```

**Container Access**:
- Backend: `/app/resumes`, `/app/avatars`
- Career Agent: `/app/resumes` (read-only access for analysis)

### Ollama Models

**PA Models**: `Projects/Product/data/ollama-staging/`
**Career Models**: `Projects/Product/data/ollama2-staging/`

```bash
# Check Ollama data size
du -sh data/ollama-staging/
du -sh data/ollama2-staging/

# List models
docker exec idii-ollama-staging ollama list
docker exec idii-ollama2-staging ollama list
```

### SQLite Backup (Read-Only)

**Location**: `/home/idii/data/database/app.db`

The original SQLite database is preserved as a read-only backup for migration reference. It is not actively used by the running system.

```bash
# Verify SQLite backup exists
ls -lh /home/idii/data/database/app.db

# Query SQLite backup (if needed)
sqlite3 /home/idii/data/database/app.db ".tables"
```

---

## Common Operations

### Restarting Services

```bash
# Restart single service
docker restart idii-PA-staging

# Restart all services
docker-compose -f docker-compose.staging.yml restart

# Restart with rebuild (after code changes)
docker-compose -f docker-compose.staging.yml up -d --build personal-assistant-staging
```

### Updating Services

```bash
# Update single service
docker-compose -f docker-compose.staging.yml up -d --build <service-name>

# Update all services
docker-compose -f docker-compose.staging.yml up -d --build
```

### Stopping Services

```bash
# Stop all services (preserves data)
docker-compose -f docker-compose.staging.yml down

# Stop and remove volumes (WARNING: DELETES ALL DATA)
docker-compose -f docker-compose.staging.yml down -v
```

### Accessing Container Shell

```bash
# Access backend shell
docker exec -it idii-backend-staging bash

# Access database shell
docker exec -it idii-db-staging psql -U postgres idii-staging

# Access Ollama shell
docker exec -it idii-ollama-staging bash
```

### Monitoring Resources

```bash
# Real-time resource usage
docker stats

# Disk usage by container
docker system df -v

# Container inspect
docker inspect idii-backend-staging
```

---

## Troubleshooting

### Issue: Container Fails to Start

**Symptoms**: Container immediately exits or shows "Restarting" status.

**Diagnosis**:
```bash
# Check container logs
docker logs idii-<service-name>-staging

# Check container exit code
docker inspect idii-<service-name>-staging --format='{{.State.ExitCode}}'
```

**Common Causes**:
1. Missing environment variables → Check `.env.staging`
2. Port conflicts → Check `netstat -tulpn | grep <port>`
3. Dependency not ready → Check service startup order in docker-compose.yml
4. Code errors → Review application logs

### Issue: Cannot Connect to Database

**Symptoms**: Backend shows "database connection failed" errors.

**Diagnosis**:
```bash
# Check database container is running
docker ps | grep db-staging

# Test database connectivity from backend
docker exec idii-backend-staging nc -zv db-staging 5432

# Check database logs
docker logs idii-db-staging
```

**Solution**:
```bash
# Restart database
docker restart idii-db-staging

# Wait 10 seconds for database to be ready
sleep 10

# Restart dependent services
docker restart idii-backend-staging
```

### Issue: Ollama Connection Errors

**Symptoms**: PA or Career Agent shows "failed to connect to Ollama" errors.

**Diagnosis**:
```bash
# Check Ollama containers are running
docker ps | grep ollama

# Test connectivity from PA
docker exec idii-PA-staging curl -v http://ollama-staging:11434/api/tags

# Test connectivity from Career Agent
docker exec idii-career-agent-staging curl -v http://ollama2-staging:11434/api/tags
```

**Common Issues**:

1. **Using HTTPS instead of HTTP**
   - ❌ Wrong: `https://ollama-staging:11434`
   - ✅ Correct: `http://ollama-staging:11434`

2. **Using external port instead of internal**
   - ❌ Wrong: `http://localhost:11435`
   - ✅ Correct: `http://ollama2-staging:11434`

3. **Model not pulled**
   ```bash
   docker exec idii-ollama-staging ollama pull gemma3:latest
   docker exec idii-ollama2-staging ollama pull gemma3:latest
   ```

### Issue: Nginx Shows 502 Bad Gateway

**Symptoms**: Frontend requests fail with 502 errors.

**Diagnosis**:
```bash
# Check nginx logs
docker logs idii-nginx-staging

# Test backend connectivity from nginx
docker exec idii-nginx-staging nc -zv backend-staging 8000
docker exec idii-nginx-staging nc -zv personal-assistant-staging 8001
docker exec idii-nginx-staging nc -zv career-agent-staging 8002
```

**Solutions**:

1. **Restart nginx after backend changes**
   ```bash
   docker restart idii-nginx-staging
   ```

2. **Check nginx configuration**
   ```bash
   docker exec idii-nginx-staging nginx -t
   ```

3. **Verify upstream services are healthy**
   ```bash
   curl http://localhost:8000/api/health
   curl http://localhost:8001/api/chat/health
   curl http://localhost:8002/api/health
   ```

### Issue: Personal Assistant Indicator Red

**Symptoms**: Frontend shows PA indicator as red instead of green.

**Common Causes**:
1. PA service not running
2. Nginx routing misconfigured
3. Ollama not connected

**Solution**:
```bash
# Test PA health through nginx
curl -k https://localhost/api/pa/health

# Test PA health directly
curl http://localhost:8001/api/chat/health

# If direct works but nginx fails, restart nginx
docker restart idii-nginx-staging
```

### Issue: GPU Not Available in Ollama

**Symptoms**: Ollama uses CPU instead of GPU, very slow responses.

**Diagnosis**:
```bash
# Check GPU visibility in Ollama container
docker exec idii-ollama-staging nvidia-smi

# Check NVIDIA runtime is configured
docker info | grep -i runtime
```

**Solution**:
```bash
# Install NVIDIA container toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Rebuild Ollama containers
docker-compose -f docker-compose.staging.yml up -d --build ollama-staging ollama2-staging
```

### Issue: Data Loss After Rebuild

**Symptoms**: User data or database disappeared after rebuild.

**Prevention**:
```bash
# NEVER use -v flag when stopping containers
# ❌ Wrong: docker-compose down -v  (deletes volumes)
# ✅ Correct: docker-compose down      (preserves volumes)

# Verify volume mounts before operations
docker inspect idii-db-staging --format='{{json .Mounts}}' | jq
```

**Recovery**:
- If you have backups, restore from backup
- If volumes were removed, data is unrecoverable

### Issue: User Upload Files Missing

**Symptoms**: Uploaded resumes or avatars are not accessible.

**Diagnosis**:
```bash
# Check if upload directories exist
ls -la /home/idii/data/user-uploads/resumes/
ls -la /home/idii/data/user-uploads/avatars/

# Check permissions
ls -la /home/idii/data/user-uploads/

# Check mount inside container
docker exec idii-backend-staging ls -la /app/resumes/
docker exec idii-backend-staging ls -la /app/avatars/
```

**Solution**:
```bash
# Fix permissions if needed
sudo chmod -R 755 /home/idii/data/user-uploads/

# Restart backend and career agent
docker restart idii-backend-staging idii-career-agent-staging
```

### Debug: Network Connectivity

```bash
# Inspect network
docker network inspect idii-staging

# Check container IPs and aliases
docker network inspect idii-staging --format '{{range .Containers}}{{.Name}}: {{.IPv4Address}}{{"\n"}}{{end}}'

# Test DNS resolution
docker exec idii-PA-staging nslookup ollama-staging
docker exec idii-career-agent-staging nslookup ollama2-staging
```

---

## Environment Variables Reference

Key variables in `.env.staging`:

```bash
# Database Configuration
DB_HOST=db-staging
DB_PORT=5432
DB_NAME=idii-staging
DB_USER=postgres
DB_PASSWORD=<secure-password>

# Ollama Configuration
DASHBOARD_OLLAMA_URL=http://ollama-staging:11434
CAREER_OLLAMA_URL=http://ollama2-staging:11434

# LLM Models
PA_LLM_MODEL=gemma3:latest
CAREER_LLM_MODEL=gemma3:latest

# API Configuration
BACKEND_URL=http://backend-staging:8000
PA_URL=http://personal-assistant-staging:8001
CAREER_URL=http://career-agent-staging:8002

# Security
JWT_SECRET=<random-secret>
SESSION_SECRET=<random-secret>
```

---

## Deployment Checklist

Use this checklist for production deployments:

### Pre-Deployment
- [ ] All code changes committed and pushed
- [ ] `.env.staging` file updated with correct values
- [ ] SSL certificates valid and not expired
- [ ] Backup existing database: `docker exec idii-db-staging pg_dump -U postgres idii-staging > backup.sql`
- [ ] Verify disk space available (minimum 50GB free)
- [ ] Verify GPU is accessible (`nvidia-smi`)
- [ ] Verify data directories exist: `/home/idii/data/postgres-staging/`, `/home/idii/data/user-uploads/`

### Deployment
- [ ] Stop existing containers: `docker-compose down`
- [ ] Build images: `docker-compose up -d --build`
- [ ] Verify all containers running: `docker ps`
- [ ] Pull Ollama models: `ollama pull gemma3:latest`
- [ ] Test health endpoints (backend, PA, career agent)
- [ ] Test frontend loads (HTTP redirects to HTTPS)

### Post-Deployment
- [ ] Verify database connectivity
- [ ] Test user login
- [ ] Test file uploads (resume, avatar)
- [ ] Verify uploaded files appear in `/home/idii/data/user-uploads/`
- [ ] Test PA chat functionality
- [ ] Test career agent analysis
- [ ] Check PA indicator is green
- [ ] Monitor logs for errors (first 5 minutes)
- [ ] Verify GPU usage in Ollama containers

### Rollback Plan
If deployment fails:
```bash
# Stop new containers
docker-compose -f docker-compose.staging.yml down

# Checkout previous version
git checkout <previous-commit>

# Rebuild and start
docker-compose -f docker-compose.staging.yml up -d --build

# Restore database if needed
cat backup.sql | docker exec -i idii-db-staging psql -U postgres idii-staging
```

---

## Data Backup Strategy

### Full Backup

```bash
# Create backup directory
mkdir -p ~/backups/$(date +%Y%m%d)

# Backup PostgreSQL database
docker exec idii-db-staging pg_dump -U postgres idii-staging > ~/backups/$(date +%Y%m%d)/database.sql

# Backup user uploads
sudo tar -czf ~/backups/$(date +%Y%m%d)/user-uploads.tar.gz /home/idii/data/user-uploads/

# Backup Ollama models (optional, can be re-downloaded)
tar -czf ~/backups/$(date +%Y%m%d)/ollama-models.tar.gz data/ollama-staging/ data/ollama2-staging/
```

### Restore from Backup

```bash
# Stop containers
docker-compose -f docker-compose.staging.yml down

# Restore PostgreSQL data directory (if needed)
sudo rm -rf /home/idii/data/postgres-staging/*
sudo tar -xzf ~/backups/20250112/postgres-data.tar.gz -C /home/idii/data/

# Restore user uploads
sudo rm -rf /home/idii/data/user-uploads/*
sudo tar -xzf ~/backups/20250112/user-uploads.tar.gz -C /

# Start containers
docker-compose -f docker-compose.staging.yml up -d

# Wait for database to be ready
sleep 10

# Restore database from SQL dump (alternative method)
cat ~/backups/20250112/database.sql | docker exec -i idii-db-staging psql -U postgres idii-staging
```

---

## Additional Resources

- [Port Mapping Guide](./PORT_MAPPING_EXPLAINED.md)
- [Deployment Scripts Guide](./DEPLOYMENT_SCRIPTS_EXPLAINED.md)
- [Pre-Deployment Checklist](./PRE_DEPLOYMENT_CHECKLIST.md)
- [Upload Testing Guide](./UPLOAD_TEST_GUIDE.md)
- [Docker Compose Configuration](../../docker-compose.staging.yml)

---

**Last Updated**: 2025-01-12
**Maintained By**: DevOps Team
