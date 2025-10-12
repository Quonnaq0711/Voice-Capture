# Deployment Scripts Explained

## Overview

This document explains the deployment scripts used for the IDII Staging Platform, including their purposes, workflows, and troubleshooting steps.

---

## Table of Contents

1. [Scripts Overview](#scripts-overview)
2. [Deployment Workflow](#deployment-workflow)
3. [Verification Commands](#verification-commands)
4. [Troubleshooting](#troubleshooting)
5. [Best Practices](#best-practices)

---

## Scripts Overview

### 1. deploy-staging.sh (Main Deployment Script)

**Purpose**: Automated deployment of the entire staging environment with PostgreSQL database and dual Ollama instances.

**Location**: `Projects/Product/deploy-staging.sh`

**What it does**:
1. ✅ Verifies GPU availability using `nvidia-smi`
2. 🌐 Gets external IP from GCP metadata
3. 📥 Pulls latest code from `containerization` branch
4. 🛑 Stops existing containers (`docker-compose down`)
5. 🏗️ Builds all Docker containers (with `--no-cache` flag)
6. 🚀 Starts all services in detached mode
7. ⏳ Waits 45 seconds for services to initialize
8. 🤖 Sets up Ollama models (both instances via `setup-ollama-updated.sh`)
9. 🧪 Tests GPU acceleration in both Ollama containers
10. 📊 Displays deployment summary with all service URLs

**Usage**:
```bash
cd Projects/Product
./deploy-staging.sh
```

**Key Features**:
- Automated PostgreSQL database initialization
- Dual Ollama instance setup (PA on 11434, Career on 11435)
- GPU verification and status reporting
- Comprehensive service URL display
- Error handling with `set -e` (exit on error)

**Services Deployed**:
| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 80, 443 | React application (via Nginx) |
| Backend | 8000 | Main FastAPI backend |
| Personal Assistant | 8001 | PA chat API |
| Career Agent | 8002 | Career-specific AI agent |
| PostgreSQL | 5432 | Database |
| Ollama 1 (PA) | 11434 | LLM for Personal Assistant |
| Ollama 2 (Career) | 11435 | LLM for Career Agent |
| Nginx | 80, 443 | Reverse proxy & SSL |

**Output Example**:
```
🚀 Deploying Idii Staging Platform...
✅ GPU detected: NVIDIA A100-SXM4-40GB, 40960 MiB
🌐 Staging IP: 34.123.45.67
👨🏽‍💻 Pulling latest...
🏗️ Building... Starting services....
⏳ Waiting on services...
🤖 Setting up Ollama models...
✅ Deployment Complete!
🎭 Staging URLs:
   Frontend: http://staging.idii.co:3000
   Backend: http://staging.idii.co:8000/docs
   Personal Assistant: http://staging.idii.co:8001/docs
   Career Agent: http://staging.idii.co:8002/docs
   Ollama 1 (PA GPU): http://staging.idii.co:11434/api/tags
   Ollama 2 (Career GPU): http://staging.idii.co:11435/api/tags
🌍 Application should be available at: https://staging.idii.co
```

---

### 2. setup-ollama-updated.sh (Dual Ollama Setup)

**Purpose**: Setup models for both Ollama instances (Personal Assistant and Career Agent).

**Location**: `Projects/Product/setup-ollama-updated.sh`

**What it does**:
1. ⏳ Waits for both Ollama services to be ready (health check loop)
2. 🔍 Verifies GPU access in both containers (`nvidia-smi`)
3. 📥 Pulls `gemma3:latest` model to both instances
4. 🧪 Tests each model with a simple prompt
5. 📊 Shows GPU memory usage for each instance
6. 📋 Lists installed models

**Features**:
- ✅ Configures Ollama 1 (Personal Assistant - Port 11434)
- ✅ Configures Ollama 2 (Career Agent - Port 11435)
- ✅ Modular design with reusable functions
- ✅ Better error handling and logging
- ✅ Automatic retry logic for service readiness
- ✅ Color-coded output for better visibility

**Usage**:
```bash
cd Projects/Product
./setup-ollama-updated.sh
```

**Functions**:
- `wait_for_ollama()` - Waits for Ollama service to be ready
- `verify_gpu()` - Checks GPU accessibility in container
- `pull_models()` - Pulls required models
- `test_model()` - Verifies model is working
- `show_gpu_info()` - Displays GPU memory usage
- `list_models()` - Shows installed models

**Output Example**:
```
=========================================
Setting up Ollama 1 (Personal Assistant - Port 11434)
=========================================
⏳ Waiting for ollama-staging service to start...
✅ ollama-staging service is ready
🔍 Verifying GPU access in idii-ollama-staging...
✅ GPU accessible in idii-ollama-staging
📥 Pulling models for Ollama 1 (Personal Assistant - Port 11434)...
✅ Successfully pulled gemma3:latest
🧪 Testing Ollama 1 model...
✅ Model test successful
📊 GPU Memory Usage:
   Used: 2048 MiB / Total: 40960 MiB
📋 Installed models:
   gemma3:latest (5.0 GB)
✅ Ollama 1 (Personal Assistant - Port 11434) setup complete!

=========================================
Setting up Ollama 2 (Career Agent - Port 11435)
=========================================
⏳ Waiting for ollama2-staging service to start...
✅ ollama2-staging service is ready
🔍 Verifying GPU access in idii-ollama2-staging...
✅ GPU accessible in idii-ollama2-staging
📥 Pulling models for Ollama 2 (Career Agent - Port 11435)...
✅ Successfully pulled gemma3:latest
🧪 Testing Ollama 2 model...
✅ Model test successful
📊 GPU Memory Usage:
   Used: 2048 MiB / Total: 40960 MiB
📋 Installed models:
   gemma3:latest (5.0 GB)
✅ Ollama 2 (Career Agent - Port 11435) setup complete!
```

---

### 3. setup-ollama.sh (DEPRECATED - Single Ollama Setup)

**Status**: ⚠️ **Deprecated** - Only sets up one Ollama instance

**Problem**:
- Only configures `idii-ollama-staging` (port 11434)
- Missing `idii-ollama2-staging` (port 11435)
- Will cause Career Agent to fail (no LLM backend)
- Does not support the current dual-Ollama architecture

**Recommendation**:
- ❌ Do not use this script
- ✅ Use `setup-ollama-updated.sh` instead
- Consider removing or renaming this file to avoid confusion

---

### 4. setup-ssl.sh

**Purpose**: SSL certificate setup for HTTPS access

**Status**: Not reviewed in detail for this documentation

**Typical Usage**:
```bash
cd Projects/Product
./setup-ssl.sh
```

---

### 5. startup-script.sh

**Purpose**: GCP VM startup script for automatic service initialization

**Status**: Not reviewed in detail for this documentation

**Typical Location**: Set in GCP VM metadata as startup script

---

## Script Comparison

| Script | Status | Ollama Instances | PostgreSQL | Recommended |
|--------|--------|------------------|------------|-------------|
| `deploy-staging.sh` | ✅ Active | Dual (via updated script) | ✅ Yes | ✅ Yes |
| `setup-ollama-updated.sh` | ✅ Active | Dual (PA + Career) | N/A | ✅ Yes |
| `setup-ollama.sh` | ⚠️ Deprecated | Single (PA only) | N/A | ❌ No |

---

## Deployment Workflow

### Full Deployment Flow

```
┌─────────────────────────────────────────────────────────┐
│  ./deploy-staging.sh                                    │
└────────────┬────────────────────────────────────────────┘
             │
             ├─► 🔍 Check GPU availability (nvidia-smi)
             │
             ├─► 🌐 Get external IP from GCP metadata
             │
             ├─► 📥 Pull latest code from containerization branch
             │
             ├─► 🛑 Stop existing containers
             │    └─► docker-compose down
             │
             ├─► 🏗️ Build all containers (--no-cache)
             │    ├─► Backend (FastAPI)
             │    ├─► Personal Assistant (Port 8001)
             │    ├─► Career Agent (Port 8002)
             │    ├─► Frontend (React + Nginx)
             │    ├─► PostgreSQL Database
             │    ├─► Ollama 1 (PA - Port 11434)
             │    └─► Ollama 2 (Career - Port 11435)
             │
             ├─► 🚀 Start all services (docker-compose up -d)
             │
             ├─► ⏳ Wait 45 seconds for initialization
             │
             ├─► 🤖 ./setup-ollama-updated.sh
             │    │
             │    ├─► Setup Ollama 1 (PA - Port 11434)
             │    │    ├─► Wait for service ready
             │    │    ├─► Verify GPU access
             │    │    ├─► Pull gemma3:latest model
             │    │    ├─► Test model with prompt
             │    │    ├─► Show GPU memory
             │    │    └─► List installed models
             │    │
             │    └─► Setup Ollama 2 (Career - Port 11435)
             │         ├─► Wait for service ready
             │         ├─► Verify GPU access
             │         ├─► Pull gemma3:latest model
             │         ├─► Test model with prompt
             │         ├─► Show GPU memory
             │         └─► List installed models
             │
             └─► 🧪 Test GPU acceleration
                  ├─► Test Ollama 1 (nvidia-smi in container)
                  ├─► Test Ollama 2 (nvidia-smi in container)
                  └─► Display deployment summary
```

### Data Persistence Flow

```
Container Lifecycle:
┌─────────────────────────────────────────────────────┐
│ docker-compose down (stop & remove containers)      │
└─────────────────────────────────────────────────────┘
                       │
                       ├─► PostgreSQL data PRESERVED at:
                       │   /home/idii/data/postgres-staging/
                       │
                       ├─► User uploads PRESERVED at:
                       │   /home/idii/data/user-uploads/{resumes,avatars}/
                       │
                       └─► Ollama models PRESERVED at:
                           Projects/Product/data/ollama-staging/ (PA)
                           Projects/Product/data/ollama2-staging/ (Career)

┌─────────────────────────────────────────────────────┐
│ docker-compose build --no-cache                      │
│ (rebuild images)                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ docker-compose up -d                                 │
│ (start containers with volume mounts)                │
└─────────────────────────────────────────────────────┘
                       │
                       └─► All data automatically remounted
                           ✅ Database data restored
                           ✅ User files accessible
                           ✅ Ollama models available
```

---

## Verification Commands

After deployment, verify everything is working correctly:

### Container Status

```bash
# Check all containers are running
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check specific service logs
docker logs idii-backend-staging --tail 50
docker logs idii-PA-staging --tail 50
docker logs idii-career-agent-staging --tail 50
docker logs idii-db-staging --tail 50
```

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
```

### Ollama Instance Tests

```bash
# Test Ollama 1 (PA - Port 11434)
curl http://localhost:11434/api/tags
# Expected: JSON with list of installed models

# Test Ollama 2 (Career - Port 11435)
curl http://localhost:11435/api/tags
# Expected: JSON with list of installed models

# List models in each instance
docker exec idii-ollama-staging ollama list
docker exec idii-ollama2-staging ollama list
```

### Database Verification

```bash
# Check PostgreSQL is running
docker exec idii-db-staging pg_isready -U postgres
# Expected: /var/run/postgresql:5432 - accepting connections

# List all tables
docker exec idii-db-staging psql -U postgres productdb-staging -c "\dt"

# Check user count
docker exec idii-db-staging psql -U postgres productdb-staging -c "SELECT COUNT(*) FROM users;"
```

### GPU Status

```bash
# Check host GPU
nvidia-smi

# Check GPU in Ollama 1
docker exec idii-ollama-staging nvidia-smi

# Check GPU in Ollama 2
docker exec idii-ollama2-staging nvidia-smi

# GPU utilization and memory
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader
```

### Frontend Access

```bash
# Test HTTPS redirect
curl -I http://localhost
# Expected: 301 redirect to https://

# Test frontend loads (self-signed cert)
curl -k https://localhost
# Expected: HTML response with React app

# Test through nginx
curl -k https://localhost/api/health
# Expected: {"status":"healthy"}
```

### Data Persistence Verification

```bash
# Check user uploads
ls -la /home/idii/data/user-uploads/resumes/
ls -la /home/idii/data/user-uploads/avatars/

# Check PostgreSQL data size
docker exec idii-db-staging du -sh /var/lib/postgresql/data

# Check Ollama models
du -sh Projects/Product/data/ollama-staging/
du -sh Projects/Product/data/ollama2-staging/
```

---

## Troubleshooting

### Issue: Ollama Model Not Found

**Symptoms**: API returns "model not found" error.

**Solution**:
```bash
# Manually pull model to specific instance
docker exec idii-ollama-staging ollama pull gemma3:latest
docker exec idii-ollama2-staging ollama pull gemma3:latest

# Verify model is installed
docker exec idii-ollama-staging ollama list
docker exec idii-ollama2-staging ollama list
```

### Issue: GPU Not Accessible

**Symptoms**: Ollama uses CPU, very slow responses.

**Diagnosis**:
```bash
# Check NVIDIA runtime is configured
docker info | grep -i runtime

# Check GPU visibility from host
nvidia-smi

# Check GPU in containers
docker exec idii-ollama-staging nvidia-smi
docker exec idii-ollama2-staging nvidia-smi
```

**Solution**:
```bash
# Install NVIDIA container toolkit (if missing)
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

### Issue: Service Not Starting

**Symptoms**: Container exits immediately or shows "Restarting" status.

**Diagnosis**:
```bash
# Check container logs
docker logs idii-ollama-staging --tail 50
docker logs idii-ollama2-staging --tail 50
docker logs idii-PA-staging --tail 50
docker logs idii-career-agent-staging --tail 50
docker logs idii-backend-staging --tail 50

# Check service status
docker-compose -f docker-compose.staging.yml ps

# Check container exit code
docker inspect idii-<service-name>-staging --format='{{.State.ExitCode}}'
```

**Common Causes**:
1. Missing environment variables → Check `.env.staging`
2. Port conflicts → Check `netstat -tulpn | grep <port>`
3. Dependency not ready → Check startup order
4. Code errors → Review application logs

### Issue: Database Connection Failed

**Symptoms**: Backend cannot connect to PostgreSQL.

**Diagnosis**:
```bash
# Check database is running
docker ps | grep db-staging

# Test connectivity from backend
docker exec idii-backend-staging nc -zv db-staging 5432

# Check database logs
docker logs idii-db-staging --tail 50
```

**Solution**:
```bash
# Restart database and wait for it to be ready
docker restart idii-db-staging
sleep 10

# Restart dependent services
docker restart idii-backend-staging idii-PA-staging idii-career-agent-staging
```

### Issue: Deployment Script Fails

**Symptoms**: `deploy-staging.sh` exits with error.

**Diagnosis**:
```bash
# Check GPU availability
nvidia-smi

# Check network connectivity
curl -s -H "Metadata-Flavor: Google" \
  http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip

# Check git repository
git status
git remote -v
```

**Solution**:
```bash
# Run script with verbose output
bash -x ./deploy-staging.sh

# Or run commands manually step by step
# (see Deployment Workflow section)
```

### Issue: Ollama Service Takes Too Long to Start

**Symptoms**: `setup-ollama-updated.sh` times out waiting for service.

**Solution**:
```bash
# Check Ollama container logs
docker logs idii-ollama-staging
docker logs idii-ollama2-staging

# Manually restart Ollama services
docker restart idii-ollama-staging idii-ollama2-staging

# Wait and re-run setup script
sleep 30
./setup-ollama-updated.sh
```

---

## Best Practices

### Before Deployment

1. **Backup Data**:
   ```bash
   # Backup PostgreSQL database
   docker exec idii-db-staging pg_dump -U postgres productdb-staging > backup_$(date +%Y%m%d).sql

   # Backup user uploads
   sudo tar -czf backup_uploads_$(date +%Y%m%d).tar.gz /home/idii/data/user-uploads/
   ```

2. **Check Disk Space**:
   ```bash
   df -h
   # Ensure at least 50GB free
   ```

3. **Verify GPU**:
   ```bash
   nvidia-smi
   # Ensure GPU is accessible and not fully utilized
   ```

### During Deployment

1. **Monitor Logs**:
   ```bash
   # In separate terminal, monitor logs
   docker-compose -f docker-compose.staging.yml logs -f
   ```

2. **Check Resource Usage**:
   ```bash
   docker stats
   ```

### After Deployment

1. **Run Full Verification**:
   - Test all health endpoints
   - Upload a test file
   - Run resume analysis
   - Check PA chat functionality

2. **Monitor for Errors**:
   ```bash
   # Watch logs for first 5 minutes
   docker-compose -f docker-compose.staging.yml logs -f --tail 100
   ```

3. **Verify Data Persistence**:
   ```bash
   # Check all data directories exist and have correct permissions
   ls -la /home/idii/data/postgres-staging/
   ls -la /home/idii/data/user-uploads/
   ```

---

## Related Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Complete deployment instructions
- [Upload Testing Guide](./UPLOAD_TEST_GUIDE.md) - File upload and persistence testing
- [Port Mapping Guide](./PORT_MAPPING_EXPLAINED.md) - Service port configuration
- [Pre-Deployment Checklist](./PRE_DEPLOYMENT_CHECKLIST.md) - Pre-deployment verification

---

**Last Updated**: 2025-01-12
**Maintained By**: DevOps Team
