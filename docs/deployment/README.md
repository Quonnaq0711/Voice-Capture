# Deployment Documentation

Complete guide for deploying the IDII AI Assistant Platform to staging and production environments.

---

## Quick Navigation

### 🚀 For First-Time Deployment
Start here → **[deployment_guide.md](deployment_guide.md)**

### 🗄️ Database Setup
PostgreSQL initialization → **[database_initialization.md](database_initialization.md)**

---

## Documentation Structure

### 📘 Main Deployment Guide
**[deployment_guide.md](deployment_guide.md)** - Complete deployment handbook (47KB)

**Contents:**
1. **Quick Start** - One-command deployment with `./deploy-staging.sh`
2. **Architecture Overview** - Service stack, network, ports, data persistence
3. **Prerequisites** - System requirements, GPU setup, Docker configuration
4. **Detailed Deployment Steps** - Step-by-step manual deployment
5. **Deployment Scripts Explained** - How `deploy-staging.sh` and `setup-ollama-updated.sh` work
6. **Port Configuration** - Understanding Docker port mapping (external vs internal)
7. **Service Verification** - Health checks, logs, connectivity tests
8. **Data Persistence** - PostgreSQL, user uploads, Ollama models, backups
9. **Upload Testing** - Resume and avatar upload verification
10. **Common Operations** - Restart, update, monitor services
11. **Troubleshooting** - Solutions for 15+ common issues
12. **Deployment Checklist** - Pre/during/post-deployment verification

### 🗄️ Database Initialization Guide
**[database_initialization.md](database_initialization.md)** - PostgreSQL setup (12KB)

**Contents:**
- Fresh database initialization with `scripts/init_postgres.sql`
- Schema for all 8 tables (users, profiles, resumes, insights, etc.)
- Connection methods (Docker containers vs direct connection)
- Troubleshooting database issues
- Migration guide from SQLite to PostgreSQL

---

## Quick Reference

### One-Command Deployment

```bash
cd Projects/Product
./deploy-staging.sh
```

This automated script:
- ✅ Stops existing containers
- ✅ Builds all Docker images
- ✅ Starts all 8 services
- ✅ Pulls Ollama models (2 instances)
- ✅ Verifies GPU acceleration
- ✅ Displays service URLs

**Deployment time**: 5-10 minutes

### Service Endpoints

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | https://staging.idii.co | React application |
| Backend API | http://localhost:8000/docs | FastAPI documentation |
| Personal Assistant | http://localhost:8001/docs | PA chat API |
| Career Agent | http://localhost:8002/docs | Career analysis API |
| Ollama 1 (PA) | http://localhost:11434 | LLM for Personal Assistant |
| Ollama 2 (Career) | http://localhost:11435 | LLM for Career Agent |
| PostgreSQL | localhost:5432 | Database (idii-staging) |

### Essential Commands

```bash
# Check all containers
docker ps

# View logs
docker logs -f idii-backend-staging

# Restart service
docker restart idii-PA-staging

# Stop all services
docker-compose -f docker-compose.staging.yml down

# Rebuild and restart
docker-compose -f docker-compose.staging.yml up -d --build

# Database backup
docker exec idii-db-staging pg_dump -U postgres idii-staging > backup.sql
```

---

## Common Tasks

### Initial Setup
1. Read [deployment_guide.md - Prerequisites](deployment_guide.md#prerequisites)
2. Run `./deploy-staging.sh`
3. Verify services with health checks
4. Test file uploads

### Database Management
1. See [database_initialization.md](database_initialization.md)
2. Initialize: `./scripts/init_postgres.sh --container`
3. Backup: `pg_dump > backup.sql`
4. Restore: `psql < backup.sql`

### Troubleshooting
1. Check [deployment_guide.md - Troubleshooting](deployment_guide.md#troubleshooting)
2. Common issues:
   - Container fails to start → Check logs
   - Database connection failed → Restart db-staging
   - Ollama connection errors → Verify internal ports (11434)
   - GPU not available → Install NVIDIA container toolkit
   - 502 Bad Gateway → Restart nginx

---

## Architecture Summary

### Service Stack (8 Containers)
```
┌─────────────────────────────────────────────────┐
│ nginx-staging (80, 443)                         │
│   ├─► frontend-staging (React app)             │
│   ├─► backend-staging:8000 (FastAPI)          │
│   ├─► PA-staging:8001 (Personal Assistant)    │
│   └─► career-agent-staging:8002 (Career AI)    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Databases & AI                                  │
│   ├─► db-staging:5432 (PostgreSQL)            │
│   ├─► ollama-staging:11434 (PA LLM + GPU)     │
│   └─► ollama2-staging:11435 (Career LLM + GPU)│
└─────────────────────────────────────────────────┘
```

### Data Persistence
```
/home/idii/data/
├── postgres-staging/       # PostgreSQL database
├── user-uploads/
│   ├── resumes/           # User resume files (by user_id)
│   └── avatars/           # User avatar images (by user_id)
└── database/              # SQLite backup (read-only)

Projects/Product/data/
├── ollama-staging/        # PA models & cache
└── ollama2-staging/       # Career models & cache
```

---

## Getting Help

### Documentation
- [deployment_guide.md](deployment_guide.md) - Main deployment guide
- [database_initialization.md](database_initialization.md) - Database setup
- [../architecture/](../architecture/) - System architecture docs
- [../development/](../development/) - Development environment setup

### External Resources
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Ollama Documentation](https://github.com/ollama/ollama)
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/)

---

## Deployment Workflow Overview

```
1. Prerequisites Check
   ├─► GPU available (nvidia-smi)
   ├─► Docker & Docker Compose installed
   ├─► NVIDIA Container Toolkit configured
   └─► Data directories created

2. Run Deployment Script
   └─► ./deploy-staging.sh
       ├─► Stop existing containers
       ├─► Build all images (5-10 min)
       ├─► Start services
       ├─► Pull Ollama models (2-3 min)
       └─► Verify GPU acceleration

3. Verify Deployment
   ├─► Health checks (all services)
   ├─► Test file uploads
   ├─► Test PA chat
   ├─► Test career analysis
   └─► Monitor logs

4. Post-Deployment
   ├─► Backup database
   ├─► Monitor resource usage
   └─► Document any customizations
```

---

**Last Updated**: 2025-01-12
**Maintained By**: DevOps Team

**Questions?** Check the [Troubleshooting](deployment_guide.md#troubleshooting) section or review container logs.
