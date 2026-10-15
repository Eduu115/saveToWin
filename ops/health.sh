#!/usr/bin/env bash
# Latido para healthchecks.io (cron cada 5 min): si la web responde, ping; si
# no, /fail. Si se cae el servidor o la conexión no llega nada, y healthchecks
# avisa igual al pasar el margen.
#
#   ops/health.sh
#
# En .env: HC_UP_URL (sin ella no hace nada) y HEALTH_URL (por defecto la API
# local; en producción, la URL pública para comprobar también el túnel).
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd "$(dirname "$0")/.."

get() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true; }
HC_URL="${HC_UP_URL:-$(get HC_UP_URL)}"
[ -n "$HC_URL" ] || exit 0
PORT="${APP_PORT:-$(get APP_PORT)}"
URL="${HEALTH_URL:-$(get HEALTH_URL)}"
URL="${URL:-http://127.0.0.1:${PORT:-3010}/api/health}"

# Reintentos para no avisar por un corte de segundos.
if curl -fsS -m 20 --retry 2 --retry-delay 20 --retry-all-errors "$URL" | grep -q '"ok":true'; then
  curl -fsS -m 10 --retry 3 -o /dev/null "$HC_URL"
else
  echo "[$(date '+%F %T')] health: $URL no responde"
  curl -fsS -m 10 --retry 3 -o /dev/null "$HC_URL/fail"
fi
