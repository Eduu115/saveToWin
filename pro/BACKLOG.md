# Backlog saveToWin

Pendiente, por prioridad. Repo: **núcleo** = público (`saveToWin`), **pro** = este.
Al hacer uno, se mueve a «Hecho» con la fecha y el PR.

## Fiabilidad y operación

- [ ] **Copias fuera del servidor** (núcleo/ops): copiar cifrado lo que deja `ops/backup.sh`
      a otro sitio (p. ej. `restic` → Backblaze B2). Hoy las copias viven en el mismo disco.
- [ ] **Aviso de caída**: monitor externo (healthchecks.io / UptimeRobot) sobre `/api/health`;
      que `backup.sh` y `deploy.sh` hagan ping al terminar para detectar si dejan de correr.
- [ ] **Versión nueva a la primera** (núcleo): el service worker sirve primero la caché y tras
      un despliegue hay que recargar dos veces. Pasar `index.html` a «red primero».
- [ ] **Fecha por defecto en UTC** (núcleo): entre las 00:00 y la 01:00/02:00 el alta de
      movimiento propone el día anterior (`toISOString`). Usar la fecha local.
- [ ] **CI en GitHub Actions** (núcleo y pro): `tsc` + tests en cada PR.
- [ ] **Disco del servidor al 84 %**: revisar volúmenes huérfanos (≈4,5 GB reclamables, de
      varios proyectos: confirmar antes de borrar nada que no sea de saveToWin).

## Negocio

- [ ] **Cobro** (pro): Lemon Squeezy o Paddle (merchant of record: IVA UE, facturas) +
      webhook que active/caduque `pro_plans`; prueba de 14 días. Después, pasar
      `PRO_ENFORCE_PLANS` por `docker-compose` y activarlo.
- [ ] **Landing en savetowin.app** (pro): qué es, capturas, precio, «open source y tus datos
      no se ceden». Hoy la raíz va directa al login.
- [ ] **Legal antes de cobrar**: NIF y domicilio en Privacidad y Aviso legal; buzón
      `privacidad@savetowin.app` (Cloudflare Email Routing → Gmail); revisión por un abogado;
      ¿cubrir LGPD (Brasil) si hay usuarios allí?

## Producto

- [ ] **Bancos españoles en un clic** (núcleo): mapeos CSV listos para Santander, BBVA,
      CaixaBank e ING.
- [ ] **«Convertir en suscripción»** (pro): botón en el consejo de cargos recurrentes.
- [ ] **Avisos por correo** al acercarse a un límite (pro), con Resend.
- [ ] **Hogar compartido** (pro): dos personas con los mismos gastos.

## Hecho

- 2026-10-15 · Cambiar la contraseña cierra las demás sesiones (núcleo #14).
- 2026-10-15 · Copias cada 2 días y despliegue diario a las 4:00 por cron (núcleo #15).
