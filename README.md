# saveToWin

App **self-hosted multi-usuario** para controlar **gastos y ahorros**: cada
persona se registra, mete movimientos (a mano o CSV del banco), categoriza, y
ve un dashboard con gráficos, estadísticas y conclusiones. Corre en **tu
servidor casero** (Docker Compose: app + Postgres); cualquiera con acceso puede
crear cuenta y solo ve **sus** datos.

Marca: **saveToWin** · dominio prod `savetowin.app`.

---

## Objetivo

- Registro/login por usuario; datos aislados.
- Meter pagos/ingresos y **categorizarlos**.
- **Sincronizado** entre dispositivos de la misma cuenta.
- Dashboard **visual**: gasto por categoría/mes, tasa de ahorro, presupuesto vs real.
- **Conclusiones** automáticas por reglas.

---

## Stack

| Capa | Elección | Por qué |
|------|----------|---------|
| Frontend | Vite + React + TypeScript | Rápido, ecosistema grande, TS evita bugs de dinero |
| Datos (cliente) | TanStack Query | Cachea y refetchea → sensación de "sync" gratis |
| Gráficos | Recharts | Declarativo, encaja con React |
| Import | PapaParse | Parsear CSV del banco |
| Backend | Node + TypeScript + Hono | Un proceso sirve API + frontend |
| Base de datos | **PostgreSQL** + Drizzle ORM | Multi-usuario y concurrencia real |
| Auth | Registro + login, argon2, **JWT en cookie httpOnly** | Sólido frente a XSS; sin token en JS |
| Despliegue | Docker Compose (app + postgres) | Servidor casero |

**Regla no negociable:** el dinero se guarda como **entero de céntimos**
(`1234` = 12,34 €). Nunca floats. El formateo a euros es solo de presentación.

---

## Arquitectura

```
  Móvil / PC / tablet          Servidor casero (Docker Compose)
  ┌───────────────┐            ┌──────────────────────────────────┐
  │  Navegador    │  HTTPS/    │  app (Node/Hono: /api + estáticos) │
  │  (React SPA)  │◄─────────► │              │                    │
  └───────────────┘   LAN o    │              ▼                    │
                      internet │  db (PostgreSQL, volumen)         │
                               └──────────────────────────────────┘
```

---

## Modelo de datos

```
User         id · email · password_hash · name · created_at
Account      id · user_id · key · label · color · name · initial_balance(céntimos)
Category     id · user_id · key · label · color · type · parent_id
Transaction  id · user_id · fecha · importe(céntimos) · type · category_id · account_id · nota · tags
Budget       id · user_id · category_id · periodo · limite(céntimos)
```

Al registrarse, se siembran 12 categorías + 7 cuentas por defecto para ese usuario.

---

## Puesta en marcha (desarrollo)

```bash
cp .env.example .env   # JWT_SECRET, DATABASE_URL, PORT=3010
npm install
docker compose up db -d
npm run dev            # web (Vite) + API; proxy /api → :3010
npm test               # money + stats (+ insights)
```

UI: `http://localhost:5173` → `/es/…`.

## Despliegue (servidor casero)

```bash
cp .env.example .env   # JWT_SECRET fuerte; REGISTRATION_OPEN=true|false
docker compose up -d --build
# App en :3010 (o APP_PORT). Postgres en :5433 solo para admin local.
```

HTTPS en `savetowin.app` (DNS apuntando al server, 80/443 abiertos):

```bash
docker compose --profile https up -d --build
```

Datos en volumen `pgdata`. Cada usuario puede descargar o restaurar su copia en
JSON desde su **Perfil** (`GET/POST /api/backup`).
PWA instalable en build de producción (manifest + service worker).

### Copias y despliegue automáticos (`ops/`)

- `ops/backup.sh`: copia de la base de datos (`pg_dump` comprimido y verificado) en
  `~/backups/savetowin`, con permisos solo para tu usuario. Borra las que superan
  `BACKUP_KEEP_DAYS` (30).
