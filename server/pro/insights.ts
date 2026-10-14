import { daysInPeriod, previousPeriod } from '@savetowin/shared/stats'

/**
 * Analítica avanzada (premium): heurísticas deterministas calculadas en el servidor.
 * Nada sale de la máquina. Puro: sin base de datos, para poder testearlo.
 */

export type ProTx = {
  date: string
  amount: number
  type: 'expense' | 'income' | 'savings'
  categoryKey: string
  categoryLabel: string
  note: string | null
  subscriptionId: number | null
}

export type InsightTone = 'warning' | 'tip' | 'positive' | 'info'

export type ProInsight = {
  code:
    | 'trend_up'
    | 'trend_down'
    | 'spike'
    | 'recurring'
    | 'cut_tip'
    | 'weekend'
    | 'projection'
    | 'savings_rate'
  tone: InsightTone
  params: Record<string, string | number>
}

/** Categorías «de capricho»: donde un recorte es realista. */
const DISCRETIONARY = new Set(['Dining out', 'Leisure', 'Clothing', 'Digital & games', 'Travel'])
const TONE_ORDER: Record<InsightTone, number> = { warning: 0, tip: 1, positive: 2, info: 3 }

const inPeriod = (tx: ProTx, p: string) => tx.date.startsWith(p)

