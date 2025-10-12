# File Upload Testing Guide

## Overview
The system is configured to use persistent storage for all user-uploaded files (resumes and avatars) and PostgreSQL database. Files are stored in separate subdirectories organized by user ID.

## Persistent Storage Configuration

### Storage Location
All user-uploaded files and database are stored on the GCP VM at:

```
/home/idii/data/
├── user-uploads/
│   ├── resumes/
│   │   ├── 1/          # Resumes for user ID 1
│   │   ├── 2/          # Resumes for user ID 2
│   │   └── ...
│   └── avatars/
│       ├── 1/          # Avatars for user ID 1
│       ├── 2/          # Avatars for user ID 2
│       └── ...
├── postgres-staging/       # PostgreSQL database files
│   ├── base/               # Database cluster base directory
│   ├── global/             # Cluster-wide tables
│   ├── pg_wal/             # Write-ahead logs
│   └── ...                 # Other PostgreSQL system files
└── database/               # SQLite backup (migration reference, read-only)
    └── app.db              # Original SQLite database (kept for reference)
```

### Docker Volume Mounts
The following volumes are configured in `docker-compose.staging.yml`:

**Backend and Career Agent:**
```yaml
volumes:
  # User uploads - read/write access
  - /home/idii/data/user-uploads/resumes:/app/resumes
  - /home/idii/data/user-uploads/avatars:/app/avatars
  # SQLite backup - read-only access (migration reference)
  - /home/idii/data/database:/app/db-backup:ro
```

**PostgreSQL Database:**
```yaml
volumes:
  # PostgreSQL data persistence
  - /home/idii/data/postgres-staging:/var/lib/postgresql/data
```

## Testing Steps

### 1. Test Resume Upload

1. Log in to https://staging.idii.co
2. Navigate to Career Agent page
3. Click "Upload Document" button
4. Select a PDF or TXT file to upload
5. After successful upload, verify the file is stored correctly:

```bash
# Execute on the VM
ls -la /home/idii/data/user-uploads/resumes/[USER_ID]/
```

### 2. Test Resume Preview

1. Find the uploaded file in Document History
2. Click the "Preview" button
3. The resume should open in a new tab and be viewable

### 3. Test Resume Analysis

1. After uploading a resume, click "Analyze Recent Resume" button
2. The system should:
   - Display analysis progress
   - Update each section in real-time as analysis completes
   - Show section completion notifications
   - Show complete career insights when finished

If you click analyze without uploading a resume first, it should show an error:
"Analysis Error: No resume found. Please upload your resume first."

### 4. Test Avatar Upload

1. Go to Profile page
2. Click on the avatar upload area
3. Select an image file (JPG, PNG, GIF)
4. After successful upload, verify the file is stored:

```bash
# Execute on the VM
ls -la /home/idii/data/user-uploads/avatars/[USER_ID]/
```

5. Refresh the page and confirm the avatar displays correctly

## Persistence Verification

### Data Retention After Container Restart

```bash
# 1. Upload some files and create data in the database
# 2. Restart all containers
docker-compose -f docker-compose.staging.yml restart

# 3. Wait for services to start
sleep 15

# 4. Check if files are still present
ls -la /home/idii/data/user-uploads/resumes/
ls -la /home/idii/data/user-uploads/avatars/

# 5. Check if database data persists
docker exec idii-db-staging psql -U postgres idii-staging -c "SELECT COUNT(*) FROM users;"

# 6. Verify files and data are accessible from the frontend
```

### Data Retention After Full Rebuild

```bash
# 1. Upload some files and create data
# 2. Stop and remove all containers (preserves data)
docker-compose -f docker-compose.staging.yml down

# 3. Rebuild and start containers
docker-compose -f docker-compose.staging.yml up -d --build

# 4. Wait for services to start
sleep 20

# 5. Verify all data is still present
ls -la /home/idii/data/user-uploads/
docker exec idii-db-staging psql -U postgres idii-staging -c "\dt"

# 6. Verify frontend can access files and database
```

## Permission Details

Directory permissions must be correctly set to ensure Docker containers can access the files:

```bash
# User uploads - needs read/write access from backend container
sudo chmod -R 755 /home/idii/data/user-uploads

# PostgreSQL data - managed by PostgreSQL container (UID 999)
sudo chown -R 999:999 /home/idii/data/postgres-staging
sudo chmod -R 700 /home/idii/data/postgres-staging

# SQLite backup - read-only reference
sudo chmod -R 755 /home/idii/data/database
```

## Database Persistence

### PostgreSQL Database

The system now uses PostgreSQL for all database operations:

**Database Location:** `/home/idii/data/postgres-staging/`

