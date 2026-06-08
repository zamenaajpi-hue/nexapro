#!/bin/bash

# Configuration
DB_NAME=${DB_NAME:-"nexa_db"}
DB_USER=${DB_USER:-"postgres"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
BACKUP_DIR="/opt/nexa-backups"
KEEP_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_backup_${TIMESTAMP}.sql"

echo "=== [$(date)] Starting Database Backup ==="
echo "Database: $DB_NAME"
echo "Backup File: ${BACKUP_FILE}.gz"

# Run pg_dump and compress
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"; then
    gzip "$BACKUP_FILE"
    echo "✔ Backup completed successfully!"
else
    echo "❌ Backup failed! Check postgres credentials and permissions." >&2
    exit 1
fi

# Cleanup old backups (older than KEEP_DAYS)
echo "Cleaning up backups older than $KEEP_DAYS days..."
find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -mtime +$KEEP_DAYS -exec rm {} \; -exec echo "Deleted old backup: {}" \;

echo "=== Backup Process Finished ==="
