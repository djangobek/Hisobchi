#!/usr/bin/env bash
set -Eeuo pipefail
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: $0 ./backups/hisobchi-YYYYMMDDTHHMMSSZ.sql.gz" >&2
  exit 2
fi
echo "WARNING: This replaces the current database contents."
read -r -p "Type RESTORE to continue: " CONFIRM
[[ "$CONFIRM" == "RESTORE" ]] || { echo "Cancelled."; exit 1; }
gzip -t "$1"
# Create a temporary backup before restoring, if current DB is reachable.
./scripts/backup-postgres.sh || echo "Warning: pre-restore backup failed; proceeding only after explicit confirmation."
gzip -dc "$1" | docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-hisobchi}" -d "${POSTGRES_DB:-hisobchi}"
echo "Restore import completed. Verify the app and row counts before reopening traffic."
