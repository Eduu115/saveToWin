# saveToWin — reglas para agentes

App **self-hosted multi-usuario** para controlar gastos y ahorros: registro de
cuentas, movimientos (manual o CSV), categorización, dashboard con gráficos y
conclusiones. Corre en un **servidor casero** (Docker Compose); cualquiera con
acceso puede registrarse y usar su propio espacio de datos. Marca: **saveToWin**
· dominio prod `savetowin.app`.

**Antes de tocar nada, lee:** `docs/IMPLEMENTATION_PLAN.md` (qué hacer, por
tareas con ID) y `docs/PROGRESS.md` (qué está hecho y qué toca ahora).

---

## Protocolo de trabajo (cómo retomar en cualquier momento)

1. Lee este `CLAUDE.md`.
2. Abre `docs/PROGRESS.md` → coge la tarea marcada `[~]` (en curso) o la primera `[ ]`.
3. Lee su spec en `docs/IMPLEMENTATION_PLAN.md` por su ID (`P<fase>.<n>`).
4. Implementa **solo esa tarea**. No adelantes fases.
5. Corre su **criterio de aceptación**.
6. En `docs/PROGRESS.md`: marca `[x]`, actualiza el **Cursor** y añade una línea al **Log**.
7. Commit: `P<id>: <resumen>`. Repite.

Si algo es ambiguo, pregunta antes de construir. Si dejas un atajo, coméntalo
con `ponytail:` (nombra el techo y la vía de mejora).

## Reglas que no se negocian

- **Diseño = Directions:** toda UI se maqueta contra
  `docs/fintech-app-design-specifications/project/saveToWin Directions.dc.html`
  (y tokens en `docs/tokens.css`). **Prohibido** inventar layouts, login,
  dashboard, tablas o estados “parecidos”. Si el mockup existe, se replica
  (estructura, jerarquía, copy vía `t()`, tokens). Ante duda: lee el HTML
  del screen concreto **antes** de escribir JSX.
- **Dinero en céntimos** (`integer`). `parseAmountToCents` al entrar,
  `formatCents` (formato **es-ES**, `1.234,56 €`) al salir. Nunca floats.
- **Aislamiento por usuario:** toda fila de dominio lleva `userId`; queries y
  mutaciones **siempre** filtran por el usuario de la sesión. Nunca devolver
  datos de otro usuario.
- **Color solo por tokens** de `docs/tokens.css` (o clases Tailwind). Cero hex
  sueltos. El gasto usa `--expense` (= `--fg-2`): **no tiene color propio**.
- **Accesibilidad:** el significado nunca solo por color — signo + flecha +
  etiqueta + posición + icono. Contraste AA, foco único (`--sh-focus`), táctil ≥44px.
- **i18n:** UI en **español**; todo copy pasa por `t('clave')`. Rutas
  `/{locale}/{ruta-en-inglés}` (`/es/transactions`), `/` → `/es`. Claves de
  dominio en inglés (`Groceries`, `savings`), labels en español.
- **Fuentes/iconos auto-alojados:** Public Sans (OFL) y solo los iconos Lucide en
  uso. Nada de CDN ni servicios externos en runtime.
- **Validación** con zod en los límites de la API. Error: `{ error: { code, message, details? } }`.
- **Tests** solo para `money` y `stats` (vitest). El resto: aceptación manual por tarea.
- **No** añadir features, dependencias ni abstracciones fuera del plan.

## Stack (bloqueado)

TypeScript · monorepo npm workspaces (`web/`, `server/`, `shared/`) · Frontend
Vite + React + TanStack Query + Recharts + PapaParse · Backend Node + Hono (un
proceso sirve API + estáticos) · DB **PostgreSQL** + Drizzle (`postgres` /
`drizzle-orm`) · Auth **multi-usuario**: registro + login, password **argon2**,
**JWT** en cookie **httpOnly** (+ Secure en prod, SameSite=Lax) · Deploy Docker
Compose (**app + postgres**) en servidor casero.

## Dataset canónico (mockups y tests de `stats`)

Julio 2026 · 68 movimientos · ingreso 2.640,00 € · gasto 1.913,45 € · balance
+726,55 € · tasa de ahorro 27,5 % · ahorrado 8.420 € de 12.000 € (70 %) ·
presupuesto 2.300 € con 386,55 € restantes · media diaria 61,72 €.

## Dónde está cada cosa

- `docs/tokens.css` + `docs/tailwind.config.js` — color y tokens (única fuente).
- `docs/fintech-app-design-specifications/project/saveToWin Directions.dc.html` —
  specs pixel (layout, gráficos, componentes, el anillo-logo). Léelo para maquetar.
- `docs/DESIGN_BRIEF.md` — encargo de diseño original. `README.md` — visión.
