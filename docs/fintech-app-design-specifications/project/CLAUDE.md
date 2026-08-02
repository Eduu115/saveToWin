# saveToWin — contexto fijo del proyecto

Brief: `uploads/DESIGN_BRIEF.md`. Trabajo entregado: `saveToWin Directions.dc.html`.

## Dirección elegida (bloqueada)

**1b — Cálido y motivador.** No volver a proponer 1a ni 1c. Todo lo nuevo se
construye sobre 1b. Los tokens exactos (claro y oscuro) viven en la clase de
lógica de `saveToWin Directions.dc.html` como `B_LIGHT` / `B_DARK` — leerlos de
ahí, no reinventarlos.

Resumen: Public Sans (400/500/600/700/800, también para importes con
`font-variant-numeric: tabular-nums`, sin fuente mono). Papel cálido
`#FAF6F0`, superficie `#FFFDFA`, acento terracota `#A8471C`, ingreso teal
`#0E6A6F`, **gasto en tinta neutra `#6D5F52` (sin color propio)**, ahorro verde
`#2F6A43`, aviso `#92600B`. Radios 14 / 20 / 100px en píldoras, fila 52px,
sombras suaves, separación por espacio y no por línea. Paleta categórica de 12:
`oklch(0.60 0.155 H)` en claro y `oklch(0.74 0.14 H)` en oscuro, con
H = [151, 46, 256, 306, 206, 336, 26, 96, 181, 271, 126] + gris `0.02 70`.
Secuencial sobre tono 45.

## Decisiones ya tomadas

- UI en **inglés**; importes en formato **es-ES** (`1.234,56 €`).
- 12 categorías: Groceries · Dining out · Transport · Tech · Subscriptions ·
  Digital & games · Shopping · Home & bills · Health · Education · Travel · Other.
  Los subtipos de "compras digitales" van como etiquetas dentro de
  *Digital & games*, no como categorías propias.
- Cuentas: Current account, Savings account, Transfer, Bizum, Bank card,
  Prepaid card, e-cash card.
- Iconos **Lucide** (auto-alojables, SVG). Fuentes OFL auto-alojadas: en los
  mockups se cargan por CDN, en la implementación van servidas por el propio
  servidor.
- Entrega técnica: variables CSS **y** mapeo a Tailwind. React + Recharts.
- Datos de ejemplo canónicos (usar siempre los mismos): julio 2026, 68
  movimientos, ingreso 2.640,00 €, gasto 1.913,45 €, balance +726,55 €, tasa de
  ahorro 27,5 %, ahorrado 8.420,00 € de un objetivo de 12.000 € (70 %),
  presupuesto 2.300 € con 386,55 € restantes, media diaria 61,72 €.

## Accesibilidad (regla dura)

El gasto no lleva color propio. La señal de ingreso/gasto es **signo + flecha +
etiqueta + posición**; el color solo refuerza el ingreso, el ahorro y los
avisos. Nunca codificar significado solo con color. Contraste AA, foco visible,
objetivos táctiles ≥ 44px en móvil.
