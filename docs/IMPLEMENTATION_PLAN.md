# Plan de implantación — saveToWin

> Plan granular por fases. Cada tarea tiene un **ID estable** (`P<fase>.<n>`) que
> el tracker `docs/PROGRESS.md` referencia. Otro modelo/instancia puede retomar
> en frío: lee `CLAUDE.md` (reglas + protocolo), mira `PROGRESS.md` (qué está
> hecho), y ejecuta la siguiente tarea sin marcar. **No re-litigues decisiones.**

Punteros: `README.md` (visión) · `CLAUDE.md` (reglas y protocolo) ·
`docs/PROGRESS.md` (estado) · `docs/tokens.css` + `docs/tailwind.config.js`
(color, única fuente) · `docs/DESIGN_BRIEF.md` (encargo original) ·
`docs/fintech-app-design-specifications/project/saveToWin Directions.dc.html`
(specs pixel: layout, gráficos, componentes).

---

## Decisiones bloqueadas

| Tema | Decisión |
|------|----------|
| Lenguaje código | TypeScript en todo (web y server) |
| Monorepo | npm workspaces: `web/`, `server/`, `shared/` |
| Frontend | Vite + React + TS · TanStack Query · Recharts · PapaParse |
| Backend | Node + Hono (un proceso sirve `/api/*` y los estáticos del build) |
| DB | **PostgreSQL** + Drizzle ORM (driver `postgres`) |
| Validación | zod en los límites de la API |
| Dinero | **entero de céntimos**, nunca floats. Formato **es-ES** (`1.234,56 €`) solo al mostrar |
| Fechas | texto ISO `YYYY-MM-DD` para la fecha del movimiento |
| Usuarios | **Multi-usuario**. Registro abierto. Cada fila de dominio lleva `userId`; aislamiento obligatorio en API |
| Auth | Registro + login · password **argon2** en tabla `users` · **JWT** (access) en cookie **httpOnly** + SameSite=Lax (+Secure en prod) · logout borra cookie · rate-limit en login/register |
| **Idioma UI** | **Español**. Copys en un diccionario `es` (sin librería i18n pesada aún) |
| **Rutas** | `/{locale}/{ruta-en-inglés}` → `/es/transactions`. `/` redirige a `/es`. Dominio prod `savetowin.app` |
| **Categorías/cuentas** | **clave estable en inglés** (`Groceries`, `savings`…) + **etiqueta ES** (`Alimentación`, `Ahorro`…). El color `--cN` va por clave, no por idioma. Seed **por usuario** al registrarse |
| Diseño | Dirección **1b**. Tokens en `docs/tokens.css`. Public Sans + iconos Lucide **auto-alojados** |
| Logo | **Generativo** (anillo de 2 círculos, arco = % ahorro). Sirve de logo, favicon y KPI. No hay archivo de marca |
| Tests | vitest solo para `money` y `stats`; el resto, aceptación manual por tarea |
| Despliegue | Docker Compose en servidor casero: servicios **app + postgres**; volumen Postgres; `.env` |

### Por qué JWT en cookie (y no en `localStorage`)

El token es JWT (firmado con `JWT_SECRET`), pero viaja en cookie httpOnly para
mitigar XSS. El front no lee el token; el browser lo manda solo. `// ponytail:
access corto + refresh rotativo si el tráfico o la exposición crecen`.

## Convenciones

- **Dinero:** siempre céntimos (`integer`). `parseAmountToCents` al entrar,
  `formatCents` (es-ES) al salir. Nunca aritmética con floats.
- **Tenant:** `userId` en accounts/categories/transactions/budgets. Unique
  compuestos incluyen usuario (ej. `(userId, key)` en categorías).
- **Color:** solo vía tokens de `docs/tokens.css` / clases Tailwind. **Cero hex
  sueltos** en componentes. El gasto usa `--expense` (= `--fg-2`), sin color propio.
- **Accesibilidad (dura):** significado nunca solo por color — signo + flecha +
  etiqueta + posición + icono. AA (4.5:1 texto), foco único (`--sh-focus`),
  táctil ≥44px.
