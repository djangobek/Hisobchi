#!/usr/bin/env bash
set -Eeuo pipefail
# Run from project root. Requires Docker Compose and a healthy postgres service.
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="$BACKUP_DIR/hisobchi-$STAMP.sql.gz.tmp"
OUT="$BACKUP_DIR/hisobchi-$STAMP.sql.gz"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-hisobchi}" -d "${POSTGRES_DB:-hisobchi}" --clean --if-exists --no-owner --no-acl | gzip -9 > "$TMP"
gzip -t "$TMP"
mv "$TMP" "$OUT"
chmod 600 "$OUT"
find "$BACKUP_DIR" -type f -name 'hisobchi-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "Backup created: $OUT"