function lastPeriods(end: string, n: number): string[] {
  const out: string[] = []
  let p = end
  for (let i = 0; i < n; i++) {
    p = previousPeriod(p)
    out.push(p)
  }
  return out
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

function sumBy(txs: ProTx[], pick: (tx: ProTx) => boolean): number {
  let total = 0
  for (const tx of txs) if (pick(tx)) total += tx.amount
  return total
}

function normalizeNote(note: string | null): string {
  return (note ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function computeInsights(input: {
  txs: ProTx[]
  period: string
  /** `YYYY-MM-DD`: hoy. Si cae en `period`, se proyecta el mes. */
  today: string
}): ProInsight[] {
  const { txs, period, today } = input
  const out: ProInsight[] = []
  const days = daysInPeriod(period)
  const isCurrent = today.startsWith(period)
  const elapsed = isCurrent ? Math.max(1, Number(today.slice(8, 10))) : days
  const project = (cents: number) => (isCurrent ? Math.round((cents * days) / elapsed) : cents)
  const prev3 = lastPeriods(period, 3)
  const prev6 = lastPeriods(period, 6)
  // Meses previos con algún movimiento (un mes vacío no cuenta como «gasté 0»).
  const activePrev3 = prev3.filter((p) => txs.some((tx) => inPeriod(tx, p)))

  const expensesIn = (p: string) => txs.filter((tx) => tx.type === 'expense' && inPeriod(tx, p))
  const current = expensesIn(period)
  const labels = new Map(txs.map((tx) => [tx.categoryKey, tx.categoryLabel]))
  const catKeys = [...new Set(txs.filter((tx) => tx.type === 'expense').map((tx) => tx.categoryKey))]

  // 1) Tendencia por categoría frente a la media de los 3 meses anteriores.
  if (activePrev3.length > 0 && (!isCurrent || elapsed >= 7)) {
    const rows = catKeys.map((key) => {
      const now = project(sumBy(current, (tx) => tx.categoryKey === key))
      const avg = Math.round(
        activePrev3.reduce((s, p) => s + sumBy(expensesIn(p), (tx) => tx.categoryKey === key), 0) /
          activePrev3.length,
      )
      return { key, now, avg, diff: now - avg }
    })
    rows
      .filter((r) => r.avg > 0 && r.now >= r.avg * 1.25 && r.diff >= 2000)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 2)
      .forEach((r) =>
        out.push({
          code: 'trend_up',
          tone: 'warning',
          params: {
            categoryKey: r.key,
            categoryLabel: labels.get(r.key) ?? r.key,
            percent: Math.round(((r.now - r.avg) * 100) / r.avg),
            diffCents: r.diff,
            projected: isCurrent ? 1 : 0,
          },
        }),
      )
    rows
      // Con gasto este mes: «100 % menos» porque no hubo viaje no es un logro, es calendario.
      .filter((r) => r.avg > 0 && r.now > 0 && r.now <= r.avg * 0.75 && -r.diff >= 2000)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 1)
      .forEach((r) =>
        out.push({
          code: 'trend_down',
          tone: 'positive',
          params: {
            categoryKey: r.key,
            categoryLabel: labels.get(r.key) ?? r.key,
            percent: Math.round(((r.avg - r.now) * 100) / r.avg),
            diffCents: -r.diff,
          },
        }),
      )
  }

  // 2) Gasto fuera de lo normal: ≥3× la mediana de su categoría en 6 meses (≥3 muestras).
  const spikes = current
    .map((tx) => {
      const history = txs
        .filter((h) => h.type === 'expense' && h.categoryKey === tx.categoryKey && prev6.some((p) => inPeriod(h, p)))
        .map((h) => h.amount)
      return { tx, base: history.length >= 3 ? median(history) : 0 }
    })
    .filter(({ tx, base }) => base > 0 && tx.amount >= base * 3 && tx.amount >= 5000)
    .sort((a, b) => b.tx.amount - a.tx.amount)
  for (const { tx, base } of spikes.slice(0, 2)) {
    out.push({
      code: 'spike',
      tone: 'warning',
      params: {
        categoryKey: tx.categoryKey,
        categoryLabel: tx.categoryLabel,
        note: tx.note ?? '',
        amountCents: tx.amount,
        usualCents: base,
        date: tx.date,
      },
    })
  }

  // 3) Cargos recurrentes sin suscripción: misma nota e importe (±5 %) en ≥3 meses.
  const window6 = [period, ...prev6.slice(0, 5)]
  const byNote = new Map<string, ProTx[]>()
  for (const tx of txs) {
    if (tx.type !== 'expense' || tx.subscriptionId != null) continue
    if (!window6.some((p) => inPeriod(tx, p))) continue
    const key = normalizeNote(tx.note)
    if (!key) continue
    byNote.set(key, [...(byNote.get(key) ?? []), tx])
  }
  const recurring = [...byNote.values()]
    .map((list) => {
      const amounts = list.map((tx) => tx.amount)
      const med = median(amounts)
      const steady = amounts.every((a) => Math.abs(a - med) <= med * 0.05)
      const months = new Set(list.map((tx) => tx.date.slice(0, 7))).size
      return { list, med, steady, months }
    })
    .filter((r) => r.steady && r.months >= 3)
    .sort((a, b) => b.med - a.med)
  for (const r of recurring.slice(0, 3)) {
    out.push({
      code: 'recurring',
      tone: 'tip',
      params: {
        note: r.list[0].note ?? '',
        amountCents: r.med,
        months: r.months,
        categoryLabel: r.list[0].categoryLabel,
      },
    })
  }

  // 4) Recorte realista: la categoría de capricho con más gasto medio (3 meses),
  //    solo si es un hábito (gasto en ≥2 de esos meses), no un gasto puntual.
  if (activePrev3.length >= 2) {
    const best = catKeys
      .filter((k) => DISCRETIONARY.has(k))
      .filter((k) => activePrev3.filter((p) => sumBy(expensesIn(p), (tx) => tx.categoryKey === k) > 0).length >= 2)
      .map((key) => ({
        key,
        avg: Math.round(
          activePrev3.reduce((s, p) => s + sumBy(expensesIn(p), (tx) => tx.categoryKey === key), 0) /
            activePrev3.length,
        ),
      }))
      .sort((a, b) => b.avg - a.avg)[0]
    if (best && best.avg >= 3000) {
      out.push({
        code: 'cut_tip',
        tone: 'tip',
        params: {
          categoryKey: best.key,
          categoryLabel: labels.get(best.key) ?? best.key,
          avgCents: best.avg,
          yearlyCents: Math.round(best.avg * 0.15 * 12),
        },
      })
    }
  }

  // 5) Fin de semana: ≥50 % del gasto de capricho de 3 meses cae en sábado/domingo.
  const recent = txs.filter(
    (tx) =>
      tx.type === 'expense' &&
      DISCRETIONARY.has(tx.categoryKey) &&
      [period, ...prev3].some((p) => inPeriod(tx, p)),
  )
  const total = sumBy(recent, () => true)
  const weekend = sumBy(recent, (tx) => {
    const d = new Date(`${tx.date}T12:00:00Z`).getUTCDay()
    return d === 0 || d === 6
  })
  if (total >= 10000 && weekend * 2 >= total) {
    out.push({
      code: 'weekend',
      tone: 'info',
      params: { percent: Math.round((weekend * 100) / total), totalCents: total },
    })
  }

  // 6) Proyección del mes en curso frente al mes anterior.
  if (isCurrent && elapsed >= 5) {
    const projected = project(sumBy(current, () => true))
    const previous = sumBy(expensesIn(prev3[0]), () => true)
    if (previous > 0) {
      const diff = Math.round(((projected - previous) * 100) / previous)
      out.push({
        code: 'projection',
        tone: diff > 10 ? 'warning' : diff < -10 ? 'positive' : 'info',
        params: { projectedCents: projected, previousCents: previous, diffPercent: diff },
      })
    }
  }

  // 7) Tasa de ahorro frente a la media de los 3 meses anteriores con ingresos.
  const rate = (p: string) => {
    const income = sumBy(txs, (tx) => tx.type === 'income' && inPeriod(tx, p))
    const expense = sumBy(txs, (tx) => tx.type === 'expense' && inPeriod(tx, p))
    return income > 0 ? Math.round(((income - expense) * 100) / income) : null
  }
  const nowRate = rate(period)
  const prevRates = prev3.map(rate).filter((r): r is number => r != null)
  if (nowRate != null && prevRates.length > 0) {
    const avg = Math.round(prevRates.reduce((s, r) => s + r, 0) / prevRates.length)
    if (Math.abs(nowRate - avg) >= 5) {
      out.push({
        code: 'savings_rate',
        tone: nowRate > avg ? 'positive' : 'warning',
        params: { ratePercent: nowRate, avgPercent: avg },
      })
    }
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
}