- `ops/deploy.sh`: si hay commits nuevos en `origin/main`, hace una copia, actualiza,
  reconstruye la app y comprueba `/api/health`; si no responde, **vuelve sola** a la
  versión anterior. Sin cambios no hace nada (`--force` reconstruye igualmente).
- `ops/restic.sh` (opcional): copia **fuera del servidor**, cifrada con
  [restic](https://restic.net) (en Docker) en un bucket de Backblaze B2. Con
  `B2_ENDPOINT`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APP_KEY` y `RESTIC_PASSWORD` en `.env`,
  `backup.sh` sube cada copia y aplica la misma retención. Una vez:
  `ops/restic.sh init`. Restaurar: `ops/restic.sh restore latest --target ~/backups/restore`.
  **Guarda `RESTIC_PASSWORD` también fuera del servidor**: sin ella no se descifra.
  En el bucket, *Lifecycle: keep only the last version* (si no, lo borrado se oculta
  pero no se borra).
- `ops/health.sh` (opcional): latido para [healthchecks.io](https://healthchecks.io).
  Con `HC_UP_URL` (y `HEALTH_URL`, la URL pública) avisa si la web, el servidor o la
  conexión caen. `HC_BACKUP_URL` y `HC_DEPLOY_URL` avisan si la copia o el despliegue
  fallan o dejan de ejecutarse.

Ejemplo de `crontab -e` (copia cada 2 días, despliegue diario a las 4:00, latido cada 5 min):

```cron
45 3 */2 * * $HOME/apps/saveToWin/ops/backup.sh >> $HOME/logs/savetowin-backup.log 2>&1
0 4 * * *    $HOME/apps/saveToWin/ops/deploy.sh >> $HOME/logs/savetowin-deploy.log 2>&1
*/5 * * * *  $HOME/apps/saveToWin/ops/health.sh >> $HOME/logs/savetowin-health.log 2>&1
```

---

## Seguridad

- Passwords con **argon2** (nunca en claro).
- **JWT** de acceso en cookie **httpOnly + SameSite** (+ Secure en prod).
- Rate-limit en register/login (10 intentos/min por IP). Detrás de un proxy, indica de
  qué cabecera sale la IP real con `TRUSTED_PROXY=cloudflare` o `TRUSTED_PROXY=proxy`;
  sin proxy, déjalo sin definir (las cabeceras se pueden falsificar).
- Aislamiento estricto por `userId` en toda la API.
- Cerrar altas: `REGISTRATION_OPEN=false`.
- **Verificación en dos pasos** opcional (TOTP, app de autenticación) con códigos de
  recuperación de un solo uso; la app la recomienda de vez en cuando.
- Cambiar email o contraseña exige la contraseña actual **y** un código enviado por
  correo (al email nuevo, en el caso del email). Requiere SMTP (`SMTP_*` en `.env`).
- Si se expone a internet: **HTTPS** (perfil `https` / Caddy).

---

## Estado

Plan implementado (fases 0–9). Tracker: `docs/PROGRESS.md`. Spec: `docs/IMPLEMENTATION_PLAN.md`.

Fuera de alcance: OAuth, 2FA, billing, sync realtime, categorización con IA.

---

## Decisiones

- **Self-hosted en server casero**, multi-usuario (no SaaS comercial de pago).
- **Postgres** (no SQLite): varios usuarios concurrentes.
- **JWT en cookie httpOnly** (no `localStorage`): mitiga XSS.
- **Céntimos**: correctitud del dinero por encima de comodidad.

---

## Licencia

Copyright (C) 2026 Eduardo Serrano.

El núcleo de saveToWin es software libre bajo la **GNU Affero General Public
License v3.0** ([`LICENSE`](LICENSE)): puedes usarlo, modificarlo y
hospedarlo; si lo ofreces como servicio en red, debes publicar tus cambios
bajo la misma licencia.
