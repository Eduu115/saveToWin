# saveToWin Pro (privado)

Capa premium de saveToWin. **Este repo es privado y nada de `pro/` puede llegar
al repo público** (`Eduu115/saveToWin`, AGPL-3.0).

## Cómo se trabaja

| Qué | Dónde |
|---|---|
| Núcleo (todo lo que ya es open source, arreglos, mejoras generales) | repo **público** `saveToWin` |
| Premium (estadísticas avanzadas, Wrapped, planes, cobro) | aquí, dentro de `pro/` |

- Remotos: `origin` = este repo privado; `upstream` = el público con el push
  **deshabilitado** (`git remote set-url --push upstream DISABLED`).
- Traer el núcleo: `git pull upstream main` (luego `git push origin main`).
- Lo premium vive **solo** en `pro/` (y en los puntos de enganche mínimos del
  núcleo) para que los pulls de `upstream` no den conflictos.
- Producción (savetowin.app) despliega desde **este** repo con una deploy key
  de solo lectura.

## Reglas

- El premium se **valida en el servidor** (plan del usuario en la API); ocultar
  UI no protege nada.
- Las migraciones de `pro/` van en su propia carpeta y tabla de control para no
  chocar con la secuencia del núcleo.
- Los datos del usuario nunca se borran por bajar de plan: el plan gratis solo
  limita lo que se **muestra**.
