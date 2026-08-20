# Estado del proyecto — saveToWin

Tracker vivo. **Fuente de verdad de qué está hecho y qué falta.** Uso: sigue el
protocolo de `CLAUDE.md` → trabaja la tarea del **Cursor**, márcala, actualiza
el Cursor y añade una línea al Log. `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

## Cursor

- **Fase actual:** — (plan completo + post-plan)
- **Próxima tarea:** ninguna

## Tablero de fases

| Fase | Estado |
|------|--------|
| 0 · Scaffold y tooling | ✅ hecha |
| 1 · Dominio y datos | ✅ hecha |
| 2 · Auth multi-usuario | ✅ hecha |
| 3 · API CRUD (scoped) | ✅ hecha |
| 4 · Frontend base + i18n | ✅ hecha |
| 5 · Dashboard / stats / logo | ✅ hecha |
| 6 · Presupuestos y ahorro | ✅ hecha |
| 7 · Import CSV | ✅ hecha |
| 8 · Despliegue (app + Postgres) | ✅ hecha |
| 9 · Opcionales | ✅ hecha |

## Checklist (detalle en `docs/IMPLEMENTATION_PLAN.md` por ID)

### Fase 0 — Scaffold y tooling
- [x] P0.1 · git init + .gitignore
- [x] P0.2 · package.json raíz (workspaces) + scripts + tsconfig.base
- [x] P0.3 · web: Vite + React + TS
- [x] P0.4 · server: Hono + GET /api/health
- [x] P0.5 · cablear dev (proxy) y prod (server sirve build de web)
- [x] P0.6 · Tailwind + tokens + Public Sans/Lucide self-hosted + toggle tema

### Fase 1 — Dominio y datos
- [x] P1.1 · money.ts + money.test.ts
- [x] P1.2 · shared/types.ts (`User` + entidades con `userId`)
- [x] P1.3 · Drizzle schema **Postgres** (users + FKs + userId)
- [x] P1.4 · db client `DATABASE_URL` + migrate al arrancar
- [x] P1.5 · seed **por usuario** (12 categorías + 7 cuentas)

### Fase 2 — Auth multi-usuario
- [x] P2.1 · JWT helpers + env (`JWT_SECRET`, `DATABASE_URL`)
- [x] P2.2 · register/login/logout/me + cookie JWT httpOnly + seed al registrar
- [x] P2.3 · middleware protege /api/* + rate-limit auth

### Fase 3 — API CRUD (scoped por usuario)
- [x] P3.1 · zod + forma de error única
- [x] P3.2 · /api/accounts (aislado)
- [x] P3.3 · /api/categories (aislado)
- [x] P3.4 · /api/transactions (+ filtros/paginación, aislado)
- [x] P3.5 · /api/budgets (aislado)

### Fase 4 — Frontend base + i18n
- [x] P4.1 · router /{locale}/… + redirect / → /es
- [x] P4.2 · diccionario es + helper t()
- [x] P4.3 · React Query + api client + guard de auth
- [x] P4.4 · pantallas Login + Registro
- [x] P4.5 · layout + nav + toggle tema + logout
- [x] P4.6 · Transacciones: tabla + alta/edición

### Fase 5 — Dashboard / stats / logo
- [x] P5.1 · módulo stats + stats.test.ts (dataset canónico)
- [x] P5.2 · KPIs + anillo generativo (logo/favicon/objetivo)
- [x] P5.3 · gráficos Recharts + estados
- [x] P5.4 · conclusiones por reglas

### Fase 6 — Presupuestos y ahorro
- [x] P6.1 · UI presupuestos (over/under con icono+texto)
- [x] P6.2 · objetivo de ahorro + seguimiento

### Fase 7 — Import CSV
- [x] P7.1 · subida + PapaParse + mapeo de columnas
- [x] P7.2 · previsualización + inserción en lote
- [x] P7.3 · deduplicado
- [x] P7.4 · auto-categorización por reglas

### Fase 8 — Despliegue
- [x] P8.1 · Dockerfile multi-stage
- [x] P8.2 · docker-compose app + postgres + .env.example
- [x] P8.3 · verificación end-to-end (móvil + persistencia + aislamiento)

### Fase 9 — Opcionales
- [x] P9.1 · PWA
- [x] P9.2 · export/backup
- [x] P9.3 · HTTPS/Caddy (savetowin.app)
- [x] P9.4 · cerrar registro (`REGISTRATION_OPEN`)

## Log

- 2026-08-02 · Documentación y diseño listos (plan granular, reglas, tracker). Pendiente arrancar P0.1.
- 2026-08-02 · P0.1: git init + .gitignore (`node_modules`, `dist`, `*.db`, `.env`, `.DS_Store`).
- 2026-08-02 · P0.2: monorepo npm workspaces (`shared`, `server`, `web`) + scripts + tsconfig.base.
- 2026-08-02 · P0.3: workspace web con Vite + React + TS; página mínima.
- 2026-08-02 · P0.4: server Hono con GET /api/health → `{ ok: true }`.
- 2026-08-02 · P0.5: Vite proxy `/api` → server; build web → `server/public`; App muestra health.
- 2026-08-02 · P0.6: Tailwind + tokens + Public Sans/Lucide auto-alojados + toggle `[data-theme]`. Fase 0 hecha.
- 2026-08-02 · P1.1: `shared/money.ts` + vitest (`parse`/`format`/`add`/`sum`, es-ES, céntimos).
- 2026-08-02 · P1.2: `shared/types.ts` (Account/Category/Transaction/Budget; key EN + label ES + color).
- 2026-08-02 · P1.3: Drizzle schema + migración `0000` (céntimos, fecha ISO, FKs).
- 2026-08-02 · P1.4: client better-sqlite3 + migrate al arrancar (`DATABASE_PATH`).
- 2026-08-02 · P1.5: seed idempotente (12 categorías + 7 cuentas). Fase 1 hecha.
- 2026-08-02 · **Pivot:** multi-usuario + Postgres + JWT httpOnly; host sigue en server casero.
  Reabiertos P1.2–P1.5. Auth pasa a Fase 2; CRUD a Fase 3. SQLite queda obsoleto.
- 2026-08-02 · P1.2: types con `User` + `userId` en entidades de dominio.
- 2026-08-02 · P1.3: schema Drizzle Postgres + migración; SQLite eliminado.
- 2026-08-02 · P1.4: client Postgres (`DATABASE_URL`) + migrate al arrancar; compose `db` en :5433.
- 2026-08-02 · P1.5: seed por usuario idempotente + aislamiento. Fase 1 (pivot) hecha.
- 2026-08-02 · P2.1: env fail-fast + sign/verify JWT (`sub` = userId).
- 2026-08-02 · P2.2: register/login/logout/me + cookie JWT + seed al registrar.
- 2026-08-02 · P2.3: middleware auth + rate-limit login/register. Fase 2 hecha.
- 2026-08-02 · P3.1: schemas zod + parseBody → 400 `{ error }`.
- 2026-08-02 · P3.2: `/api/accounts` CRUD scoped por usuario.
- 2026-08-02 · P3.3: `/api/categories` CRUD scoped por usuario.
- 2026-08-02 · P3.4: `/api/transactions` con filtros y paginación.
- 2026-08-02 · P3.5: `/api/budgets` CRUD scoped. Fase 3 hecha.
- 2026-08-02 · P4.1: router `/{locale}/…` + redirect `/` → `/es`.
- 2026-08-02 · P4.2: diccionario `es` + helper `t()`.
- 2026-08-02 · P4.3: React Query + api client + AuthGuard.
- 2026-08-02 · P4.4: pantallas Login y Registro.
- 2026-08-02 · P4.5: layout, nav, tema y logout.
- 2026-08-02 · P4.6: UI transacciones (tabla + alta/edición). Fase 4 hecha.
- 2026-08-02 · Fix UI: login/registro según Directions 8a/8b (split terracota + slogan).
- 2026-08-02 · Regla dura: UI solo según Directions (CLAUDE.md).
- 2026-08-02 · P5.1: `shared/stats.ts` + vitest dataset canónico julio 2026 (todos los KPIs cuadran).
- 2026-08-02 · P5.2: anillo generativo 14a (logo/favicon/KPI), GET `/api/stats`, dashboard 1b (hero+objetivo+KPIs).
- 2026-08-02 · fix(dev): API en :3010 (proxy Vite); evita choque con ApiArena en :3000.
- 2026-08-02 · P5.3: Recharts gasto mensual + ranking categorías; estados vacío/carga/un punto (11b).
- 2026-08-02 · P5.4: conclusiones por reglas (over / heads-up / on-track); Fase 5 hecha.
- 2026-08-02 · P6.1: UI presupuestos Envelopes (12a) con estados Over/Justo/% + alta/edición.
- 2026-08-02 · P6.2: objetivo editable + progreso real (Savings) + mover sobrante; Fase 6 hecha.
- 2026-08-02 · P7.1: PapaParse + detección CSV (ES/US) + UI subida/mapeo (Directions 7a/7b).
- 2026-08-02 · P7.2–P7.4: preview + batch + dedupe + reglas; Fase 7 hecha.
- 2026-08-02 · P8.1–P8.3: Dockerfile + compose app/db; e2e health, aislamiento, persistencia, dedupe; plan core cerrado.
- 2026-08-02 · P9.1–P9.4: PWA, backup JSON, Caddy HTTPS, REGISTRATION_OPEN; plan completo.
- 2026-08-03 · README operativo (dev/prod/HTTPS/registro) + definición de hecho marcada.
- 2026-08-20 · Post-plan: Cuentas propias (entidad opcional) + tarjetas por cuenta; pestaña `/accounts`; tarjeta opcional en movimientos; soft-archive.
- 2026-08-20 · Post-plan: Presupuestos → Límites (nav/ruta `/limits`, copy orientativo; API `budgets` intacta).