- **i18n:** todo copy visible pasa por `t('clave')`; claves de dominio en inglés,
  labels traducidos. `// ponytail: diccionario es, subir a react-i18next al 2º idioma`.
- **Errores API:** `{ error: { code, message, details? } }` + status correcto.
- **Atajos:** comentario `ponytail:` que nombre el techo y la vía de mejora.
- **Un commit por tarea:** `P<id>: <resumen>`. Marca la tarea en `PROGRESS.md`.

---

## Fase 0 — Scaffold y tooling

**Objetivo:** monorepo que arranca en dev, con tokens de diseño aplicados.

- **P0.1** — `git init` + `.gitignore` (`node_modules`, `dist`, `*.db`, `.env`, `.DS_Store`).
  · Aceptación: `git status` limpio salvo lo previsto.
- **P0.2** — `package.json` raíz (`workspaces: [shared, server, web]`) + scripts
  `dev` / `build` / `start` + `tsconfig.base.json`.
  · Aceptación: `npm install` resuelve los tres workspaces.
- **P0.3** — Workspace `web`: Vite + React + TS. Página mínima.
  · Aceptación: `npm run dev` sirve la web.
- **P0.4** — Workspace `server`: Hono con `GET /api/health` → `{ ok: true }`.
  · Aceptación: `curl /api/health` responde `ok`.
- **P0.5** — Cablear dev (Vite proxya `/api` → server) y prod (server sirve
  `server/public` del build de web).
  · Aceptación: la página muestra el resultado de `/api/health` de punta a punta.
- **P0.6** — Tailwind + `docs/tokens.css` + `docs/tailwind.config.js` integrados en
  `web`. Public Sans (OFL) y los ~40 iconos Lucide en uso **auto-alojados**
  (nada de CDN). Toggle de tema claro/oscuro con `[data-theme]`.
  · Aceptación: un componente usa `bg-surface text-ink` y cambia con el tema; fuentes cargan sin red externa.

## Fase 1 — Dominio y datos

**Objetivo:** dinero correcto + esquema **Postgres** multi-usuario + seed por usuario.

- **P1.1** — `shared/money.ts`: `parseAmountToCents`, `formatCents` (es-ES),
  `addCents`, `sumCents` + **`money.test.ts`** (vitest).
  · Aceptación: `parse("0,1")+parse("0,2")===30`; round-trip; entradas inválidas rechazadas; `npm test` verde.
- **P1.2** — `shared/types.ts`: `User`, `Account`, `Category`, `Transaction`, `Budget`.
  Entidades de dominio con `userId`. Categoría/cuenta con `key` (EN) + `label` (ES) + `color` (cN).
  · Aceptación: tipos compilan e importan desde web y server.
- **P1.3** — `server/db/schema.ts` (Drizzle **Postgres**): tabla `users`; resto con
  `userId` FK; `amount` integer (céntimos); `date` text ISO; FKs `on delete` sensato;
  uniques por usuario. Eliminar restos SQLite (`better-sqlite3`, migraciones sqlite).
  · Aceptación: `drizzle-kit generate` sin error.
- **P1.4** — `server/db/client.ts`: conexión a `DATABASE_URL` (Postgres), migra al arrancar.
  Dev: Postgres vía Docker (`docker compose up db -d`) o instancia local.
  · Aceptación: arrancar aplica migraciones; tablas existen en Postgres.
- **P1.5** — `server/db/seed.ts`: función **idempotente por usuario** que crea las
  **12 categorías** (Groceries·Dining out·Transport·Tech·Subscriptions·Digital & games·
  Shopping·Home & bills·Health·Education·Travel·Other) + **7 cuentas** (Current·Savings·
  Transfer·Bizum·Bank card·Prepaid card·e-cash card). Se invoca al **registrar**.
  · Aceptación: seed dos veces al mismo user no duplica; insert/select de una
  transacción de ese user da céntimos correctos; otro user no ve esas filas.

## Fase 2 — Autenticación multi-usuario

