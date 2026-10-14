#!/usr/bin/env bash
# CI/CD casero: si hay commits nuevos en origin/<rama>, hace una copia de
# seguridad, actualiza, reconstruye la app y comprueba que responde. Si la
# versión nueva no responde, vuelve sola a la anterior. Sin cambios, no hace nada.
#
#   ops/deploy.sh            # despliega solo si hay cambios
#   ops/deploy.sh --force    # reconstruye aunque no haya cambios
#
# Variables (opcionales): DEPLOY_BRANCH (main), APP_PORT (el de .env o 3010).
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd "$(dirname "$0")/.."

BRANCH="${DEPLOY_BRANCH:-main}"
PORT="${APP_PORT:-$(grep -E '^APP_PORT=' .env 2>/dev/null | cut -d= -f2 || true)}"
PORT="${PORT:-3010}"
PROJECT="$(basename "$PWD" | tr '[:upper:]' '[:lower:]')"
log() { echo "[$(date '+%F %T')] deploy: $*"; }

exec 9>/tmp/savetowin-deploy.lock
flock -n 9 || { log "ya hay un despliegue en curso; salgo"; exit 0; }

git fetch -q origin "$BRANCH"
prev="$(git rev-parse HEAD)"
next="$(git rev-parse "origin/$BRANCH")"
if [ "$prev" = "$next" ] && [ "${1:-}" != "--force" ]; then
  log "sin cambios (${prev:0:7})"
  exit 0
fi
log "desplegando ${prev:0:7} → ${next:0:7}"

ops/backup.sh
git merge -q --ff-only "origin/$BRANCH"

build() { docker compose up -d --build app; }
healthy() {
  for _ in $(seq 1 30); do
    curl -fsS "http://127.0.0.1:$PORT/api/health" 2>/dev/null | grep -q '"ok":true' && return 0
    sleep 2
  done
  return 1
}

if build && healthy; then
  log "ok: $(git log --oneline -1)"
  # Solo imágenes huérfanas de ESTE proyecto (las que deja cada rebuild).
  docker image prune -f --filter "label=com.docker.compose.project=$PROJECT" >/dev/null || true
else
  log "ERROR: la versión nueva no responde; vuelvo a ${prev:0:7}"
  # ponytail: las migraciones ya aplicadas no se deshacen (son aditivas); el código
  # anterior funciona con ellas. Mañana se reintentará el mismo commit.
  git reset -q --hard "$prev"
  if build && healthy; then log "vuelta atrás ok"; else log "ERROR: la vuelta atrás tampoco responde"; fi
  exit 1
fi
