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
| DB | SQLite (un fichero) + Drizzle ORM (`better-sqlite3`) |
| Validación | zod en los límites de la API |
| Dinero | **entero de céntimos**, nunca floats. Formato **es-ES** (`1.234,56 €`) solo al mostrar |
| Fechas | texto ISO `YYYY-MM-DD` para la fecha del movimiento |
| Auth | 1 usuario · password argon2 en env · cookie sesión httpOnly |
| **Idioma UI** | **Español**. Copys en un diccionario `es` (sin librería i18n pesada aún) |
| **Rutas** | `/{locale}/{ruta-en-inglés}` → `/es/transactions`. `/` redirige a `/es`. Dominio prod `savetowin.app` |
| **Categorías/cuentas** | **clave estable en inglés** (`Groceries`, `savings`…) + **etiqueta ES** (`Alimentación`, `Ahorro`…). El color `--cN` va por clave, no por idioma |
| Diseño | Dirección **1b**. Tokens en `docs/tokens.css`. Public Sans + iconos Lucide **auto-alojados** |
| Logo | **Generativo** (anillo de 2 círculos, arco = % ahorro). Sirve de logo, favicon y KPI. No hay archivo de marca |
| Tests | vitest solo para `money` y `stats`; el resto, aceptación manual por tarea |
| Despliegue | Docker Compose en servidor casero; DB en volumen |

## Convenciones

- **Dinero:** siempre céntimos (`integer`). `parseAmountToCents` al entrar,
  `formatCents` (es-ES) al salir. Nunca aritmética con floats.
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

**Objetivo:** dinero correcto + esquema SQLite con semilla canónica.

- **P1.1** — `shared/money.ts`: `parseAmountToCents`, `formatCents` (es-ES),
  `addCents`, `sumCents` + **`money.test.ts`** (vitest).
  · Aceptación: `parse("0,1")+parse("0,2")===30`; round-trip; entradas inválidas rechazadas; `npm test` verde.
- **P1.2** — `shared/types.ts`: `Account`, `Category`, `Transaction`, `Budget`.
  Categoría/cuenta con `key` (EN, estable) + `label` (ES) + `color` (cN).
  · Aceptación: tipos compilan e importan desde web y server.
- **P1.3** — `server/db/schema.ts` (Drizzle): `amount` integer (céntimos), `date`
  text ISO, FKs con `on delete` sensato.
  · Aceptación: genera migración sin error.
- **P1.4** — `server/db/client.ts`: conexión `better-sqlite3` a `DATABASE_PATH`,
  migra al arrancar.
  · Aceptación: arrancar crea `data.db` con las tablas.
- **P1.5** — `server/db/seed.ts` idempotente: **12 categorías** (Groceries·Dining
  out·Transport·Tech·Subscriptions·Digital & games·Shopping·Home & bills·Health·
  Education·Travel·Other) con label ES + color `c1..c12` + tipo; **7 tipos de
  cuenta** (Current·Savings·Transfer·Bizum·Bank card·Prepaid card·e-cash card).
  · Aceptación: seed dos veces no duplica; insert/select de una transacción da céntimos correctos.

## Fase 2 — API CRUD

**Objetivo:** endpoints REST validados para las cuatro entidades.

- **P2.1** — zod schemas + helper de forma de error única.
  · Aceptación: cuerpo inválido → `400` con `{ error: {...} }`.
- **P2.2** — `/api/accounts` (GET/POST/PATCH/DELETE). · Aceptación: CRUD por `curl`.
- **P2.3** — `/api/categories` (GET/POST/PATCH/DELETE). · Aceptación: CRUD por `curl`.
- **P2.4** — `/api/transactions` (GET con `from,to,categoryId,accountId,type,limit,offset`;
  POST/PATCH/DELETE). · Aceptación: filtros acotan; CRUD ok.
- **P2.5** — `/api/budgets` (GET/POST/PATCH/DELETE). · Aceptación: CRUD por `curl`.

## Fase 3 — Autenticación (1 usuario)

**Objetivo:** proteger la API con login simple pero seguro sobre la red.

