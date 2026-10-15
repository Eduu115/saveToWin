# Backlog saveToWin

Pendiente, por prioridad. Repo: **núcleo** = público (`saveToWin`), **pro** = este.
Al hacer uno, se mueve a «Hecho» con la fecha y el PR.

## Fiabilidad y operación

- [ ] **Disco del servidor al 84 %**: revisar volúmenes huérfanos (≈4,5 GB reclamables, de
      varios proyectos: confirmar antes de borrar nada que no sea de saveToWin).

## Negocio

- [ ] **Gancho del premium** (pro): en vez del candado vacío, sus propios gráficos
      difuminados y «Tienes 3 consejos esperando; uno te ahorra ~112 €/año»; un consejo
      gratis en el dashboard.
- [ ] **Página Premium con precio** (pro): comparativa gratis/premium, prueba de 14 días,
      FAQ («si dejo de pagar, mis datos siguen ahí»). Imprescindible antes de cobrar.
- [ ] **Premium, ideas de la auditoría** (pro): Sobres (12a, con lo que sobra al mes
      siguiente y «sugerir límites»); suscripciones inteligentes (coste anual, subidas de
      precio); resumen semanal/mensual por correo; varias metas de ahorro; previsión de fin
      de mes con cargos futuros; Wrapped mensual compartible.

- [ ] **Cobro** (pro): Lemon Squeezy o Paddle (merchant of record: IVA UE, facturas) +
      webhook que active/caduque `pro_plans`; prueba de 14 días. Después, pasar
      `PRO_ENFORCE_PLANS` por `docker-compose` y activarlo.
- [ ] **Landing en savetowin.app** (pro): qué es, capturas, precio, «open source y tus datos
      no se ceden». Hoy la raíz va directa al login.
- [ ] **Legal antes de cobrar**: NIF y domicilio en Privacidad y Aviso legal; buzón
      `privacidad@savetowin.app` (Cloudflare Email Routing → Gmail); revisión por un abogado;
      ¿cubrir LGPD (Brasil) si hay usuarios allí?

## Producto

- [ ] **Saldos de cuentas y patrimonio** (núcleo) — *pendiente de decidir*: los traspasos
      a ahorro solo se apuntan en la cuenta de ahorro; hay que decidir de qué cuenta salen
      (preguntar al apuntar / cuenta principal) y añadir «Ajustar saldo» (saldo actual →
      saldo inicial calculado).
- [ ] **Importar Excel** (núcleo): «.xls pronto»; Santander, BBVA y CaixaBank exportan xlsx.
- [ ] **Reglas de categorización en la cuenta** (núcleo): hoy en localStorage; a la BD.
- [ ] **Movimientos, restos de 4a/4b**: «Columnas», edición en línea y deslizar para borrar.
- [ ] **Bancos españoles en un clic** (núcleo): mapeos CSV listos para Santander, BBVA,
      CaixaBank e ING.
- [ ] **«Convertir en suscripción»** (pro): botón en el consejo de cargos recurrentes.
- [ ] **Avisos por correo** al acercarse a un límite (pro), con Resend.
- [ ] **Hogar compartido** (pro): dos personas con los mismos gastos.

## Hecho

- 2026-10-15 · Cambiar la contraseña cierra las demás sesiones (núcleo #14).
- 2026-10-15 · Copias cada 2 días y despliegue diario a las 4:00 por cron (núcleo #15).
- 2026-10-15 · Versión nueva a la primera (SW con red primero), fecha por defecto en hora
  local (TZ=Europe/Madrid) y CI en GitHub Actions para los dos repos (núcleo #16).
- 2026-10-15 · Copia cifrada en Backblaze B2 (restic, región UE) con restauración probada, y
  avisos de healthchecks.io para copia, despliegue y web (núcleo #17, pro #8).
- 2026-10-15 · Auditoría: proyección y límite restante coherentes, € sin cortes,
  Suscripciones con alta y coste total (núcleo #18).
- 2026-10-15 · Movimientos 4a–4d: búsqueda, filtros, páginas, selección múltiple y CSV
  (núcleo #19). Categorías: crear, renombrar, color y archivar (núcleo #20).
