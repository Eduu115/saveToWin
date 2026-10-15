# Backlog saveToWin

Pendiente, por prioridad. Repo: **núcleo** = público (`saveToWin`), **pro** = este.
Al hacer uno, se mueve a «Hecho» con la fecha y el PR.

## Fiabilidad y operación

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
- 2026-10-15 · Versión nueva a la primera (SW con red primero), fecha por defecto en hora
  local (TZ=Europe/Madrid) y CI en GitHub Actions para los dos repos (núcleo #16).
- 2026-10-15 · Copia cifrada en Backblaze B2 (restic, región UE) con restauración probada, y
  avisos de healthchecks.io para copia, despliegue y web (núcleo #17, pro #8).
