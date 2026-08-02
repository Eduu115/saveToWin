# Estado del proyecto — saveToWin

Tracker vivo. **Fuente de verdad de qué está hecho y qué falta.** Uso: sigue el
protocolo de `CLAUDE.md` → trabaja la tarea del **Cursor**, márcala, actualiza
el Cursor y añade una línea al Log. `[ ]` pendiente · `[~]` en curso · `[x]` hecho.

## Cursor

- **Fase actual:** Fase 0 — Scaffold y tooling
- **Próxima tarea:** `P0.4` — server: Hono + GET /api/health

## Tablero de fases

| Fase | Estado |
|------|--------|
| 0 · Scaffold y tooling | 🔄 en curso |
| 1 · Dominio y datos | ⬜ pendiente |
| 2 · API CRUD | ⬜ pendiente |
| 3 · Auth | ⬜ pendiente |
| 4 · Frontend base + i18n | ⬜ pendiente |
| 5 · Dashboard / stats / logo | ⬜ pendiente |
| 6 · Presupuestos y ahorro | ⬜ pendiente |
| 7 · Import CSV | ⬜ pendiente |
| 8 · Despliegue | ⬜ pendiente |
| 9 · Opcionales | ⬜ pendiente |

## Checklist (detalle en `docs/IMPLEMENTATION_PLAN.md` por ID)

### Fase 0 — Scaffold y tooling
- [x] P0.1 · git init + .gitignore
- [x] P0.2 · package.json raíz (workspaces) + scripts + tsconfig.base
- [x] P0.3 · web: Vite + React + TS
- [ ] P0.4 · server: Hono + GET /api/health
- [ ] P0.5 · cablear dev (proxy) y prod (server sirve build de web)
- [ ] P0.6 · Tailwind + tokens + Public Sans/Lucide self-hosted + toggle tema

### Fase 1 — Dominio y datos
- [ ] P1.1 · money.ts + money.test.ts
- [ ] P1.2 · shared/types.ts (key EN + label ES)
- [ ] P1.3 · Drizzle schema (céntimos, fecha ISO, FKs)
- [ ] P1.4 · db client + migrate al arrancar
- [ ] P1.5 · seed idempotente (12 categorías + 7 cuentas)

### Fase 2 — API CRUD
- [ ] P2.1 · zod + forma de error única
- [ ] P2.2 · /api/accounts
- [ ] P2.3 · /api/categories
- [ ] P2.4 · /api/transactions (+ filtros/paginación)
- [ ] P2.5 · /api/budgets

### Fase 3 — Auth
- [ ] P3.1 · CLI hash argon2 + env vars
- [ ] P3.2 · login/logout/me + cookie sesión
- [ ] P3.3 · middleware protege /api/* + rate-limit login

### Fase 4 — Frontend base + i18n
- [ ] P4.1 · router /{locale}/… + redirect / → /es
- [ ] P4.2 · diccionario es + helper t()
- [ ] P4.3 · React Query + api client + guard de auth
- [ ] P4.4 · pantalla Login
- [ ] P4.5 · layout + nav + toggle tema
- [ ] P4.6 · Transacciones: tabla + alta/edición

### Fase 5 — Dashboard / stats / logo
- [ ] P5.1 · módulo stats + stats.test.ts (dataset canónico)
- [ ] P5.2 · KPIs + anillo generativo (logo/favicon/objetivo)
- [ ] P5.3 · gráficos Recharts + estados
- [ ] P5.4 · conclusiones por reglas

### Fase 6 — Presupuestos y ahorro
- [ ] P6.1 · UI presupuestos (over/under con icono+texto)
- [ ] P6.2 · objetivo de ahorro + seguimiento

### Fase 7 — Import CSV
- [ ] P7.1 · subida + PapaParse + mapeo de columnas
- [ ] P7.2 · previsualización + inserción en lote
- [ ] P7.3 · deduplicado
- [ ] P7.4 · auto-categorización por reglas

### Fase 8 — Despliegue
- [ ] P8.1 · Dockerfile multi-stage
- [ ] P8.2 · docker-compose + volumen + .env.example
- [ ] P8.3 · verificación end-to-end (móvil + persistencia)

### Fase 9 — Opcionales
- [ ] P9.1 · PWA
- [ ] P9.2 · export/backup
- [ ] P9.3 · HTTPS/Caddy (savetowin.app)

## Log

- 2026-08-02 · Documentación y diseño listos (plan granular, reglas, tracker). Pendiente arrancar P0.1.
- 2026-08-02 · P0.1: git init + .gitignore (`node_modules`, `dist`, `*.db`, `.env`, `.DS_Store`).
- 2026-08-02 · P0.2: monorepo npm workspaces (`shared`, `server`, `web`) + scripts + tsconfig.base.
- 2026-08-02 · P0.3: workspace web con Vite + React + TS; página mínima.
