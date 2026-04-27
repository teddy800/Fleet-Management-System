#!/bin/bash
# MESSOB Fleet Management - Database Backup Script
# Run this script daily via cron: 0 2 * * * /path/to/backup_database.sh

set -e

# Configuration
BACKUP_DIR="/var/backups/messob-fleet"
DB_NAME="messob_db"
DB_USER="odoo"
DB_HOST="localhost"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/messob_fleet_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

echo "🗄️ Starting database backup for MESSOB Fleet Management..."

# Create backup
pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME --verbose --no-owner --no-privileges > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE
BACKUP_FILE="$BACKUP_FILE.gz"

# Verify backup
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo "✅ Backup created successfully: $BACKUP_FILE"
    
    # Get file size
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "📊 Backup size: $SIZE"
    
    # Log backup
    echo "$(date): Backup completed - $BACKUP_FILE ($SIZE)" >> $BACKUP_DIR/backup.log
else
    echo "❌ Backup failed or file is empty"
    echo "$(date): Backup FAILED - $BACKUP_FILE" >> $BACKUP_DIR/backup.log
    exit 1
fi

# Clean old backups
echo "🧹 Cleaning backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -name "messob_fleet_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Count remaining backups
BACKUP_COUNT=$(find $BACKUP_DIR -name "messob_fleet_*.sql.gz" | wc -l)
echo "📁 Total backups retained: $BACKUP_COUNT"

# Optional: Upload to cloud storage (uncomment and configure)
# echo "☁️ Uploading to cloud storage..."
# aws s3 cp $BACKUP_FILE s3://your-backup-bucket/messob-fleet/
# gsutil cp $BACKUP_FILE gs://your-backup-bucket/messob-fleet/

echo "✅ Database backup completed successfully!"