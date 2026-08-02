# saveToWin

App personal y self-hosted para controlar **gastos y ahorros**: registras tus
movimientos (a mano o importando CSV del banco), se categorizan, y un dashboard
te da gráficos, estadísticas y conclusiones accionables. Corre en tu servidor
casero y es accesible y sincronizada desde móvil y cualquier dispositivo.

Gratis: hardware propio, sin servicios de pago.

---

## Objetivo

- Meter pagos/ingresos y **categorizarlos** (categorías y subcategorías).
- **Sincronizado**: los datos viven en el servidor; cualquier dispositivo ve lo mismo.
- Dashboard **visual**: gasto por categoría y mes, evolución, tasa de ahorro,
  presupuesto vs real, mayores variaciones.
- **Conclusiones** automáticas por reglas (ej.: "restaurantes +30% vs tu media").

---

## Stack

| Capa | Elección | Por qué |
|------|----------|---------|
| Frontend | Vite + React + TypeScript | Rápido, ecosistema grande, TS evita bugs de dinero |
| Datos (cliente) | TanStack Query | Cachea y refetchea → sensación de "sync" gratis |
| Gráficos | Recharts | Declarativo, encaja con React |
| Import | PapaParse | Parsear CSV del banco |
| Backend | Node + TypeScript + Hono | Micro-framework TS; un proceso sirve API + frontend |
| Base de datos | SQLite + Drizzle ORM | Un fichero, cero servidor extra; queries tipadas + migraciones |
| Auth | 1 usuario, hash + cookie httpOnly | Mínimo seguro sobre la red |
| Despliegue | Docker Compose | `docker compose up -d` en el servidor casero |

**Regla no negociable:** el dinero se guarda como **entero de céntimos**
(`1234` = 12,34 €). Nunca floats — `0.1 + 0.2 !== 0.3`. El formateo a euros es
solo de presentación.

---

## Arquitectura

```
  Móvil / PC / tablet          Servidor casero (Docker)
  ┌───────────────┐            ┌──────────────────────────────┐
  │  Navegador    │  HTTPS/    │  Contenedor Node               │
  │  (React SPA)  │◄─────────► │  Hono:  /api/*  +  estáticos   │
  └───────────────┘   LAN o    │            │                   │
                      internet │            ▼                   │
                               │      SQLite (data.db)          │
                               │      en volumen persistente    │
                               └──────────────────────────────┘
```

Un único contenedor: el mismo proceso Node sirve el frontend compilado y la API.
La "sincronización" es directa: no hay estado por dispositivo, todos leen/escriben
la misma DB. Sin websockets ni offline-first por ahora (se refetchea al enfocar).

---

## Modelo de datos

```
Account   id · nombre · tipo (efectivo/banco/ahorro) · saldo_inicial(céntimos)
Category  id · nombre · color · icono · tipo (gasto/ingreso) · parent_id
Transaction  id · fecha · importe(céntimos) · tipo · category_id · account_id · nota · tags
Budget    id · category_id · periodo (mensual) · limite(céntimos)
```

---

## Estructura del repo

```
saveToWin/
├── docker-compose.yml        despliegue en el servidor casero
├── Dockerfile                multi-stage: build web → build server → runtime
├── shared/                   tipos TS compartidos web↔server (dinero, modelos)
├── server/
│   └── src/
│       ├── db/               schema Drizzle, migraciones, conexión SQLite
│       ├── routes/           transactions, categories, accounts, budgets, stats, auth
│       ├── lib/              money.ts (céntimos), auth/sesión
│       └── index.ts          arranca Hono, sirve API + estáticos
└── web/
    └── src/
        ├── api/              cliente fetch tipado
        ├── stats/            cálculo de insights/conclusiones
        ├── ui/               formulario, tabla, dashboard, gráficos
        └── app/              rutas + providers (React Query)
```

Monorepo con workspaces de npm para compartir tipos y no duplicar el modelo.

---

## Puesta en marcha (desarrollo)

```bash
npm install
npm run dev        # web (Vite) + server en paralelo
```

## Despliegue (servidor casero)

```bash
docker compose up -d --build
```

- La DB (`data.db`) se monta en un volumen → persiste entre reinicios y se
  respalda copiando ese fichero.
- Acceso desde móvil: por LAN basta la IP del servidor. Para acceso desde fuera
  de casa, poner **Caddy** delante (HTTPS automático). Ver *Seguridad*.

---

## Seguridad

- Un solo usuario. Contraseña **hasheada** (argon2), nunca en claro.
- Sesión en cookie **httpOnly + SameSite**.
- Si se expone a internet: **HTTPS obligatorio** (Caddy como reverse proxy con
  TLS automático). En LAN aislada, HTTP es tolerable pero no recomendado.

---

## Roadmap

1. **MVP** — alta manual, categorías, tabla, dashboard (gasto por categoría/mes), auth.
2. Presupuestos, objetivos de ahorro, import CSV del banco.
3. Conclusiones automáticas, export/backup, PWA (instalable en el móvil).

Fuera de alcance por ahora (YAGNI): multi-usuario, sync en tiempo real,
categorización con IA. Se añaden si hacen falta.

---

## Decisiones

- **Self-hosted, no cloud**: gratis y datos bajo tu control.
- **SQLite y no Postgres**: un usuario, un fichero, cero servidor de DB que mantener.
  Se migra a Postgres solo si algún día hay concurrencia real.
- **Un proceso sirve todo**: menos piezas que desplegar y vigilar.
- **Céntimos**: correctitud del dinero por encima de comodidad.
