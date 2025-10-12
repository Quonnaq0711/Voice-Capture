#!/bin/bash
#
# PostgreSQL Database Restore Script
#
# This script restores a PostgreSQL database from a backup file.
#
# Usage:
#   ./scripts/restore_postgres.sh <backup_file.sql.gz>
#
# Example:
#   ./scripts/restore_postgres.sh /home/idii/backups/postgres/productdb-staging_20251012_002350.sql.gz
#

set -e  # Exit on error

# Configuration
CONTAINER_NAME="idii-db-staging"
DB_USER="postgres"
DB_NAME="productdb-staging"

# Check arguments
if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Available backups:"
    ls -lh /home/idii/backups/postgres/*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 ", " $6 " " $7 ")"}'
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "ERROR: Backup file '${BACKUP_FILE}' not found!"
    exit 1
fi

echo "=================================================="
echo "PostgreSQL Database Restore"
echo "=================================================="
echo "Started at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Backup file: ${BACKUP_FILE}"
echo "Target database: ${DB_NAME}"
echo "Container: ${CONTAINER_NAME}"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "ERROR: Container ${CONTAINER_NAME} is not running!"
    exit 1
fi

# Warning
echo "WARNING: This will REPLACE all data in the database!"
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "${CONFIRM}" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
fi

# Create a pre-restore backup
echo ""
echo "Creating pre-restore backup..."
PRE_RESTORE_BACKUP="/home/idii/backups/postgres/pre-restore_$(date +%Y%m%d_%H%M%S).sql.gz"
docker exec ${CONTAINER_NAME} pg_dump -U ${DB_USER} ${DB_NAME} | gzip > "${PRE_RESTORE_BACKUP}"
echo "✓ Pre-restore backup saved to: ${PRE_RESTORE_BACKUP}"

# Decompress if needed
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    echo ""
    echo "Decompressing backup..."
    SQL_FILE=$(mktemp /tmp/restore_XXXXXX.sql)
    gunzip -c "${BACKUP_FILE}" > "${SQL_FILE}"
    echo "✓ Backup decompressed"
else
    SQL_FILE="${BACKUP_FILE}"
fi

# Drop and recreate database
echo ""
echo "Recreating database..."
docker exec ${CONTAINER_NAME} psql -U ${DB_USER} -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
docker exec ${CONTAINER_NAME} psql -U ${DB_USER} -c "CREATE DATABASE \"${DB_NAME}\";"
echo "✓ Database recreated"

# Restore database
echo ""
echo "Restoring database..."
cat "${SQL_FILE}" | docker exec -i ${CONTAINER_NAME} psql -U ${DB_USER} ${DB_NAME}
echo "✓ Database restored"

# Clean up temporary file
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    rm -f "${SQL_FILE}"
fi

# Verify restoration
echo ""
echo "Verifying restoration..."
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

echo "✓ Restored ${RECORD_COUNT} total records"

# List tables
echo ""
echo "Database tables:"
docker exec ${CONTAINER_NAME} psql -U ${DB_USER} ${DB_NAME} -c "\dt" | grep -v "^(" | grep -v "rows)"

echo ""
echo "=================================================="
echo "Restore completed successfully at: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=================================================="
echo ""
echo "Pre-restore backup available at:"
echo "  ${PRE_RESTORE_BACKUP}"
echo ""

exit 0
