#!/bin/bash
# Backup MySQL baze (npr. za DO)
# Koristi: ./scripts/backup-db.sh
# Ili ručno: mysqldump -u USER -p -h HOST DATABASE > backup_YYYYMMDD_HHMM.sql

DB_USER="${DB_USER:-root}"
DB_HOST="${DB_HOST:-localhost}"
DB_NAME="${DB_NAME:-studio_db}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M)
OUTPUT="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"

echo "Backup: $DB_NAME -> $OUTPUT"
mysqldump -u "$DB_USER" -p -h "$DB_HOST" \
  --single-transaction \
  --routines \
  --triggers \
  "$DB_NAME" > "$OUTPUT"

if [ $? -eq 0 ]; then
  echo "OK: $(wc -l < "$OUTPUT") linija, $(du -h "$OUTPUT" | cut -f1)"
else
  echo "Greška pri backup-u"
  exit 1
fi
