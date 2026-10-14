/** Copy de pro (fuera del diccionario del núcleo para no filtrarlo al repo público). */
const es = {
  'pro.nav': 'Premium',
  'pro.title': 'saveToWin Premium',
  'pro.subtitle': 'Tus datos se guardan siempre; premium desbloquea todo lo que se ve de ellos.',
  'pro.plan.free': 'Plan gratis',
  'pro.plan.premium': 'Premium',
  'pro.plan.until': 'hasta el',
  'pro.plan.forever': 'sin fecha de fin',
  'pro.history.limited': 'Ves gráficos y estadísticas desde el',
  'pro.history.full': 'Ves todo tu historial, sin límite de fechas.',
  'pro.history.notEnforced': 'Los límites del plan gratis aún no están activos: ahora mismo ves todo.',
  'pro.includes': 'Qué incluye Premium',
  'pro.f.history': 'Historial completo: gráficos y estadísticas de más de {n} días',
  'pro.f.groups': 'Agrupaciones: cuánto va a Ocio, Transporte… como conjuntos tuyos',
  'pro.f.charts': 'Gráficos avanzados y límites visualizados',
  'pro.f.insights': 'Analítica con sugerencias y consejos, calculados en tu servidor',
  'pro.f.wrapped': 'Tu Wrapped: el resumen de tu año en finanzas',
  'pro.cta.soon': 'El pago llega pronto',
} as const

export type ProKey = keyof typeof es

export function tp(key: ProKey, vars?: Record<string, string | number>): string {
  let text: string = es[key]
  for (const [k, v] of Object.entries(vars ?? {})) text = text.replace(`{${k}}`, String(v))
  return text
}
