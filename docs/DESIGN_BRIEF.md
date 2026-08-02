# Design brief — saveToWin (para Claude Design)

> Encargo del apartado visual y de UI de una app personal de finanzas. Tu salida
> alimentará una implementación en **React + Recharts**, self-hosted. Devuelve
> **propuestas** (2–3 direcciones) para que el dueño elija, más los tokens y
> specs para poder implementarlas. Lee también `README.md` y
> `docs/IMPLEMENTATION_PLAN.md` para el contexto técnico.

---

## 1. El producto

**saveToWin** es una app self-hosted para controlar **gastos y ahorros** de una
sola persona (su dueño). Registra movimientos (a mano o importando CSV del
banco), los categoriza, y muestra un **dashboard** con gráficos, estadísticas y
conclusiones accionables. Corre en un servidor casero y se usa desde el móvil y
el ordenador.

**Nombre / idea de marca:** "saveToWin" = *ahorrar para ganar*. Tono: sobrio y
de confianza (son finanzas), pero **motivador**, moderno, claro. Nada infantil,
nada recargado.

## 2. Usuario y contexto de uso

- Un único usuario, que conoce sus datos y entra a menudo.
- **Uso frecuente en móvil** para altas rápidas; uso en desktop para analizar.
- Necesita entender su situación **de un vistazo** y actuar (resolutivo).

## 3. Objetivos de diseño (los adjetivos del dueño → principios)

- **Intuitivo:** jerarquía clara, acciones primarias evidentes, cero fricción al
  añadir un gasto.
- **Categorizado:** las categorías son un ciudadano de primera clase — color e
  icono consistentes en toda la app.
- **Detallado:** permite profundizar (filtros, desglose) sin abrumar por defecto.
- **Visual:** los números importantes se ven como gráfico/indicador, no como texto plano.
- **Resolutivo:** cada pantalla responde a "¿y ahora qué?" — conclusiones y avisos, no solo datos.

## 4. Alcance del encargo (entregables)

1. **Sistema de color** con **tokens en modo claro Y oscuro** (como CSS
   variables):
   - Semánticos: fondo/superficie, texto, borde, primario/acento, **ingreso**,
     **gasto**, **ahorro**, **aviso/alerta**, éxito.
   - **Paleta categórica** de 8–12 colores para las categorías de gasto,
     distinguibles entre sí y **accesibles** (ver §6).
   - **Escala secuencial** (para intensidades/heatmap de gasto por día/mes).
2. **Tipografía:** familias (auto-alojadas, ver §5), escala de tamaños, pesos,
   uso de números tabulares para importes.
3. **Fundamentos:** espaciado, radios, sombras/elevación, grid responsive.
4. **Estilo de gráficos (Recharts):** ejes, rejilla, tooltips, leyendas,
   etiquetas, y sus estados. Guía de qué gráfico para qué dato.
5. **Iconografía de categorías** (set coherente, auto-alojable).
6. **Componentes clave:** barra/nav + layout, **tarjetas KPI**, **tabla de
   transacciones**, **formulario de alta** (importe, fecha, selector de
   categoría con color+icono, cuenta), **barra de presupuesto** (progreso vs
   límite), **tarjeta de conclusión/insight**, selector de rango de fechas.
7. **Pantallas a maquetar** (en **móvil y desktop** cada una):
   - **Dashboard** (KPIs + gráficos + conclusiones).
   - **Transacciones** (lista/tabla + alta/edición).
   - **Presupuestos** (límites y progreso; objetivo de ahorro).
   - **Import CSV** (subir → mapear columnas → previsualizar).
   - **Login** (1 usuario, minimal).
8. **Estados:** vacío / primera vez (onboarding sin datos), cargando, error,
   sin resultados en un filtro.

## 5. Restricciones técnicas (para que sea implementable)

- Se implementa en **React** con **Recharts**. Entrega el sistema como **CSS
  variables** + specs de componentes (compatible con CSS plano o Tailwind;
  indica cuál asumes).
- **Self-hosted y sin dependencias externas en runtime:** fuentes e iconos
  **auto-alojados** (nada de Google Fonts u otros CDN). Prioriza system font
  stack o una fuente libre embebible.
- **Mobile-first:** el móvil es el uso principal para altas.
- **Ligero:** sin librerías de UI pesadas ni frameworks visuales grandes;
  alineado con la filosofía minimalista del proyecto. No sobre-diseñar.

## 6. Consideraciones de visualización de datos (importante)

- **No codificar ingreso/gasto solo con rojo/verde:** falla con daltonismo
  (deuteranopia). Refuerza siempre con **signo, posición, etiqueta e icono**;
  el color es secundario. Propón una solución accesible explícita.
- **Una sola paleta categórica** reutilizada en *todos* los gráficos: la
  categoría "Comida" es el mismo color en el donut, en las barras y en la tabla.
- **Consistencia claro/oscuro:** los colores deben mantener contraste y
  legibilidad en ambos temas (no reutilices los mismos hex sin ajustar).
- Colores categóricos perceptualmente separables; secuenciales monótonos en
  luminosidad. Aplica buenas prácticas de dataviz.
- **Contraste AA** en texto y elementos; foco visible; **tamaños táctiles**
  cómodos en móvil.

## 7. Direcciones a explorar

Propón **2–3 direcciones** distintas para que el dueño elija (no una sola):

- **A — Fintech minimal neutro:** grises/neutros + un acento; foco en claridad y datos.
- **B — Cálido y motivador:** paleta más cálida, refuerza el lado "ganar/ahorro".
- **C — Dashboard oscuro por defecto:** modo oscuro como principal, acentos vivos para los gráficos.

Para cada dirección: muestra de paleta (claro+oscuro), tratamiento del
dashboard, y cómo se ven KPIs, tabla y una tarjeta de conclusión.

## 8. Formato de entrega

- Tokens de color y tipografía como **CSS variables** (claro y oscuro), pegables
  en el proyecto.
- Specs de los componentes clave (medidas, estados, variantes).
- Mockups de las 5 pantallas en móvil y desktop.
- Guía de gráficos (qué tipo, colores, estados).
- Notas de accesibilidad aplicadas.

## 9. Qué NO hacer

- No proponer dependencias de UI pesadas ni servicios/CDN externos.
- No depender solo del color para transmitir significado.
- No sobre-diseñar: la app es minimalista y self-hosted; menos es más.
