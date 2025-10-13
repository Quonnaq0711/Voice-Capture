#!/bin/bash

#
# PostgreSQL Database Initialization Script
# Product AI Assistant Platform
#
# This script initializes a fresh PostgreSQL database with all required tables
# Run this ONCE before first deployment to staging/production
#
# Usage:
#   ./scripts/init_postgres.sh [--container] [--force]
#
# Options:
#   --container    Run initialization inside Docker container (for staging/prod)
#   --force        Drop and recreate database (WARNING: destroys all data!)
#   --help         Show this help message
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
USE_CONTAINER=false
FORCE_RECREATE=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SQL_FILE="$SCRIPT_DIR/init_postgres.sql"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --container)
            USE_CONTAINER=true
            shift
            ;;
        --force)
            FORCE_RECREATE=true
            shift
            ;;
        --help)
            head -20 "$0" | grep "^#" | sed 's/^# //'
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${CYAN}"
echo "═══════════════════════════════════════════════════════════"
echo "  🗄️  PostgreSQL Database Initialization"
echo "═══════════════════════════════════════════════════════════"
echo -e "${NC}"

# Check if SQL file exists
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}❌ Error: SQL initialization file not found!${NC}"
    echo -e "Expected location: $SQL_FILE"
    exit 1
fi

echo -e "${BLUE}SQL file: $SQL_FILE${NC}"
echo -e "${BLUE}Mode: $([ "$USE_CONTAINER" = true ] && echo "Docker Container" || echo "Direct Connection")${NC}"
echo ""

# Function to execute SQL in container
execute_in_container() {
    local container_name="idii-db-staging"
    local db_name="${DB_NAME:-idii-staging}"
    local db_user="${DB_USER:-postgres}"

    echo -e "${BLUE}Executing SQL in Docker container: $container_name${NC}"

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        echo -e "${RED}❌ Error: Container '$container_name' is not running!${NC}"
        echo -e "${YELLOW}💡 Hint: Start containers with ./deploy-staging.sh${NC}"
        exit 1
    fi

    # Copy SQL file to container
    echo -e "${CYAN}📋 Copying SQL file to container...${NC}"
    docker cp "$SQL_FILE" "$container_name:/tmp/init_postgres.sql"

    if [ "$FORCE_RECREATE" = true ]; then
        echo -e "${YELLOW}⚠️  WARNING: --force flag detected!${NC}"
        echo -e "${YELLOW}⚠️  This will DROP and RECREATE the database, destroying ALL data!${NC}"
        read -p "Are you absolutely sure? Type 'yes' to continue: " -r
        echo
        if [[ ! $REPLY =~ ^yes$ ]]; then
            echo -e "${BLUE}❌ Aborted by user${NC}"
            exit 1
        fi

        echo -e "${RED}🗑️  Dropping database '$db_name'...${NC}"
        docker exec -it "$container_name" psql -U "$db_user" -c "DROP DATABASE IF EXISTS \"$db_name\";"

        echo -e "${GREEN}🆕 Creating fresh database '$db_name'...${NC}"
        docker exec -it "$container_name" psql -U "$db_user" -c "CREATE DATABASE \"$db_name\";"
    fi

    # Execute SQL file
    echo -e "${CYAN}🔧 Executing SQL initialization script...${NC}"
    docker exec -it "$container_name" psql -U "$db_user" -d "$db_name" -f /tmp/init_postgres.sql

    # Cleanup
    docker exec "$container_name" rm -f /tmp/init_postgres.sql

    echo -e "${GREEN}✅ Database initialized successfully in container!${NC}"
}

