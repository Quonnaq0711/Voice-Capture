# PostgreSQL Database Initialization Guide

## Overview

This guide explains how to initialize a fresh PostgreSQL database for the Product AI Assistant Platform. The initialization script creates all required tables, indexes, foreign keys, and triggers.

---

## Files

- **`scripts/init_postgres.sql`** - SQL DDL script with all table definitions
- **`scripts/init_postgres.sh`** - Bash wrapper script for easy execution

---

## Database Schema

### Tables Created (8 total)

| Table | Description | Key Fields |
|-------|-------------|------------|
| `users` | User authentication and accounts | username, email, hashed_password, OTP fields |
| `user_profiles` | Extended user profile for all AI agents | Career, Money, Body, Travel, Mind, Family, Hobby, Knowledge, Spiritual fields |
| `resumes` | User resume uploads and metadata | filename, file_path, user_id |
| `career_insights` | Career insights from resume analysis | professional_data (JSON), dashboard_summaries (JSON) |
| `chat_sessions` | Chat session management | session_name, first_message_time, is_active |
| `chat_messages` | Individual chat messages | message_text, sender, agent_type |
| `user_activities` | Activity tracking across platform | activity_type, activity_source, metadata (JSONB) |
| `daily_recommendations` | AI-generated daily insights | date, recommendations (JSONB), context_data (JSONB) |

### Features

- ✅ **Foreign Keys**: Proper referential integrity between tables
- ✅ **Indexes**: Optimized indexes on frequently queried columns
- ✅ **Triggers**: Auto-update `updated_at` timestamps on all tables
- ✅ **JSONB Support**: Flexible schema for complex data (recommendations, activities, profiles)
- ✅ **CASCADE Deletes**: Automatically clean up related data when users are deleted

---

## Usage

### Method 1: Docker Container (Recommended for Staging/Production)

This method initializes the database inside a running Docker container.

```bash
# Step 1: Start Docker containers (if not already running)
./deploy-staging.sh

# Step 2: Wait for database to be ready
docker logs idii-db-staging

# Step 3: Initialize database
./scripts/init_postgres.sh --container

# Expected output:
# ✅ Database initialized successfully in container!
# ✅ Schema verification complete!
```

**When to use**:
- First-time deployment to staging/production
- Running in containerized environment
- Database is managed by Docker Compose

### Method 2: Direct Connection (For External PostgreSQL)

This method connects directly to PostgreSQL (local or remote).

```bash
# Prerequisites:
# - PostgreSQL client (psql) installed
# - .env.staging configured with DB credentials

# Initialize database
./scripts/init_postgres.sh

# Expected output:
# ✓ Connection successful!
# ✅ Database initialized successfully!
# ✅ Schema verification complete!
```

**When to use**:
- Using external PostgreSQL server (RDS, Cloud SQL, etc.)
- PostgreSQL running on host machine (not Docker)
- Need to initialize database from CI/CD pipeline

### Method 3: Manual Execution

For maximum control, execute SQL directly:

```bash
# Inside Docker container
docker exec -it idii-db-staging psql -U postgres -d idii-staging -f /path/to/init_postgres.sql

# Or directly with psql
psql -h localhost -U postgres -d idii-staging -f scripts/init_postgres.sql
```

---

## Options

### `--container`

Run initialization inside Docker container.

```bash
./scripts/init_postgres.sh --container
```

**Behavior**:
- Detects container name: `idii-db-staging`
- Copies SQL file to container
- Executes SQL via `docker exec`
- Verifies tables were created

### `--force` ⚠️ DANGEROUS!

Drop and recreate the database (destroys all data).

```bash
./scripts/init_postgres.sh --force
```

**⚠️ WARNING**:
- This will **permanently delete ALL data** in the database
- Cannot be undone
- Requires manual confirmation (type 'yes')
- Use only for:
  - Testing environments
  - Fresh installations
  - Recovery from corrupted database

**Example**:
```bash
$ ./scripts/init_postgres.sh --container --force
⚠️  WARNING: --force flag detected!
⚠️  This will DROP and RECREATE the database, destroying ALL data!
Are you absolutely sure? Type 'yes' to continue: yes
🗑️  Dropping database 'idii-staging'...
🆕 Creating fresh database 'idii-staging'...
✅ Database initialized successfully!
```

### `--help`

Show help message and usage information.

```bash
./scripts/init_postgres.sh --help
```

---

## Verification

After initialization, the script automatically verifies the schema:

```
🔍 Verifying database schema...
Checking tables in container...
  ✓ users
  ✓ user_profiles
  ✓ resumes
  ✓ career_insights
  ✓ chat_sessions
  ✓ chat_messages
  ✓ user_activities
  ✓ daily_recommendations

✅ Schema verification complete!
```

### Manual Verification

Check tables manually:

```bash
# Inside Docker container
docker exec -it idii-db-staging psql -U postgres -d idii-staging

# Or directly
psql -h localhost -U postgres -d idii-staging

# List all tables
\dt

# Describe a specific table
\d users

# Check indexes
\di

# Check foreign keys
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE contype = 'f';
```

---

## Troubleshooting

### Issue 1: Container Not Running

**Error**:
```
❌ Error: Container 'idii-db-staging' is not running!
```

**Solution**:
```bash
# Start containers
./deploy-staging.sh

# Verify container is running
docker ps | grep idii-db-staging
```

### Issue 2: Cannot Connect to Database

**Error**:
```
❌ Error: Cannot connect to PostgreSQL server!
```

**Check**:
1. PostgreSQL is running: `docker ps` or `systemctl status postgresql`
2. Environment variables in `.env.staging`:
   ```bash
   DB_HOST=db-staging  # or localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=your_password
   DB_NAME=idii-staging
   ```
