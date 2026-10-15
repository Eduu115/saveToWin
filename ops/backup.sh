#!/usr/bin/env bash
# Copia de seguridad de la base de datos de saveToWin (pg_dump comprimido).
# Comprueba que la copia es válida, la guarda solo para tu usuario y borra las
# que superan la retención. Si Backblaze está configurado, la sube cifrada
# (ops/restic.sh) con la misma retención.
#
#   ops/backup.sh
#
# Variables (opcionales): BACKUP_DIR (~/backups/savetowin), BACKUP_KEEP_DAYS (30),
# DB_USER y DB_NAME (savetowin, como en docker-compose.yml). En .env: B2_* y
# RESTIC_PASSWORD (copia fuera; BACKUP_DIR dentro de ~/backups), HC_BACKUP_URL
# (aviso de healthchecks.io).
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/savetowin}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
DB_USER="${DB_USER:-savetowin}"
DB_NAME="${DB_NAME:-savetowin}"
HC_URL="${HC_BACKUP_URL:-$(grep -E '^HC_BACKUP_URL=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' || true)}"
log() { echo "[$(date '+%F %T')] backup: $*"; }
hc() { [ -z "$HC_URL" ] || curl -fsS -m 10 --retry 3 -o /dev/null "$HC_URL$1" || true; }

exec 8>/tmp/savetowin-backup.lock
flock -n 8 || { log "ya hay una copia en curso; salgo"; exit 0; }

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
out="$BACKUP_DIR/savetowin-$(date +%Y-%m-%d_%H%M).sql.gz"
tmp="$out.tmp"
# Al salir, healthchecks.io recibe el código de salida (0 = bien; otro = aviso).
trap 'code=$?; rm -f "$tmp"; hc "/$code"' EXIT
hc /start

log "inicio → $out"
docker compose exec -T db pg_dump -U "$DB_USER" "$DB_NAME" </dev/null | gzip -9 > "$tmp"
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

# Copia fuera del servidor, cifrada, si Backblaze está configurado en .env.
if grep -qE '^B2_BUCKET=.' .env 2>/dev/null; then
  log "subiendo a Backblaze B2"
  ops/restic.sh backup --quiet "$out"
  ops/restic.sh forget --quiet --group-by host --keep-within "${KEEP_DAYS}d" --prune
  log "subida ok"
fi
