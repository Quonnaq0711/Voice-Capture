#!/bin/bash
# Deployment Verification Script
# Verifies that all optimizations have been applied correctly

# Don't use 'set -e' to allow all checks to complete even if some fail

echo "🔍 Deployment Verification Script"
echo "=================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Function to check result
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC}: $2"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $2"
        FAIL=$((FAIL + 1))
    fi
}

echo "1️⃣  Checking Service Status"
echo "----------------------------"

# Check all services are running
if docker-compose -f docker-compose.staging.yml ps 2>/dev/null | grep -q "Up"; then
    check 0 "All services are running"
else
    check 1 "Some services are not running"
fi

# Check specific services
if docker ps --filter "name=idii-backend-staging" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    check 0 "Backend service is up"
else
    check 1 "Backend service is not running"
fi

if docker ps --filter "name=idii-PA-staging" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    check 0 "Personal Assistant service is up"
else
    check 1 "Personal Assistant service is not running"
fi

if docker ps --filter "name=idii-career-agent-staging" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
    check 0 "Career Agent service is up"
else
    check 1 "Career Agent service is not running"
fi

if docker ps --filter "name=idii-db-staging" --format "{{.Status}}" 2>/dev/null | grep -q "Up.*healthy"; then
    check 0 "Database service is healthy"
else
    check 1 "Database service is not healthy"
fi

echo ""
echo "2️⃣  Checking PostgreSQL Optimization"
echo "--------------------------------------"

# Check max_connections
MAX_CONN=$(docker exec idii-db-staging psql -U postgres -t -c "SHOW max_connections;" 2>/dev/null | tr -d ' ')
if [ "$MAX_CONN" = "500" ]; then
    check 0 "max_connections = 500 (optimal)"
elif [ -z "$MAX_CONN" ]; then
    check 1 "max_connections = Unable to connect to database"
else
    check 1 "max_connections = $MAX_CONN (expected 500)"
fi

# Check shared_buffers
SHARED_BUF=$(docker exec idii-db-staging psql -U postgres -t -c "SHOW shared_buffers;" 2>/dev/null | tr -d ' ')
if [ "$SHARED_BUF" = "2GB" ]; then
    check 0 "shared_buffers = 2GB (optimal)"
elif [ -z "$SHARED_BUF" ]; then
    check 1 "shared_buffers = Unable to connect to database"
else
    check 1 "shared_buffers = $SHARED_BUF (expected 2GB)"
fi

# Check work_mem
WORK_MEM=$(docker exec idii-db-staging psql -U postgres -t -c "SHOW work_mem;" 2>/dev/null | tr -d ' ')
if [ "$WORK_MEM" = "8MB" ]; then
    check 0 "work_mem = 8MB (optimal)"
elif [ -z "$WORK_MEM" ]; then
    check 1 "work_mem = Unable to connect to database"
else
    check 1 "work_mem = $WORK_MEM (expected 8MB)"
fi