3. Firewall allows port 5432: `sudo ufw status`
4. Test connection:
   ```bash
   docker exec -it idii-db-staging psql -U postgres -c "SELECT 1;"
   ```

### Issue 3: psql Not Installed

**Error**:
```
❌ Error: psql is not installed!
```

**Solution**:
```bash
# Ubuntu/Debian
sudo apt install postgresql-client

# macOS
brew install postgresql

# Verify
psql --version
```

### Issue 4: Permission Denied

**Error**:
```
permission denied for database idii-staging
```

**Solution**:
```bash
# Check database permissions
docker exec -it idii-db-staging psql -U postgres -c "\l"

# Grant permissions
docker exec -it idii-db-staging psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE \"idii-staging\" TO postgres;"
```

### Issue 5: Tables Already Exist

**Symptom**: Script completes but says "already exists"

**This is normal!** The SQL script uses `CREATE TABLE IF NOT EXISTS`, so it's safe to run multiple times. It will:
- ✅ Skip creating tables that already exist
- ✅ Create missing tables if any
- ✅ Re-create triggers (using `DROP TRIGGER IF EXISTS` first)

**To force fresh installation**:
```bash
./scripts/init_postgres.sh --container --force
```

---

## Database Maintenance

### Backup Database

```bash
# Backup to file
./scripts/backup_postgres.sh

# Or manually
docker exec idii-db-staging pg_dump -U postgres idii-staging > backup.sql
```

### Restore Database

```bash
# From backup file
docker exec -i idii-db-staging psql -U postgres -d idii-staging < backup.sql
```

### Check Database Size

```bash
docker exec -it idii-db-staging psql -U postgres -d idii-staging -c "
SELECT
    pg_size_pretty(pg_database_size('idii-staging')) as size;
"
```

### Check Table Sizes

```bash
docker exec -it idii-db-staging psql -U postgres -d idii-staging -c "
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## Migration from SQLite to PostgreSQL

If migrating from development (SQLite) to production (PostgreSQL):

### Step 1: Export SQLite Data

```bash
# Install sqlite3
sudo apt install sqlite3

# Export tables
sqlite3 backend/db/app.db .dump > sqlite_dump.sql
```

### Step 2: Initialize PostgreSQL

```bash
./scripts/init_postgres.sh --container
```

### Step 3: Convert and Import Data

```bash
# SQLite and PostgreSQL have slightly different SQL syntax
# Use a migration tool like pgloader:

sudo apt install pgloader

# Create pgloader config
cat > migrate.load << EOF
LOAD DATABASE
     FROM sqlite://backend/db/app.db
     INTO postgresql://postgres:password@localhost/idii-staging

WITH include drop, create tables, create indexes, reset sequences

SET work_mem to '16MB', maintenance_work_mem to '512 MB';
EOF

# Run migration
pgloader migrate.load
```

**Note**: Manual data migration may be required depending on schema differences.

---

## Integration with Deployment

### Add to Deployment Checklist

Update the deployment guide as needed.

```markdown
## Pre-Deployment Steps

1. ✅ Initialize PostgreSQL database (FIRST TIME ONLY):
   ```bash
   ./scripts/init_postgres.sh --container
   ```

2. ✅ Verify database schema:
   ```bash
   docker exec -it idii-db-staging psql -U postgres -d idii-staging -c "\dt"
   ```

3. ✅ Start all services:
   ```bash
   ./deploy-staging.sh
   ```
```

### Automated Deployment Script

You can modify `deploy-staging.sh` to check if database is initialized:

```bash
# Check if database is initialized
if docker exec idii-db-staging psql -U postgres -d idii-staging -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users');" | grep -q "f"; then
    echo "⚠️  Database not initialized! Run: ./scripts/init_postgres.sh --container"
    exit 1
fi
```

---

## Security Considerations

### 1. Credentials Management

Never commit database credentials to Git:

```bash
# .gitignore should include:
.env.staging
.env.prod
*.sql.backup
```

### 2. Database User Permissions

Create separate users for applications:

```sql
-- Create application user with limited permissions
CREATE USER idii_app WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE "idii-staging" TO idii_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO idii_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO idii_app;
```

### 3. Connection Security

Use SSL connections in production:

```python
# backend/db/database.py
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"sslmode": "require"}  # Force SSL
)
```

---

## Summary

### Quick Reference

| Task | Command |
|------|---------|
| Initialize DB (Docker) | `./scripts/init_postgres.sh --container` |
| Initialize DB (Direct) | `./scripts/init_postgres.sh` |
| Force recreate DB | `./scripts/init_postgres.sh --container --force` |
| Verify tables | `docker exec -it idii-db-staging psql -U postgres -d idii-staging -c "\dt"` |
| Backup DB | `./scripts/backup_postgres.sh` |
| Check DB size | See "Check Database Size" above |

### Schema Summary

- **8 tables** with full relationships
- **20+ indexes** for query optimization
- **8 triggers** for auto-updating timestamps
- **JSONB fields** for flexible data storage
- **Foreign keys** with CASCADE deletes

---

## Next Steps

After database initialization:

1. ✅ Start application services: `./deploy-staging.sh`
2. ✅ Verify API health: `curl http://localhost:8000/docs`
3. ✅ Create first user via registration endpoint
4. ✅ Setup database backup cron job: `./scripts/backup_postgres.sh`
5. ✅ Monitor database performance and size

---

**Questions or Issues?**

Check the troubleshooting section or review database logs:
```bash
docker logs idii-db-staging --tail 50
```
