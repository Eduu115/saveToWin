# saveToWin Pro (privado)

Capa premium de saveToWin. **Este repo es privado y nada de `pro/` puede llegar
al repo público** (`Eduu115/saveToWin`, AGPL-3.0).

## Cómo se trabaja

| Qué | Dónde |
|---|---|
| Núcleo (todo lo que ya es open source, arreglos, mejoras generales) | repo **público** `saveToWin` |
| Premium (estadísticas avanzadas, Wrapped, planes, cobro) | aquí: `server/pro/`, `web/src/pro/` y `pro/` |

- Remotos: `origin` = este repo privado; `upstream` = el público con el push
  **deshabilitado** (`git remote set-url --push upstream DISABLED`).
- Traer el núcleo: `git pull --no-rebase upstream main` (merge, nunca rebase) y
  luego `git push origin main`.
- Lo premium vive **solo** en `server/pro/`, `web/src/pro/` y `pro/`; el núcleo
  solo tiene los enganches genéricos (en el repo público) para cargarlos:
  - servidor: `server/src/index.ts` llama a `register(app)` de `server/pro/index.ts`;
  - web: `web/src/extension.ts` carga `pages` de `web/src/pro/index.ts`;
  - ventana de historial: pro fija `historyFrom` y el núcleo bloquea lo anterior.
- Producción (savetowin.app) despliega desde **este** repo con una deploy key
  de solo lectura.

## Reglas

- El premium se **valida en el servidor** (plan del usuario en la API); ocultar
  UI no protege nada.
- Las migraciones de `pro/` van en su propia carpeta y tabla de control para no
  chocar con la secuencia del núcleo.
- Los datos del usuario nunca se borran por bajar de plan: el plan gratis solo
  limita lo que se **muestra**.

## Funciones premium

| Función | Servidor | Web |
|---|---|---|
| Gráficos avanzados (11a): 12 meses, donut, ranking, ahorro acumulado, heatmap, límites visualizados | `GET /api/pro/analytics` | Análisis › Gráficos |
| Agrupaciones (6a/6c): conjuntos de categorías con límite opcional, cobertura | `/api/pro/groups` (CRUD) | Análisis › Agrupaciones |
| Consejos: heurísticas deterministas (`server/pro/insights.ts`) | `GET /api/pro/insights` | Análisis › Consejos |
| Wrapped: resumen anual en historias + imagen para compartir | `GET /api/pro/wrapped` | `/wrapped` |

- Todas exigen **premium en el servidor** (`402 PREMIUM_REQUIRED`). Excepción:
  la portada del Wrapped es gratis (para compartir y atraer).
- Tests de la lógica pura (heurísticas y Wrapped): `npx vitest run pro/tests`.

## Planes

- Tabla `pro_plans` (DDL idempotente al arrancar). Sin fila = gratis.
- La ventana de 60 días del plan gratis solo se aplica con `PRO_ENFORCE_PLANS=true`.
  Sin esa variable, nadie pierde historial. Las funciones nuevas (tabla de arriba)
  exigen premium siempre: no quitan nada, solo se añaden.
- Plan gratis: gráficos y estadísticas de los últimos `FREE_HISTORY_DAYS` (60)
  días; un mes que toca la ventana se ve entero.
- Asignar plan a mano (hasta que haya cobro), dentro del contenedor:
  `node dist/pro/set-plan.js <email> <free|premium> [YYYY-MM-DD]`
