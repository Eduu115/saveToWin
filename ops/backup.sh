#!/usr/bin/env bash
# Copia de seguridad de la base de datos de saveToWin (pg_dump comprimido).
# Comprueba que la copia es válida, la guarda solo para tu usuario y borra las
# que superan la retención.
#
#   ops/backup.sh
#
# Variables (opcionales): BACKUP_DIR (~/backups/savetowin), BACKUP_KEEP_DAYS (30),
# DB_USER y DB_NAME (savetowin, como en docker-compose.yml).
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/savetowin}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
DB_USER="${DB_USER:-savetowin}"
DB_NAME="${DB_NAME:-savetowin}"
log() { echo "[$(date '+%F %T')] backup: $*"; }

exec 8>/tmp/savetowin-backup.lock
flock -n 8 || { log "ya hay una copia en curso; salgo"; exit 0; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
out="$BACKUP_DIR/savetowin-$(date +%Y-%m-%d_%H%M).sql.gz"
tmp="$out.tmp"
trap 'rm -f "$tmp"' EXIT

log "inicio → $out"
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" | gzip -9 > "$tmp"
gzip -t "$tmp"
size=$(stat -c %s "$tmp")
if [ "$size" -lt 1000 ]; then
  log "ERROR: la copia es sospechosamente pequeña ($size bytes); no la guardo"
  exit 1
fi
mv "$tmp" "$out"
chmod 600 "$out"
log "ok ($size bytes)"

# Retención (la política de privacidad promete como máximo KEEP_DAYS días).
find "$BACKUP_DIR" -maxdepth 1 -name 'savetowin-*.sql.gz' -mtime +"$KEEP_DAYS" -print -delete \
  | sed 's/^/  borrada: /'
# Copias manuales antiguas sueltas en $HOME (formato anterior).
find "$HOME" -maxdepth 1 -name 'savetowin-backup-*.sql' -mtime +"$KEEP_DAYS" -print -delete \
  | sed 's/^/  borrada: /'
