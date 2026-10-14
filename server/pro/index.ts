import type { Hono } from 'hono'
import type { AuthVariables } from '../src/lib/auth.js'
import { ensureProSchema, FREE_HISTORY_DAYS, freeHistoryFrom, planFor } from './plans.js'
import { proRoutes } from './routes.js'

/**
 * La ventana de 60 días del plan gratis solo se aplica con `PRO_ENFORCE_PLANS=true`:
 * hasta que exista el cobro, desplegar pro no recorta el historial a nadie.
 * Las funciones nuevas (análisis, agrupaciones, consejos, Wrapped completo) exigen
 * premium siempre: no quitan nada a nadie, solo se añaden.
 */
const enforcePlans = () => process.env.PRO_ENFORCE_PLANS === 'true'

/** Punto de entrada que carga el núcleo (`server/src/index.ts`) si existe `server/pro/`. */
export async function register(app: Hono) {
  await ensureProSchema()
  const api = app as unknown as Hono<{ Variables: AuthVariables }>

  // Tras requireAuth: el plan gratis solo ve FREE_HISTORY_DAYS días de gráficos/estadísticas.
  // ponytail: una consulta por petición autenticada (PK); cachear si pesa.
  api.use('/api/*', async (c, next) => {
    const userId = c.get('userId')
    if (userId != null && enforcePlans()) {
      const { plan } = await planFor(userId)
      if (plan === 'free') c.set('historyFrom', freeHistoryFrom())
    }
    await next()
  })

  api.get('/api/pro/me', async (c) => {
    const { plan, validUntil } = await planFor(c.get('userId'))
    const limited = enforcePlans() && plan === 'free'
    return c.json({
      plan,
      validUntil,
      historyFrom: limited ? freeHistoryFrom() : null,
      freeHistoryDays: FREE_HISTORY_DAYS,
      enforced: enforcePlans(),
    })
  })

  api.route('/api/pro', proRoutes)
}
