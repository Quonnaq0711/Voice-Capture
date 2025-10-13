# Development Environment Setup on Linux (Automated)

> **🚀 Setup Method**: This guide uses **automated deployment scripts** (`./deploy-dev.sh`) for Linux systems.
>
> **📖 Need Manual Installation?** For step-by-step manual setup on any platform (Windows/macOS/Linux):
> See [development_setup_manual.md](development_setup_manual.md) for detailed installation instructions.

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Starting Development Environment](#starting-development-environment)
- [Testing Features](#testing-features)
- [Stop Development Environment Safely](#stop-development-environment-safely)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

This guide explains how to set up and run the development environment on any Linux system (local workstation, remote server, cloud VM, or container). The development setup is completely isolated from the staging/production deployment and can run safely alongside container services.

**Applicable to**:
- ✅ Local Linux machines (Ubuntu, Debian, Fedora, etc.)
- ✅ Cloud VMs (GCP, AWS, Azure, DigitalOcean)
- ✅ Remote servers via SSH (VSCode Remote-SSH, traditional SSH)
- ✅ WSL2 (Windows Subsystem for Linux)
- ✅ Development containers

### Development vs. Deployment Modes

| Aspect | Development Mode | Deployment Mode |
|--------|------------------|-----------------|
| **Purpose** | Local testing with fast iteration | Production-ready containerized deployment |
| **Services** | Local processes with PID tracking | Docker containers |
| **Ports** | 1000, 5000-6002, 12434-12435 | 80/443, 8000-8002, 11434-11435 |
| **Database** | SQLite (`backend/db/app.db`) | PostgreSQL (container) |
| **Frontend** | Port 1000 with hot reload | Nginx on 80/443 |
| **Ollama** | Two local instances (12434, 12435) | Two Docker containers (11434, 11435) |
| **Email** | OTP printed to console (no email) | Real email via MailGun |
| **Configuration** | `.env.dev` | `.env.staging` |
| **Start Command** | `./deploy-dev.sh` | `./deploy-staging.sh` |
| **Stop Command** | `./stop-dev.sh` | `docker-compose down` |

**Key Feature**: Both modes can run simultaneously without conflicts!

---

## Prerequisites

### 1. System Requirements

**Minimum Specifications**:
- **CPU**: 4 cores (2 cores minimum, but performance will be slower)
- **RAM**: 16 GB (8 GB minimum, but may experience slowdowns with Ollama)
- **Disk**: 50 GB free space (for code, dependencies, and Ollama models)
- **OS**: Linux (Ubuntu 20.04+, Debian 11+, Fedora 35+, or equivalent)
- **GPU** (Optional): NVIDIA GPU for Ollama acceleration (significantly faster)

**Tested Platforms**:
- ✅ Ubuntu 20.04, 22.04, 24.04 LTS
- ✅ Debian 11 (Bullseye), 12 (Bookworm)
- ✅ Fedora 35+
- ✅ CentOS Stream 9
- ✅ WSL2 (Ubuntu/Debian)

### 2. Required Software

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Python 3.10+
sudo apt install -y python3 python3-pip python3-venv

# Install Node.js 18+ and npm
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Verify installations
python3 --version  # Should be 3.10+
node --version     # Should be 18+
npm --version
ollama --version
```

### 3. VSCode Remote-SSH Setup (Optional, for Remote Development)

If developing on a remote Linux machine, configure SSH access:

1. Install "Remote - SSH" extension in VSCode
2. Configure SSH connection in your local `~/.ssh/config`:
   ```
   Host my-dev-server
       HostName <YOUR_SERVER_IP_OR_HOSTNAME>
       User <YOUR_USERNAME>
       IdentityFile ~/.ssh/id_rsa
       ServerAliveInterval 60
       ServerAliveCountMax 10
   ```
3. Connect via VSCode: `Ctrl+Shift+P` → "Remote-SSH: Connect to Host"

**Note**: Skip this step if developing directly on your local Linux machine.

---

## Initial Setup

### Step 1: Clone Repository

```bash
# Clone the repository to your preferred location
cd ~
git clone <repository-url> Product
cd Product
```

### Step 2: Verify Environment Configuration

Check that `.env.dev` exists and has correct settings:

```bash
cat .env.dev | grep -E "ENVIRONMENT|PORT|DATABASE_PATH"
```

Expected output:
```
ENVIRONMENT=development
BACKEND_PORT=5000
PA_PORT=6001
CAREER_PORT=6002
FRONTEND_PORT=1000
OLLAMA1_PORT=12434
OLLAMA2_PORT=12435
DATABASE_PATH=backend/db/app.db
```

### Step 3: Install Dependencies

```bash
# Backend Python dependencies
pip3 install -r backend/requirements.txt

# Frontend Node dependencies
cd frontend
npm install
cd ..
```

### Step 4: Initialize SQLite Database

Create a fresh SQLite database with all required tables:

```bash
# Create database with all 8 tables
python backend/scripts/create_tables.py
```

This script will:
- Check if `backend/db/app.db` exists
- If it exists, prompt you to drop and recreate tables
- Create all 8 tables: users, user_profiles, resumes, career_insights, chat_sessions, chat_messages, user_activities, daily_recommendations

**Interactive Mode** (default, prompts before dropping):
```bash
python backend/scripts/create_tables.py

# Output:
Database location: /path/to/Product/backend/db/app.db
Found 8 existing tables: users, user_profiles, ...
Database exists. Drop all tables and recreate? (y/N):
```

**Force Mode** (drops without prompting):
```bash
python backend/scripts/create_tables.py --force

# ⚠️ Warning: This will delete all existing data!
```

**First Time Setup**:
If the database doesn't exist, it will be created automatically with all tables.

**Subsequent Runs**:
- Answer `y` to drop and recreate (⚠️ deletes all data)
- Answer `n` to keep existing database

### Step 5: Setup Ollama Models

The deployment script will automatically setup Ollama models, but you can pre-download them:

```bash
# Pre-download the model (optional, saves time during first run)
ollama pull gemma3:latest
```

---

## Starting Development Environment

### Quick Start

```bash
# Make scripts executable (first time only)
chmod +x deploy-dev.sh stop-dev.sh setup-ollama-dev.sh

# Start all development services
./deploy-dev.sh
```

### What Happens During Startup

The `deploy-dev.sh` script performs these steps automatically:

1. **Pre-flight Checks**
   - Verifies all ports are available (1000, 5000-6002, 12434-12435)
   - Checks Python and Node dependencies
   - Verifies SQLite database location

2. **Starts Ollama Instances**
   - Ollama 1 (Personal Assistant): Port 12434
   - Ollama 2 (Career Agent): Port 12435
   - Automatically downloads `gemma3:latest` model if needed

3. **Starts Backend Services**
   - Backend API: Port 5000
   - Personal Assistant: Port 6001
   - Career Agent: Port 6002
   - All services log to `.dev-pids/*.log`

4. **Starts Frontend**
   - React dev server: Port 1000
   - Auto-creates `frontend/.env.development.local` with correct backend URLs
   - Runs in foreground with hot reload

### Access Your Application

Once started, access your services at:

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:1000 | Main application UI |
| **Backend API** | http://localhost:5000/docs | FastAPI Swagger docs |
| **Personal Assistant** | http://localhost:6001/api/chat/health | Health check |
| **Career Agent** | http://localhost:6002/api/chat/health | Health check |
| **Ollama 1** | http://localhost:12434/api/tags | List models |
| **Ollama 2** | http://localhost:12435/api/tags | List models |

### SSH Port Forwarding (Optional, for Remote Development)

If developing on a remote server and want to access services from your local browser:

```bash
# Forward all development ports to your local machine
ssh -L 1000:localhost:1000 \
    -L 5000:localhost:5000 \
    -L 6001:localhost:6001 \
    -L 6002:localhost:6002 \
    -L 12434:localhost:12434 \
    -L 12435:localhost:12435 \
    user@your-remote-server
```

Then access http://localhost:1000 on your local browser.

**Note**: Skip this step if developing locally - just use http://localhost:1000 directly.

---

## Testing Features

### 1. Email Verification Bypass (Development Only)

In development mode, OTP codes are **printed to console** instead of being sent via email.

#### Test Registration Flow

**Step 1**: Open browser and navigate to http://localhost:1000

**Step 2**: Open a new terminal to monitor backend logs:
```bash
# Watch for OTP codes in real-time
tail -f .dev-pids/backend.log | grep -A 5 "OTP GENERATED"
```

**Step 3**: Register a new account:
1. Click "Sign Up"
2. Fill in the form:
   - Username: `testuser123`
   - Email: `test@example.com`
   - Password: `YourPassword123`
3. Click "Register"

**Step 4**: Get OTP from console

Check the terminal running `tail -f`. You should see:

```
============================================================
🔐 DEVELOPMENT MODE - OTP GENERATED
============================================================
📧 Email: test@example.com
🎯 Purpose: registration
🔑 OTP Code: 123456
⏰ Valid for: 5 minutes
============================================================
```

**Step 5**: Enter the OTP code in the verification form

**Step 6**: Account activated! You can now log in.

#### Test Password Reset

1. Click "Forgot Password"
2. Enter your email
3. OTP will be printed to console with purpose: `password_reset`
4. Copy and enter the OTP
5. Set new password

### 2. Career Agent Resume Analysis

```bash
# Test Career Agent streaming analysis
curl -X POST http://localhost:6002/api/streaming/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "resume_path": "/path/to/resume.pdf"
  }'
```

### 3. Personal Assistant Chat

```bash
# Test Personal Assistant chat
curl -X POST http://localhost:6001/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "message": "Hello, how are you?"
  }'
```

---

## Stop Development Environment Safely

### Quick Stop

```bash
# Stop all development services
./stop-dev.sh
```

### What Happens During Shutdown

The `stop-dev.sh` script safely stops all services using a **three-stage shutdown process**:

#### Stage 1: PID-Based Service Shutdown (Primary Method)

The script reads PID files from `.dev-pids/` and stops each service gracefully:

```
1. SIGTERM (graceful shutdown) → Wait 10 seconds
2. SIGINT (interrupt signal)   → Wait 3 seconds
3. SIGKILL (force kill)         → Only as last resort
```

Services stopped:
- Frontend (React dev server)
- Backend API
- Personal Assistant
- Career Agent
- Ollama 1
- Ollama 2

#### Stage 2: Port-Based Cleanup (Safety Net)

If any processes are still running on development ports, the script:

1. **Scans development ports**: 5000, 6001, 6002, 1000, 12434, 12435
2. **Verifies process identity**: Only considers processes that match:
   - Command name: `python`, `node`, `ollama`, `uvicorn`, `npm`
   - Command line contains: `uvicorn`, `ollama`, `react-scripts`, `backend`, `personal_assistant`, `career`
3. **Skips system processes**: Automatically skips:
   - `sshd` (SSH daemon - **protects VSCode Remote-SSH!**)
   - `systemd`, `dbus`, `cron`, `getty`
   - `docker-proxy`, `dockerd`, `containerd` (Docker processes)
4. **Asks for confirmation**: Shows process details and asks before killing

#### Stage 3: Cleanup

- Removes PID files
- Optionally deletes log files (asks for confirmation)
- Removes `frontend/.env.development.local`
- Removes `.dev-pids/` directory if empty

### Interactive Prompts

```bash
# During shutdown, you might see:
⚠️  Found process on dev port 5000 (PID: 12345)
    Process: python
    Command: python3 -m uvicorn backend.main:app...
    Kill this process? (y/N):

# And at the end:
Do you want to delete log files? (y/N):
```

### Why This Prevents SSH Connection Crashes

The improved `stop-dev.sh` script prevents VSCode Remote-SSH crashes by:

1. **PID-Based Tracking**: Uses PID files instead of aggressive port scanning
2. **Process Verification**: Verifies process identity before killing
3. **Graceful Shutdown**: Uses SIGTERM first, allowing proper cleanup
4. **System Process Protection**: Skips SSH, systemd, and Docker processes
5. **User Confirmation**: Asks before killing any ambiguous process

**Result**: Your VSCode Remote-SSH connection remains stable! 🎉

---

## Troubleshooting

### Issue 1: Port Conflicts

**Symptom**: `Error: Port 5000 (Backend) is already in use!`

**Solution**:
```bash
# Check what's using the port
lsof -i :5000

# If it's an old dev process, stop all services
./stop-dev.sh

# Or manually kill the process
kill $(lsof -ti:5000)
```

### Issue 2: OTP Not Showing in Console

**Check 1**: Verify backend is running
```bash
curl http://localhost:5000/docs
```

**Check 2**: Verify ENVIRONMENT variable
```bash
grep "ENVIRONMENT=" .env.dev
# Should show: ENVIRONMENT=development
```

**Check 3**: Monitor backend logs
```bash
tail -50 .dev-pids/backend.log
```

### Issue 3: Frontend Can't Connect to Backend

**Check 1**: Verify `.env.development.local` was created
```bash
cat frontend/.env.development.local
# Should show: REACT_APP_BACKEND_URL=http://localhost:5000
```

**Check 2**: Restart frontend
```bash
cd frontend
PORT=1000 npm start
```

### Issue 4: Ollama Models Not Found

**Solution**: Manually pull the model
```bash
# For Ollama 1 (port 12434)
OLLAMA_HOST="localhost:12434" ollama pull gemma3:latest

# For Ollama 2 (port 12435)
OLLAMA_HOST="localhost:12435" ollama pull gemma3:latest

# Or run the setup script
./setup-ollama-dev.sh
```

### Issue 5: SQLite Database Missing or Corrupted

**Symptom**: `no such table: users` or database errors

**Solution**: Recreate the database with all tables
```bash
# Stop all services first
./stop-dev.sh

# Recreate database (interactive mode)
python backend/scripts/create_tables.py

# Or force recreate (deletes all data)
python backend/scripts/create_tables.py --force

# Restart services
./deploy-dev.sh
```

### Issue 6: SQLite Database Locked

**Symptom**: `database is locked` error

**Solution**:
```bash
# Stop all services
./stop-dev.sh

# Remove lock file
rm -f backend/db/app.db-shm backend/db/app.db-wal

# Restart services
./deploy-dev.sh
```

### Issue 7: VSCode Remote-SSH Connection Crashes

**If this happens**:

1. **Reconnect to SSH**: `Ctrl+Shift+P` → "Remote-SSH: Reconnect"
2. **Check running processes**:
   ```bash
   ps aux | grep -E "(python|node|ollama|uvicorn)"
   ```
3. **Safely stop development services**:
   ```bash
   ./stop-dev.sh
   # Answer 'N' to any suspicious processes
   ```

**Prevention**: Always use `./stop-dev.sh` instead of manually killing processes!

### Issue 8: "ERR_UNSAFE_PORT" Error in Browser

**Symptom**: Chrome blocks port 6000 with "ERR_UNSAFE_PORT"

**Solution**: This is already fixed! Backend uses port 5000 (not 6000) to avoid Chrome's unsafe port restriction.

If you encounter this on other ports, change the port in `.env.dev`:
```bash
# Edit .env.dev
BACKEND_PORT=5000  # Use ports that are not in Chrome's blocklist
```

---

## Best Practices

### 1. Always Use Scripts for Service Management

✅ **Good Practice**:
```bash
./deploy-dev.sh   # Start services
./stop-dev.sh     # Stop services
```

❌ **Bad Practice**:
```bash
kill $(lsof -ti:5000)  # Can kill wrong processes
kill -9 <PID>          # No graceful shutdown
```

### 2. Monitor Logs During Development

```bash
# Open multiple terminals to monitor different services
Terminal 1: tail -f .dev-pids/backend.log
Terminal 2: tail -f .dev-pids/pa.log
Terminal 3: tail -f .dev-pids/career.log
Terminal 4: cd frontend && PORT=1000 npm start
```

### 3. Keep Development and Deployment Separate

- **Development**: Use `./deploy-dev.sh` (ports 1000, 5000-6002, 12434-12435)
- **Deployment**: Use `./deploy-staging.sh` (Docker containers, ports 80/443, 8000-8002)

Both can run simultaneously without conflicts!

### 4. Use VSCode Multi-Root Workspaces

```json
// workspace.code-workspace
{
  "folders": [
    { "path": "backend" },
    { "path": "frontend" },
    { "path": "modules/agents/career" }
  ],
  "settings": {
    "python.defaultInterpreterPath": "/usr/bin/python3"
  }
}
```

### 5. Setup SSH Keep-Alive (For Remote Development)

Prevent SSH disconnections on long-running remote sessions:

```bash
# In your local ~/.ssh/config
Host my-dev-server
    HostName <YOUR_SERVER_IP>
    User <YOUR_USERNAME>
    ServerAliveInterval 60
    ServerAliveCountMax 10
```

**Note**: Not needed for local development.

### 6. Regular Cleanup

```bash
# Clean up old logs (weekly)
rm -f .dev-pids/*.log

# Clean up old PIDs if services crashed
rm -f .dev-pids/*.pid

# Rebuild dependencies if updated
cd frontend && npm install
pip install -r backend/requirements.txt
```

### 7. Database Management (Development)

**Backup your development SQLite database**:
```bash
# Create backup before major changes
cp backend/db/app.db backend/db/app.db.backup

# Restore if needed
cp backend/db/app.db.backup backend/db/app.db
```

**Reset database to fresh state**:
```bash
# Interactive mode (prompts before dropping)
python backend/scripts/create_tables.py

# Force mode (no prompts, deletes all data)
python backend/scripts/create_tables.py --force
```

**Check database structure**:
```bash
# View all tables
sqlite3 backend/db/app.db ".tables"

# View table schema
sqlite3 backend/db/app.db ".schema users"

# Count records
sqlite3 backend/db/app.db "SELECT COUNT(*) FROM users;"
```

---

## Port Reference

### Development Mode Ports

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Frontend | 1000 | HTTP | React dev server with hot reload |
| Backend | 5000 | HTTP | FastAPI main application |
| Personal Assistant | 6001 | HTTP | Chat API service |
| Career Agent | 6002 | HTTP | Resume analysis service |
| Ollama 1 (PA) | 12434 | HTTP | LLM for Personal Assistant |
| Ollama 2 (Career) | 12435 | HTTP | LLM for Career Agent |

### Deployment Mode Ports (Docker)

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Nginx | 80, 443 | HTTP/HTTPS | Reverse proxy and frontend |
| Backend | 8000 | HTTP | FastAPI (internal) |
| Personal Assistant | 8001 | HTTP | Chat API (internal) |
| Career Agent | 8002 | HTTP | Resume analysis (internal) |
| Ollama 1 | 11434 | HTTP | LLM container 1 |
| Ollama 2 | 11435 | HTTP | LLM container 2 |
| PostgreSQL | 5432 | TCP | Database |

---

## Security Considerations

### 1. Firewall Configuration

#### For Local Development
If developing on your local machine, no firewall changes needed (services bind to localhost).

#### For Remote/Cloud Development
Configure firewall to allow development ports from your IP only:

**Ubuntu/Debian (UFW)**:
```bash
# Allow development ports from your IP only
sudo ufw allow from YOUR_IP to any port 1000
sudo ufw allow from YOUR_IP to any port 5000
sudo ufw allow from YOUR_IP to any port 6001
sudo ufw allow from YOUR_IP to any port 6002
sudo ufw enable
```

**Cloud Platforms**:
```bash
# GCP
gcloud compute firewall-rules create allow-dev-ports \
  --allow tcp:1000,tcp:5000,tcp:6001,tcp:6002 \
  --source-ranges YOUR_IP/32 \
  --target-tags dev-instance

# AWS (Security Group)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --protocol tcp \
  --port 1000-6002 \
  --cidr YOUR_IP/32
```

**Best Practice**: Use SSH port forwarding instead of opening ports to the internet.

### 2. Environment Variables

Never commit sensitive data:
- `.env.dev` is gitignored ✅
- `.env.staging` is gitignored ✅
- `frontend/.env.development.local` is gitignored ✅

### 3. SQLite Database

Development SQLite database is gitignored:
```bash
# Verify it's ignored
git check-ignore backend/db/app.db
# Should output: backend/db/app.db
```

---

## Files Modified by Development Mode

### Automatically Created/Modified

1. **`.dev-pids/`** - Contains PID and log files
   - `backend.pid`, `backend.log`
   - `pa.pid`, `pa.log`
   - `career.pid`, `career.log`
   - `frontend.pid`, `frontend.log`
   - `ollama1.pid`, `ollama1.log`
   - `ollama2.pid`, `ollama2.log`

2. **`frontend/.env.development.local`** - Auto-generated frontend config
   - Points to development backend (port 5000)
   - Removed automatically by `stop-dev.sh`

3. **`backend/db/app.db`** - SQLite database
   - Auto-created on first backend start
   - Persists between restarts

### Configuration Files Used

- **`.env.dev`** - Development environment variables
- **`deploy-dev.sh`** - Start script
- **`stop-dev.sh`** - Stop script
- **`setup-ollama-dev.sh`** - Ollama setup script

---

## Summary

### ✅ Development Mode (`./deploy-dev.sh`)
- OTP printed to console (no emails sent)
- SQLite database for fast local testing
- Hot reload for frontend and backend
- Ports: 1000, 5000-6002, 12434-12435
- Safe shutdown with `./stop-dev.sh`
- VSCode Remote-SSH friendly

### ✅ Deployment Mode (`./deploy-staging.sh`)
- Real email sending via MailGun
- PostgreSQL database in containers
- HTTPS via nginx
- Ports: 80/443, 8000-8002, 11434-11435
- **Completely unaffected by development mode**

### 🎯 Key Benefits
- **Parallel execution**: Run both modes simultaneously
- **Port isolation**: No conflicts between modes
- **Safe shutdown**: Protects SSH connections
- **Fast iteration**: Hot reload, console OTP, local processes
- **Production parity**: Same codebase, different configs

---

## Quick Reference Commands

```bash
# Start development environment
./deploy-dev.sh

# Stop development environment
./stop-dev.sh

# Monitor logs
tail -f .dev-pids/backend.log
tail -f .dev-pids/pa.log
tail -f .dev-pids/career.log

# Check running services
ps aux | grep -E "(uvicorn|ollama|node|react-scripts)"

# Check ports
for port in 1000 5000 6001 6002 12434 12435; do
    echo "Port $port: $(lsof -i :$port | wc -l) processes"
done

# Rebuild dependencies
pip install -r backend/requirements.txt
cd frontend && npm install

# Setup Ollama models
./setup-ollama-dev.sh

# Database management
python backend/scripts/create_tables.py           # Create/reset database (interactive)
python backend/scripts/create_tables.py --force   # Force reset (deletes data)
sqlite3 backend/db/app.db ".tables"               # List tables
cp backend/db/app.db backend/db/app.db.backup     # Backup database

# Check deployment environment (should be unaffected)
docker ps
curl http://localhost:8000/docs  # Staging backend still works!
```

---

## Getting Help

If you encounter issues not covered in this guide:

1. **Check logs**: `.dev-pids/*.log`
2. **Verify configuration**: `.env.dev`
3. **Check port conflicts**: `lsof -i :<port>`
4. **Review recent changes**: `git diff`
5. **Restart from scratch**:
   ```bash
   ./stop-dev.sh
   rm -rf .dev-pids/
   ./deploy-dev.sh
   ```

For deployment issues, see [deployment documentation](../deployment/deployment_guide.md#troubleshooting).

---

**Happy Developing! 🚀**
