#!/usr/bin/env bash
# restic (en Docker, sin instalar nada) contra la copia cifrada en Backblaze B2.
# Lee B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APP_KEY y RESTIC_PASSWORD del .env.
#
#   ops/restic.sh init                          # crear el repositorio (una vez)
#   ops/restic.sh snapshots                     # ver las copias subidas
#   ops/restic.sh restore latest --target ~/backups/restore
#
# Sin RESTIC_PASSWORD las copias no se pueden descifrar: guárdala también fuera
# del servidor (gestor de contraseñas).
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
cd "$(dirname "$0")/.."

for v in B2_ENDPOINT B2_BUCKET B2_KEY_ID B2_APP_KEY RESTIC_PASSWORD; do
  [ -n "${!v:-}" ] || export "$v=$(grep -E "^$v=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)"
  [ -n "${!v}" ] || { echo "restic: falta $v en .env" >&2; exit 2; }
done
export RESTIC_REPOSITORY="${RESTIC_REPOSITORY:-s3:https://$B2_ENDPOINT/$B2_BUCKET}"
export AWS_ACCESS_KEY_ID="$B2_KEY_ID" AWS_SECRET_ACCESS_KEY="$B2_APP_KEY"

# Los secretos pasan por entorno (-e NOMBRE), no por la línea de comandos.
mkdir -p "$HOME/backups"
exec docker run --rm --hostname savetowin --user "$(id -u):$(id -g)" \
  -e RESTIC_REPOSITORY -e RESTIC_PASSWORD -e AWS_ACCESS_KEY_ID -e AWS_SECRET_ACCESS_KEY \
  -e RESTIC_CACHE_DIR=/tmp/restic-cache \
  -v "$HOME/backups:$HOME/backups" \
  restic/restic:0.19.1 "$@"