**Environment Configuration:**
```yaml
environment:
  DB_TYPE: postgresql
  DB_HOST: db-staging
  DB_PORT: 5432
  DB_NAME: idii-staging
  DB_USER: postgres
  DB_PASSWORD: ${DB_PASSWORD}
```

**Database Operations:**
```bash
# Check database size
docker exec idii-db-staging du -sh /var/lib/postgresql/data

# Check database status
docker exec idii-db-staging pg_isready -U postgres

# Backup database
docker exec idii-db-staging pg_dump -U postgres idii-staging > backup_$(date +%Y%m%d).sql

# Restore database
cat backup.sql | docker exec -i idii-db-staging psql -U postgres idii-staging

# Connect to database
docker exec -it idii-db-staging psql -U postgres idii-staging

# List all tables
docker exec idii-db-staging psql -U postgres idii-staging -c "\dt"

# Check user count
docker exec idii-db-staging psql -U postgres idii-staging -c "SELECT COUNT(*) FROM users;"
```

### SQLite Backup (Read-Only)

The original SQLite database is preserved as a read-only backup:

**Location:** `/home/idii/data/database/app.db`

This file is kept for migration reference only and is not actively used by the system.

```bash
# Verify SQLite backup exists
ls -lh /home/idii/data/database/app.db

# Query SQLite backup (if needed for reference)
sqlite3 /home/idii/data/database/app.db ".tables"
```

## Troubleshooting

### If File Upload Fails

1. Check directory permissions:
```bash
ls -la /home/idii/data/user-uploads/
```

2. Check container logs:
```bash
docker logs idii-backend-staging --tail 50
```

3. Verify directory mounts:
```bash
docker exec idii-backend-staging ls -la /app/resumes
docker exec idii-backend-staging ls -la /app/avatars
```

4. Check database connectivity:
```bash
# Test connection from backend
docker exec idii-backend-staging nc -zv db-staging 5432

# Check database logs
docker logs idii-db-staging --tail 50
```

5. Check if user directory exists:
```bash
# User directories are created automatically on first upload
# If missing, the upload handler should create them
ls -la /home/idii/data/user-uploads/resumes/
```

### If Files Cannot Be Viewed

1. Verify Nginx is correctly proxying `/resumes/` and `/avatars/` paths
2. Check if files actually exist:
```bash
docker exec idii-backend-staging ls -la /app/resumes/[USER_ID]/
```

3. Check Nginx logs:
```bash
docker logs idii-nginx-staging --tail 50
```

4. Test direct file access:
```bash
# From inside backend container
docker exec idii-backend-staging cat /app/resumes/[USER_ID]/[FILENAME]
```

### If Database Connection Fails

1. Check PostgreSQL container status:
```bash
docker ps | grep db-staging
docker logs idii-db-staging --tail 50
```

2. Test database connectivity:
```bash
# From host
docker exec idii-db-staging pg_isready -U postgres

# From backend container
docker exec idii-backend-staging nc -zv db-staging 5432
```

3. Verify database credentials:
```bash
# Check environment variables
docker exec idii-backend-staging env | grep DB_
```

4. Check database data integrity:
```bash
# List all tables
docker exec idii-db-staging psql -U postgres idii-staging -c "\dt"

# Check specific table
docker exec idii-db-staging psql -U postgres idii-staging -c "SELECT * FROM users LIMIT 5;"
```

### If Resume Analysis Fails

1. Check Career Agent container:
```bash
docker logs idii-career-agent-staging --tail 50
```

2. Verify Ollama2 connectivity:
```bash
docker exec idii-career-agent-staging curl -s http://ollama2-staging:11434/api/tags
```

3. Check if resume file is accessible:
```bash
docker exec idii-career-agent-staging ls -la /app/resumes/[USER_ID]/
```

4. Verify database contains resume metadata:
```bash
docker exec idii-db-staging psql -U postgres idii-staging -c "SELECT * FROM resumes WHERE user_id=[USER_ID];"
```

## Multi-User Support

The system fully supports multiple users:
- Each user's files are stored in separate subdirectories (by user_id)
- Users can only access their own files
- Resume analysis and avatar display are based on the logged-in user's user_id
- Database enforces user isolation through foreign key constraints

## Security Considerations

1. **File upload type restrictions:**
   - Resume: Only .pdf and .txt allowed
   - Avatar: Only .jpg, .jpeg, .png, .gif allowed

2. **File size limits:**
   - Avatars are automatically resized to max 500x500 pixels
   - Resume files: Maximum 10MB (configurable)

3. **Filename security:**
   - UUIDs are used to generate unique filenames, preventing conflicts and security issues
   - Original filenames are sanitized to remove potentially dangerous characters

