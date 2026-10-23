#!/usr/bin/env bash
# Database Restore Script for Manuscript AI
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/restore.sh <path-to-backup.sql.gz>"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "File ${BACKUP_FILE} not found."
  exit 1
fi

echo "Restoring database from ${BACKUP_FILE}..."
gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL:-postgresql://app_user:secure_dev_password_2026@localhost:5432/manuscript_ai}"
echo "Database restored successfully."