**Objetivo:** registro/login sólidos; JWT en cookie httpOnly; API protegida.

**Orden:** esta fase va **antes** del CRUD (Fase 3) para no exponer datos sin dueño.

- **P2.1** — Vars en `.env.example`: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`
  (ej. `1d`). Helper firmar/verificar JWT (payload: `sub` = userId).
  · Aceptación: token firmado se verifica; secreto ausente → fail fast al arrancar.
- **P2.2** — `POST /api/auth/register` `{email,password,name?}` (zod: email válido,
  password ≥8), argon2 hash, crea user, **seed** del user, setea cookie JWT.
  `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  Cookie httpOnly + SameSite=Lax (+Secure si `NODE_ENV=production`).
  · Aceptación: register+login fijan cookie; `me` devuelve user; logout limpia; email duplicado → `409`.
- **P2.3** — Middleware: protege `/api/*` salvo `auth/register`, `auth/login`, `health`.
  Rate-limit básico en register/login (`// ponytail: contador en memoria, mover a Redis/store si >1 proceso`).
  · Aceptación: sin cookie → `401`; password mala → `401`; tras N fallos → `429`.

## Fase 3 — API CRUD (scoped por usuario)

**Objetivo:** endpoints REST validados; **solo datos del user autenticado**.

- **P3.1** — zod schemas + helper de forma de error única.
  · Aceptación: cuerpo inválido → `400` con `{ error: {...} }`.
- **P3.2** — `/api/accounts` (GET/POST/PATCH/DELETE) filtrado por `userId`.
  · Aceptación: CRUD por `curl` con cookie; user A no ve/edita de user B.
- **P3.3** — `/api/categories` (GET/POST/PATCH/DELETE) igual.
  · Aceptación: CRUD + aislamiento.
- **P3.4** — `/api/transactions` (GET con `from,to,categoryId,accountId,type,limit,offset`;
  POST/PATCH/DELETE) igual.
  · Aceptación: filtros acotan; aislamiento; CRUD ok.
- **P3.5** — `/api/budgets` (GET/POST/PATCH/DELETE) igual.
  · Aceptación: CRUD + aislamiento.

## Fase 4 — Frontend base + i18n

**Objetivo:** registrarse, entrar y gestionar movimientos en el navegador.

- **P4.1** — Router `/{locale}/…` (`dashboard`, `transactions`, `budgets`, `import`,
  `login`, `register`). `/` → `/es`. Locale inválido → `/es`.
  · Aceptación: `/es/transactions` ok; `/` redirige.
- **P4.2** — Diccionario `es` + helper `t()`. Todo copy pasa por `t`.
  · Aceptación: no hay literales de UI hardcodeados fuera del diccionario.
- **P4.3** — `QueryClientProvider`, `api/client.ts` tipado (cookies/`credentials: 'include'`,
  errores), guard (401 → `/es/login`).
  · Aceptación: sin sesión redirige a login.
- **P4.4** — Pantallas **Login** y **Registro** (ES).
  · Aceptación: register crea cuenta y entra; login entra.
- **P4.5** — Layout + nav (Dashboard·Transactions·Budgets·Import) + toggle tema + logout.
  · Aceptación: navegación; tema persiste; logout vuelve a login.
- **P4.6** — **Transacciones**: tabla (`formatCents`, tabular-nums) + alta/edición.
  React Query con invalidación + `refetchOnWindowFocus`.
  · Aceptación: crear movimiento persiste tras recarga; visible en 2º dispositivo
  **con la misma cuenta**; otra cuenta no lo ve.

## Fase 5 — Dashboard, estadísticas, conclusiones y logo

**Objetivo:** la parte visual y resolutiva (datos del usuario logueado).

- **P5.1** — Módulo `stats` + **`stats.test.ts`** con dataset canónico.
  · Aceptación: números del test cuadran; `npm test` verde.
- **P5.2** — KPIs + anillo generativo (logo/favicon/objetivo).
  · Aceptación: el anillo refleja el % real del objetivo del user.
