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

Datos en volumen `pgdata`. Backup JSON desde **Ajustes** (`GET/POST /api/backup`).
PWA instalable en build de producción (manifest + service worker).

---

## Seguridad

- Passwords con **argon2** (nunca en claro).
- **JWT** de acceso en cookie **httpOnly + SameSite** (+ Secure en prod).
- Rate-limit en register/login.
- Aislamiento estricto por `userId` en toda la API.
- Cerrar altas: `REGISTRATION_OPEN=false`.
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