- **P3.1** — CLI para generar `AUTH_PASSWORD_HASH` (argon2) + vars en `.env.example`
  (`AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, `SESSION_SECRET`).
  · Aceptación: el CLI imprime un hash verificable.
- **P3.2** — `POST /api/auth/login`, `POST /logout`, `GET /me`. Cookie httpOnly +
  SameSite=Lax (+Secure en prod). · Aceptación: login fija cookie; `me` la valida.
- **P3.3** — Middleware protege todo `/api/*` salvo `login`/`health`. Rate-limit
  básico en login (`// ponytail: contador en memoria, mover a store si >1 proceso`).
  · Aceptación: sin cookie → `401`; credenciales malas → `401`.

## Fase 4 — Frontend base + i18n

**Objetivo:** registrar y ver movimientos desde el navegador, en español, rutas i18n.

- **P4.1** — Router con rutas `/{locale}/…` (segmentos en inglés: `dashboard`,
  `transactions`, `budgets`, `import`, `login`). `/` → `/es`. Locale inválido → `/es`.
  · Aceptación: navegar a `/es/transactions` funciona; `/` redirige.
- **P4.2** — Diccionario `es` + helper `t()`. Todo copy pasa por `t`.
  · Aceptación: no hay literales de UI hardcodeados fuera del diccionario.
- **P4.3** — `QueryClientProvider`, `api/client.ts` tipado (maneja error y cookies),
  guard de auth (401 → `/es/login`). · Aceptación: sin sesión redirige a login.
- **P4.4** — Pantalla **Login** (ES). · Aceptación: login entra a la app.
- **P4.5** — Layout + nav (Dashboard·Transactions·Budgets·Import) con iconos Lucide
  y toggle de tema. · Aceptación: navegación entre secciones; tema persiste.
- **P4.6** — **Transacciones**: tabla (`formatCents`, tabular-nums) + alta/edición
  (importe es-ES → céntimos con `parseAmountToCents`; selects de categoría/cuenta).
  React Query con invalidación + `refetchOnWindowFocus`.
  · Aceptación: crear un movimiento persiste tras recarga y se ve en un **2º dispositivo**.

## Fase 5 — Dashboard, estadísticas, conclusiones y logo

**Objetivo:** la parte visual y resolutiva.

- **P5.1** — Módulo `stats`: gasto por categoría, mensual (ingresos vs gastos),
  **tasa de ahorro**, presupuesto vs real, mayores variaciones + **`stats.test.ts`**
  con el **dataset canónico** (ver CLAUDE.md). · Aceptación: los números del test
  cuadran con el dataset; `npm test` verde.
- **P5.2** — KPIs + **componente anillo generativo** (SVG 2 círculos, arco = % ahorro),
  reutilizado como logo y favicon. · Aceptación: el anillo refleja el % real del objetivo.
- **P5.3** — Gráficos Recharts (los 5 tipos del diseño), colores desde tokens,
  estados vacío/carga/error. · Aceptación: dashboard cuadra con la tabla de transacciones.
- **P5.4** — Conclusiones por reglas (tarjetas de insight con umbral claro).
  · Aceptación: con datos que disparan una regla, aparece su tarjeta; si no, no.

## Fase 6 — Presupuestos y objetivo de ahorro

- **P6.1** — UI de presupuestos por categoría (límite mensual, barra vs real,
  over/under con **icono + texto**, no solo color). · Aceptación: superar un límite muestra el aviso.
- **P6.2** — Objetivo de ahorro (cantidad/mes) + seguimiento.
  · Aceptación: el progreso refleja el ahorro real.

## Fase 7 — Import CSV del banco

- **P7.1** — Subida + PapaParse + paso de **mapeo de columnas** (fecha/importe/concepto).
  · Aceptación: distintos CSV se mapean sin tocar código.
- **P7.2** — Previsualización + inserción en lote a `/transactions`.
  · Aceptación: import de CSV de ejemplo crea los movimientos.
- **P7.3** — Deduplicado (fecha+importe+concepto). · Aceptación: reimportar el mismo fichero no duplica.
- **P7.4** — Auto-categorización por reglas de palabra clave; lo no reconocido →
  "Other". · Aceptación: las reglas categorizan lo esperado.

## Fase 8 — Despliegue en servidor casero

- **P8.1** — `Dockerfile` multi-stage (build web → build server con estáticos → runtime slim).
  · Aceptación: la imagen construye.
- **P8.2** — `docker-compose.yml` (1 servicio, `data.db` en volumen, `.env`,
  `restart: unless-stopped`) + `.env.example`. · Aceptación: `docker compose up -d --build` levanta.
- **P8.3** — Verificación end-to-end en el servidor. · Aceptación: accesible desde
  el móvil por IP de LAN; tras `restart` los datos persisten.

## Fase 9 — Opcionales (solo si se piden)

- **P9.1** — PWA (manifest + service worker) → instalable en el móvil.
- **P9.2** — Export/backup (descargar DB o JSON; import de ese JSON).
- **P9.3** — HTTPS/acceso externo con **Caddy** (TLS automático) para `savetowin.app`.

---

## Contrato de API

Todas bajo `/api`, JSON, importes en céntimos.

| Método | Ruta | Notas |
|--------|------|-------|
| GET/POST/PATCH/DELETE | `/accounts[/:id]` | `{name,type,initialBalance}` |
| GET/POST/PATCH/DELETE | `/categories[/:id]` | `{key,label,color,type,parentId?}` |
| GET | `/transactions` | `?from&to&categoryId&accountId&type&limit&offset` → `{items,total}` |
| POST/PATCH/DELETE | `/transactions[/:id]` | `{date,amount,type,categoryId,accountId,note?,tags?}` |
| GET/POST/PATCH/DELETE | `/budgets[/:id]` | `{categoryId,period,limit}` |
| POST | `/auth/login` · `/auth/logout` | cookie de sesión |
| GET | `/auth/me` | usuario o `401` |
| GET | `/health` | `{ ok: true }` (sin auth) |

## Definición de "hecho" (global)

- [ ] `npm run dev` levanta web+API; `npm run build && npm start` sirve todo desde un proceso.
- [ ] CRUD de las 4 entidades + auth.
- [ ] UI en español, rutas `/{locale}/…`, tokens de diseño aplicados (claro/oscuro).
- [ ] Dashboard cuadra con la tabla; conclusiones visibles; anillo de objetivo.
- [ ] Presupuestos e import CSV operativos.
- [ ] `docker compose up` accesible desde el móvil; datos persistentes.
- [ ] `npm test` (money, stats) en verde.

## Fuera de alcance (no construir sin pedirlo)

Multi-usuario · sync en tiempo real · categorización con IA · Postgres ·
librería i18n pesada mientras solo haya español · cualquier abstracción sin
segundo caso de uso real.
