import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'

/** Días de historial visibles (gráficos/estadísticas) en el plan gratis. */
export const FREE_HISTORY_DAYS = 60

export type Plan = 'free' | 'premium'

/**
 * Tabla propia de pro. ponytail: DDL idempotente al arrancar en vez de una
 * secuencia de migraciones propia; pasar a carpeta + tabla de control cuando
 * pro tenga más de un par de tablas.
 */
export async function ensureProSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS pro_plans (
      user_id integer PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
      valid_until date,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Plan vigente: premium solo si `valid_until` es nulo (indefinido) o no ha pasado. */
export async function planFor(userId: number): Promise<{ plan: Plan; validUntil: string | null }> {
  const rows = await db.execute<{ plan: Plan; valid_until: string | null }>(
    sql`SELECT plan, valid_until::text FROM pro_plans WHERE user_id = ${userId}`,
  )
  const row = rows[0]
  if (!row || row.plan !== 'premium') return { plan: 'free', validUntil: null }
  if (row.valid_until != null && row.valid_until < isoDate(new Date())) {
    return { plan: 'free', validUntil: row.valid_until }
  }
  return { plan: 'premium', validUntil: row.valid_until }
}

/** Primer día visible para el plan gratis. */
export function freeHistoryFrom(today = new Date()): string {
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() - FREE_HISTORY_DAYS)
  return isoDate(d)
}

export async function setPlan(userId: number, plan: Plan, validUntil: string | null) {
  await db.execute(sql`
    INSERT INTO pro_plans (user_id, plan, valid_until, updated_at)
    VALUES (${userId}, ${plan}, ${validUntil}, now())
    ON CONFLICT (user_id) DO UPDATE
      SET plan = EXCLUDED.plan, valid_until = EXCLUDED.valid_until, updated_at = now()
  `)
}
