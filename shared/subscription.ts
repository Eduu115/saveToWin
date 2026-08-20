import type { SubscriptionCustomUnit, SubscriptionRecurrence } from './types.js'

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`
}

function parseIso(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

/** Último día del mes (1–12). */
function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseIso(iso)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const nd = Math.min(d, daysInMonth(ny, nm))
  return toIso(ny, nm, nd)
}

function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIso(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** Avanza una fecha ISO según la recurrencia de la suscripción. */
export function advanceSubscriptionDate(
  iso: string,
  recurrence: SubscriptionRecurrence,
  customEvery?: number | null,
  customUnit?: SubscriptionCustomUnit | null,
): string {
  switch (recurrence) {
    case 'weekly':
      return addDays(iso, 7)
    case 'monthly':
      return addMonths(iso, 1)
    case 'quarterly':
      return addMonths(iso, 3)
    case 'yearly':
      return addMonths(iso, 12)
    case 'custom': {
      const every = customEvery && customEvery > 0 ? customEvery : 1
      const unit = customUnit ?? 'months'
      if (unit === 'weeks') return addDays(iso, 7 * every)
      if (unit === 'years') return addMonths(iso, 12 * every)
      return addMonths(iso, every)
    }
  }
}
