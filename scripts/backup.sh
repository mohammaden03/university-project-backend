#!/usr/bin/env bash
# Database Backup Script for Manuscript AI
set -euo pipefail

BACKUP_DIR="./storage/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="${BACKUP_DIR}/manuscript_ai_backup_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "Starting PostgreSQL backup to ${FILENAME}..."
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${DATABASE_URL:-postgresql://app_user:secure_dev_password_2026@localhost:5432/manuscript_ai}" | gzip > "${FILENAME}"
  echo "Backup successfully written: ${FILENAME}"
else
  echo "pg_dump not found on host. If using Docker run: docker exec -t manuscript-ai-postgres pg_dump -U app_user manuscript_ai | gzip > ${FILENAME}"
fi