- **P5.3** — Gráficos Recharts + estados vacío/carga/error.
  · Aceptación: dashboard cuadra con transacciones del user.
- **P5.4** — Conclusiones por reglas.
  · Aceptación: regla disparada → tarjeta; si no, no.

## Fase 6 — Presupuestos y objetivo de ahorro

- **P6.1** — UI presupuestos (over/under con icono + texto).
  · Aceptación: superar límite muestra aviso.
- **P6.2** — Objetivo de ahorro + seguimiento.
  · Aceptación: progreso = ahorro real del user.

## Fase 7 — Import CSV del banco

- **P7.1** — Subida + PapaParse + mapeo de columnas.
  · Aceptación: distintos CSV sin tocar código.
- **P7.2** — Previsualización + inserción en lote (scoped al user).
  · Aceptación: import crea movimientos del user.
- **P7.3** — Deduplicado (fecha+importe+concepto **por user**).
  · Aceptación: reimportar no duplica.
- **P7.4** — Auto-categorización por reglas; fallback "Other".
  · Aceptación: reglas categorizan lo esperado.

## Fase 8 — Despliegue en servidor casero

- **P8.1** — `Dockerfile` multi-stage de la app.
  · Aceptación: imagen construye.
- **P8.2** — `docker-compose.yml`: servicios **`app`** + **`db` (Postgres)**;
  volumen Postgres; red interna; `.env.example` (`DATABASE_URL`, `JWT_SECRET`, …);
  `restart: unless-stopped`.
  · Aceptación: `docker compose up -d --build` levanta ambos; app migra sola.
- **P8.3** — Verificación e2e en el server. · Aceptación: accesible desde móvil
  (LAN o `savetowin.app`); tras `restart` los datos Postgres persisten; dos users
  no se ven entre sí.

## Fase 9 — Opcionales (solo si se piden)

- **P9.1** — PWA.
- **P9.2** — Export/backup (JSON del user; import).
- **P9.3** — HTTPS/Caddy para `savetowin.app`.
- **P9.4** — Invites / cerrar registro abierto (`REGISTRATION_OPEN=false`).

---

## Contrato de API

Todas bajo `/api`, JSON, importes en céntimos. Salvo `health` y auth pública,
requieren cookie JWT.

| Método | Ruta | Notas |
|--------|------|-------|
| POST | `/auth/register` | `{email,password,name?}` → user + cookie + seed |
| POST | `/auth/login` · `/auth/logout` | cookie JWT |
| GET | `/auth/me` | user o `401` |
| PATCH | `/auth/me` | `{ savingsGoalCents?, name? }` |
| GET/POST/PATCH/DELETE | `/accounts[/:id]` | scoped `userId` |
| GET/POST/PATCH/DELETE | `/categories[/:id]` | scoped `userId` |
| GET | `/transactions` | `?from&to&…` → `{items,total}` scoped |
| POST/PATCH/DELETE | `/transactions[/:id]` | scoped |
| GET/POST/PATCH/DELETE | `/budgets[/:id]` | scoped |
| GET | `/stats` | `?period=YYYY-MM` → KPIs + objetivo + racha |
| GET | `/health` | `{ ok: true }` (sin auth) |

## Definición de "hecho" (global)

- [ ] `npm run dev` (+ Postgres) levanta web+API; `docker compose up` en prod.
- [ ] Registro/login multi-usuario + JWT httpOnly + rate-limit.
- [ ] CRUD de las 4 entidades **aislado por usuario**.
- [ ] UI en español, rutas `/{locale}/…`, tokens claro/oscuro.
- [ ] Dashboard, presupuestos, import CSV operativos.
- [ ] Dos usuarios en el mismo server no ven los datos del otro.
- [ ] `npm test` (money, stats) en verde.

## Fuera de alcance (no construir sin pedirlo)

OAuth/social login · 2FA · sync realtime · categorización con IA ·
billing/SaaS comercial · librería i18n pesada mientras solo haya español ·
cualquier abstracción sin segundo caso de uso real.