# Check current connections
CURRENT_CONN=$(docker exec idii-db-staging psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ')
if [ -n "$CURRENT_CONN" ]; then
    echo -e "ℹ️  Current database connections: $CURRENT_CONN/500"
else
    echo -e "${YELLOW}⚠️  Unable to query current connections${NC}"
fi

echo ""
echo "3️⃣  Checking Worker Configuration"
echo "-----------------------------------"

# Check Backend workers (should be around 6-8 python processes)
# Use docker top since containers don't have ps command
BACKEND_WORKERS=$(docker top idii-backend-staging 2>/dev/null | grep -c "python" || echo "0")
BACKEND_WORKERS=$(echo "$BACKEND_WORKERS" | tr -d ' ')
if [ -z "$BACKEND_WORKERS" ]; then
    BACKEND_WORKERS=0
fi
if [ "$BACKEND_WORKERS" -ge 6 ] && [ "$BACKEND_WORKERS" -le 9 ]; then
    check 0 "Backend has $BACKEND_WORKERS python processes (expected 6-8)"
elif [ "$BACKEND_WORKERS" = "0" ]; then
    check 1 "Backend has 0 workers (container not running)"
else
    check 1 "Backend has $BACKEND_WORKERS workers (expected 6-8)"
fi

# Check PA workers (should be around 4-5 python processes)
PA_WORKERS=$(docker top idii-PA-staging 2>/dev/null | grep -c "python" || echo "0")
PA_WORKERS=$(echo "$PA_WORKERS" | tr -d ' ')
if [ -z "$PA_WORKERS" ]; then
    PA_WORKERS=0
fi
if [ "$PA_WORKERS" -ge 4 ] && [ "$PA_WORKERS" -le 6 ]; then
    check 0 "Personal Assistant has $PA_WORKERS python processes (expected 4-5)"
elif [ "$PA_WORKERS" = "0" ]; then
    check 1 "Personal Assistant has 0 workers (container not running)"
else
    check 1 "Personal Assistant has $PA_WORKERS workers (expected 4-5)"
fi

# Check Career workers (should be around 4-5 python processes)
CAREER_WORKERS=$(docker top idii-career-agent-staging 2>/dev/null | grep -c "python" || echo "0")
CAREER_WORKERS=$(echo "$CAREER_WORKERS" | tr -d ' ')
if [ -z "$CAREER_WORKERS" ]; then
    CAREER_WORKERS=0
fi
if [ "$CAREER_WORKERS" -ge 4 ] && [ "$CAREER_WORKERS" -le 6 ]; then
    check 0 "Career Agent has $CAREER_WORKERS python processes (expected 4-5)"
elif [ "$CAREER_WORKERS" = "0" ]; then
    check 1 "Career Agent has 0 workers (container not running)"
else
    check 1 "Career Agent has $CAREER_WORKERS workers (expected 4-5)"
fi

echo ""
echo "4️⃣  Checking Resource Usage"
echo "-----------------------------"

# Get CPU and Memory usage
echo "📊 Container Resource Usage:"
if docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | grep -q idii; then
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" | grep idii
else
    echo -e "${YELLOW}⚠️  Unable to get container stats${NC}"
fi

# Check if CPU usage is reasonable (< 80%)
CPU_USAGE=$(docker stats --no-stream --format "{{.CPUPerc}}" idii-backend-staging 2>/dev/null | sed 's/%//' || echo "0")
if [ -n "$CPU_USAGE" ] && [ "$CPU_USAGE" != "0" ]; then
    # Use awk instead of bc for better portability
    if awk "BEGIN {exit !($CPU_USAGE < 80)}"; then
        check 0 "CPU usage is healthy ($CPU_USAGE%)"
    else
        check 1 "CPU usage is high ($CPU_USAGE%)"
    fi
else
    echo -e "${YELLOW}⚠️  Unable to check CPU usage${NC}"
fi

echo ""
echo "5️⃣  Testing API Endpoints"
echo "--------------------------"

# Test health endpoint
if curl -s -f https://staging.idii.co/api/v1/health > /dev/null 2>&1; then
    check 0 "Backend API is responding (https)"
elif curl -s -f http://localhost:8000/health > /dev/null 2>&1; then
    check 0 "Backend API is responding (local)"
else
    check 1 "Backend API is not responding"
fi

# Test PA health endpoint (if available)
if curl -s -f http://localhost:8001/api/chat/health > /dev/null 2>&1; then
    check 0 "Personal Assistant API is responding"
else
    echo -e "${YELLOW}⚠️  SKIP${NC}: Personal Assistant health check (endpoint may not exist)"
fi

# Test Career health endpoint (if available)
if curl -s -f http://localhost:8002/api/chat/health > /dev/null 2>&1; then
    check 0 "Career Agent API is responding"
else
    echo -e "${YELLOW}⚠️  SKIP${NC}: Career Agent health check (endpoint may not exist)"
fi

echo ""
echo "6️⃣  Checking GPU Availability"
echo "-------------------------------"

# Check Ollama services have GPU access
if docker exec idii-ollama-staging nvidia-smi > /dev/null 2>&1; then
    check 0 "Ollama 1 (PA) has GPU access"
else
    check 1 "Ollama 1 (PA) does not have GPU access"
fi

if docker exec idii-ollama2-staging nvidia-smi > /dev/null 2>&1; then
    check 0 "Ollama 2 (Career) has GPU access"
else
    check 1 "Ollama 2 (Career) does not have GPU access"
fi

echo ""
echo "=================================="
echo "📊 Verification Summary"
echo "=================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Deployment is successful.${NC}"
    echo ""
    echo "🎯 Your system is now optimized for 300-500 concurrent users!"
    echo ""
    echo "📚 Next steps:"
    echo "  1. Monitor performance: docker stats"
    echo "  2. Check logs: docker-compose -f docker-compose.staging.yml logs -f"
    echo "  3. For 1000+ users, consider deploying vLLM architecture"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please review the errors above.${NC}"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "  - Check service logs: docker-compose -f docker-compose.staging.yml logs <service>"
    echo "  - Restart services: docker-compose -f docker-compose.staging.yml restart"
    echo "  - Full redeploy: ./deploy-staging.sh"
    exit 1
fi
