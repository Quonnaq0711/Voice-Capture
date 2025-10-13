#!/bin/bash
#
# PostgreSQL Automatic Backup Script
#
# This script backs up the PostgreSQL database to a timestamped file
# and maintains only the last 7 days of backups.
#
# Usage:
#   ./scripts/backup_postgres.sh
#
# To run automatically with cron:
#   crontab -e
#   # Add: 0 2 * * * /path/to/Product/scripts/backup_postgres.sh >> /path/to/Product/logs/backup.log 2>&1
#   # Replace /path/to/Product with your actual project path
#

set -e  # Exit on error

# Configuration
BACKUP_DIR="/home/idii/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/idii-staging_${TIMESTAMP}.sql"
CONTAINER_NAME="idii-db-staging"
DB_USER="postgres"
DB_NAME="idii-staging"
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

echo "=================================================="
echo "PostgreSQL Backup Script"
echo "=================================================="
echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Database: ${DB_NAME}"
echo "Container: ${CONTAINER_NAME}"
echo "Backup file: ${BACKUP_FILE}"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container ${CONTAINER_NAME} is not running!"
    exit 1
fi

# Create backup
echo "Creating database backup..."
if docker exec ${CONTAINER_NAME} pg_dump -U ${DB_USER} ${DB_NAME} > "${BACKUP_FILE}"; then
    echo "✓ Backup created successfully"

    # Get backup file size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "  File size: ${BACKUP_SIZE}"

    # Compress backup
    echo "Compressing backup..."
    gzip "${BACKUP_FILE}"
    COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "✓ Backup compressed to ${COMPRESSED_SIZE}"

    # Count records in database
    RECORD_COUNT=$(docker exec ${CONTAINER_NAME} psql -U ${DB_USER} ${DB_NAME} -t -c "
        SELECT
            (SELECT COUNT(*) FROM users) +
            (SELECT COUNT(*) FROM user_profiles) +
            (SELECT COUNT(*) FROM chat_sessions) +
            (SELECT COUNT(*) FROM chat_messages) +
            (SELECT COUNT(*) FROM resumes) +
            (SELECT COUNT(*) FROM user_activities) +
            (SELECT COUNT(*) FROM career_insights) +
            (SELECT COUNT(*) FROM daily_recommendations)
        AS total_records;" | tr -d ' ')

    echo "  Total records backed up: ${RECORD_COUNT}"
else
    echo "✗ Backup failed!"
    exit 1
fi

# Clean up old backups
echo ""
echo "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
DELETED_COUNT=$(find "${BACKUP_DIR}" -name "idii-staging_*.sql.gz" -mtime +${RETENTION_DAYS} -type f -delete -print | wc -l)

if [ ${DELETED_COUNT} -gt 0 ]; then
    echo "✓ Deleted ${DELETED_COUNT} old backup(s)"
else
    echo "  No old backups to delete"
fi

# List current backups
echo ""
echo "Current backups:"
ls -lh "${BACKUP_DIR}" | tail -n +2 | awk '{print "  " $9 " (" $5 ")"}'

BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}" | wc -l)
echo ""
echo "Total backups: ${BACKUP_COUNT}"

echo ""
echo "=================================================="
echo "Backup completed successfully at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="

exit 0