4. **Database security:**
   - Password hashing using bcrypt
   - JWT-based authentication
   - SQL injection protection via SQLAlchemy ORM
   - User data isolation

5. **Access control:**
   - Users can only access their own files
   - API endpoints validate user ownership before serving files
   - Database queries filtered by authenticated user_id

## Data Backup Strategy

### Regular Backups

```bash
# Create backup directory
mkdir -p ~/backups/$(date +%Y%m%d)

# Backup PostgreSQL database
docker exec idii-db-staging pg_dump -U postgres idii-staging > ~/backups/$(date +%Y%m%d)/database.sql

# Backup user uploads
sudo tar -czf ~/backups/$(date +%Y%m%d)/user-uploads.tar.gz /home/idii/data/user-uploads/

# Verify backup
ls -lh ~/backups/$(date +%Y%m%d)/
```

### Restore from Backup

```bash
# Stop containers
docker-compose -f docker-compose.staging.yml down

# Restore PostgreSQL data directory (if needed)
sudo rm -rf /home/idii/data/postgres-staging/*
# Let PostgreSQL initialize on startup

# Restore user uploads
sudo rm -rf /home/idii/data/user-uploads/*
sudo tar -xzf ~/backups/20250112/user-uploads.tar.gz -C /

# Start containers
docker-compose -f docker-compose.staging.yml up -d

# Wait for database to be ready
sleep 15

# Restore database from SQL dump
cat ~/backups/20250112/database.sql | docker exec -i idii-db-staging psql -U postgres idii-staging
```

## Summary of Configuration

### Data Storage Architecture:
1. **User Uploads** - Organized by user ID in `/home/idii/data/user-uploads/`
   - Resumes: PDF and TXT files
   - Avatars: Image files (auto-resized to 500x500)

2. **PostgreSQL Database** - Full relational database in `/home/idii/data/postgres-staging/`
   - User accounts and authentication
   - Profile data and settings
   - Resume metadata and analysis results
   - Chat sessions and messages
   - Career insights and recommendations

3. **SQLite Backup** - Migration reference in `/home/idii/data/database/` (read-only)
   - Original SQLite database preserved for reference
   - Not used by running system

### Docker Volume Mounts:
- **Backend:** User uploads (read/write) + SQLite backup (read-only)
- **Career Agent:** User uploads (read) + SQLite backup (read-only)
- **Database:** PostgreSQL data directory

### Database Migration:
- ✅ Migrated from SQLite to PostgreSQL
- ✅ All boolean fields converted (0/1 → FALSE/TRUE)
- ✅ Session ID type validation added
- ✅ Data integrity verified
- ✅ Backup strategy implemented

### Key Features:
- ✅ Multi-user support with per-user directories
- ✅ PostgreSQL for scalable, concurrent database operations
- ✅ Persistent storage across container restarts and rebuilds
- ✅ Resume upload, preview, and analysis working
- ✅ Avatar upload and display working
- ✅ Section completion notifications during analysis
- ✅ Proper error handling and validation
- ✅ Data backup and recovery procedures
- ✅ Security best practices implemented

## Testing Checklist

Use this checklist to verify all functionality:

### File Upload Tests
- [ ] Upload resume (PDF) - verify file appears in `/home/idii/data/user-uploads/resumes/[USER_ID]/`
- [ ] Upload resume (TXT) - verify file appears
- [ ] Preview uploaded resume - opens in new tab
- [ ] Upload avatar (JPG/PNG) - verify file appears in `/home/idii/data/user-uploads/avatars/[USER_ID]/`
- [ ] Avatar displays correctly on profile page
- [ ] Upload with special characters in filename - sanitized correctly

### Resume Analysis Tests
- [ ] Analyze resume - progress indicators appear
- [ ] Section completion notifications appear (e.g., "Education Complete")
- [ ] Final "Analysis Complete!" notification appears
- [ ] Career insights populate correctly
- [ ] Attempt analysis without resume - error message appears

### Database Tests
- [ ] User registration - data saved to PostgreSQL
- [ ] User login - authentication works
- [ ] Profile update - changes persist
- [ ] Chat messages - saved and retrievable
- [ ] Resume metadata - stored correctly

### Persistence Tests
- [ ] Restart backend container - files still accessible
- [ ] Restart database container - data still present
- [ ] Restart all containers - everything works
- [ ] Full rebuild (`docker-compose down && up --build`) - data preserved

### Multi-User Tests
- [ ] User A uploads files - stored in user A's directory
- [ ] User B uploads files - stored in user B's directory
- [ ] User A cannot access User B's files
- [ ] Each user sees only their own data

---

**Last Updated**: 2025-01-12
**Maintained By**: DevOps Team