# Function to execute SQL directly
execute_directly() {
    # Load environment variables
    if [ -f "$PROJECT_ROOT/.env.staging" ]; then
        set -a
        source <(grep -v '^#' "$PROJECT_ROOT/.env.staging" | grep -v '^$')
        set +a
        echo -e "${GREEN}✓ Loaded .env.staging${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: .env.staging not found, using defaults${NC}"
    fi

    local db_host="${DB_HOST:-localhost}"
    local db_port="${DB_PORT:-5432}"
    local db_name="${DB_NAME:-idii-staging}"
    local db_user="${DB_USER:-postgres}"

    echo -e "${BLUE}Connection details:${NC}"
    echo -e "  Host: $db_host"
    echo -e "  Port: $db_port"
    echo -e "  Database: $db_name"
    echo -e "  User: $db_user"
    echo ""

    # Check if psql is installed
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ Error: psql is not installed!${NC}"
        echo -e "${YELLOW}💡 Install PostgreSQL client:${NC}"
        echo -e "  sudo apt install postgresql-client"
        exit 1
    fi

    # Test connection
    echo -e "${CYAN}🔍 Testing database connection...${NC}"
    if ! PGPASSWORD="${DB_PASSWORD}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "SELECT 1;" > /dev/null 2>&1; then
        echo -e "${RED}❌ Error: Cannot connect to PostgreSQL server!${NC}"
        echo -e "${YELLOW}💡 Check:${NC}"
        echo -e "  1. PostgreSQL is running"
        echo -e "  2. DB_HOST, DB_PORT, DB_USER, DB_PASSWORD in .env.staging"
        echo -e "  3. Firewall allows connection to port $db_port"
        exit 1
    fi
    echo -e "${GREEN}✓ Connection successful!${NC}"
    echo ""

    if [ "$FORCE_RECREATE" = true ]; then
        echo -e "${YELLOW}⚠️  WARNING: --force flag detected!${NC}"
        echo -e "${YELLOW}⚠️  This will DROP and RECREATE the database, destroying ALL data!${NC}"
        read -p "Are you absolutely sure? Type 'yes' to continue: " -r
        echo
        if [[ ! $REPLY =~ ^yes$ ]]; then
            echo -e "${BLUE}❌ Aborted by user${NC}"
            exit 1
        fi

        echo -e "${RED}🗑️  Dropping database '$db_name'...${NC}"
        PGPASSWORD="${DB_PASSWORD}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "DROP DATABASE IF EXISTS \"$db_name\";"

        echo -e "${GREEN}🆕 Creating fresh database '$db_name'...${NC}"
        PGPASSWORD="${DB_PASSWORD}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d postgres -c "CREATE DATABASE \"$db_name\";"
    fi

    # Execute SQL file
    echo -e "${CYAN}🔧 Executing SQL initialization script...${NC}"
    PGPASSWORD="${DB_PASSWORD}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -f "$SQL_FILE"

    echo -e "${GREEN}✅ Database initialized successfully!${NC}"
}

# Function to verify database schema
verify_schema() {
    echo ""
    echo -e "${CYAN}🔍 Verifying database schema...${NC}"

    local tables=(
        "users"
        "user_profiles"
        "resumes"
        "career_insights"
        "chat_sessions"
        "chat_messages"
        "user_activities"
        "daily_recommendations"
    )

    if [ "$USE_CONTAINER" = true ]; then
        local container_name="idii-db-staging"
        local db_name="${DB_NAME:-idii-staging}"
        local db_user="${DB_USER:-postgres}"

        echo -e "${BLUE}Checking tables in container...${NC}"
        for table in "${tables[@]}"; do
            if docker exec "$container_name" psql -U "$db_user" -d "$db_name" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table');" | grep -q "t"; then
                echo -e "  ${GREEN}✓${NC} $table"
            else
                echo -e "  ${RED}✗${NC} $table ${RED}(missing)${NC}"
            fi
        done
    else
        local db_host="${DB_HOST:-localhost}"
        local db_port="${DB_PORT:-5432}"
        local db_name="${DB_NAME:-idii-staging}"
        local db_user="${DB_USER:-postgres}"

        echo -e "${BLUE}Checking tables...${NC}"
        for table in "${tables[@]}"; do
            if PGPASSWORD="${DB_PASSWORD}" psql -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='$table');" | grep -q "t"; then
                echo -e "  ${GREEN}✓${NC} $table"
            else
                echo -e "  ${RED}✗${NC} $table ${RED}(missing)${NC}"
            fi
        done
    fi

    echo ""
    echo -e "${GREEN}✅ Schema verification complete!${NC}"
}

# Main execution
if [ "$USE_CONTAINER" = true ]; then
    execute_in_container
else
    execute_directly
fi

# Verify schema
verify_schema

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ PostgreSQL Database Initialization Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo -e "  1. Start your application: ${YELLOW}./deploy-staging.sh${NC}"
echo -e "  2. Verify API health: ${YELLOW}curl http://localhost:8000/docs${NC}"
echo -e "  3. Create your first user via registration endpoint"
echo ""
echo -e "${BLUE}Database info:${NC}"
echo -e "  Tables: 8 (users, profiles, resumes, insights, sessions, messages, activities, recommendations)"
echo -e "  Indexes: Auto-created for optimal query performance"
echo -e "  Triggers: Auto-update timestamps on all tables"
echo ""
