import { describe, expect, it } from 'vitest'
import { computeInsights, type ProTx } from '../../server/pro/insights'
import { computeWrapped, computeWrappedCover } from '../../server/pro/wrapped'

const tx = (
  date: string,
  amount: number,
  categoryKey: string,
  type: ProTx['type'] = 'expense',
  note: string | null = null,
  subscriptionId: number | null = null,
): ProTx => ({ date, amount, type, categoryKey, categoryLabel: categoryKey, note, subscriptionId })

/** Jul–sep normales; octubre con Ocio disparado, un pico y Netflix repetido. */
function dataset(): ProTx[] {
  const rows: ProTx[] = []
  for (const m of ['07', '08', '09', '10']) {
    rows.push(tx(`2026-${m}-01`, 200_000, 'Other', 'income'))
    rows.push(tx(`2026-${m}-03`, 1_299, 'Subscriptions', 'expense', 'Netflix'))
    rows.push(tx(`2026-${m}-05`, 4_000, 'Groceries'))
    rows.push(tx(`2026-${m}-06`, 4_200, 'Groceries'))
    rows.push(tx(`2026-${m}-07`, 3_900, 'Groceries'))
    // Restaurantes en sábado (2026-07-11, 08-08, 09-12, 10-10)
  }
  rows.push(tx('2026-07-11', 6_000, 'Dining out'), tx('2026-08-08', 6_000, 'Dining out'))
  rows.push(tx('2026-09-12', 6_000, 'Dining out'), tx('2026-10-10', 6_000, 'Dining out'))
  for (const m of ['07', '08', '09']) rows.push(tx(`2026-${m}-15`, 3_000, 'Leisure'))
  rows.push(tx('2026-10-15', 9_000, 'Leisure'))
  rows.push(tx('2026-10-20', 25_000, 'Groceries', 'expense', 'Compra enorme'))
  return rows
}

describe('computeInsights', () => {
  const insights = computeInsights({ txs: dataset(), period: '2026-10', today: '2026-10-31' })
  const codes = insights.map((i) => i.code)

  it('detecta subida de categoría frente a la media', () => {
    const up = insights.find((i) => i.code === 'trend_up' && i.params.categoryKey === 'Leisure')
    expect(up?.params.percent).toBe(200)
    expect(up?.params.diffCents).toBe(6_000)
  })

  it('detecta un gasto fuera de lo normal', () => {
    const spike = insights.find((i) => i.code === 'spike')
    expect(spike?.params.amountCents).toBe(25_000)
    expect(spike?.params.usualCents).toBe(4_000)
  })

  it('sugiere convertir en suscripción un cargo repetido', () => {
    const rec = insights.find((i) => i.code === 'recurring')
    expect(rec?.params.note).toBe('Netflix')
    expect(rec?.params.months).toBe(4)
  })

  it('propone un recorte realista en la categoría de capricho con más gasto', () => {
    const cut = insights.find((i) => i.code === 'cut_tip')
    expect(cut?.params.categoryKey).toBe('Dining out')
    expect(cut?.params.yearlyCents).toBe(Math.round(6_000 * 0.15 * 12))
  })

  it('avisa del gasto de fin de semana y ordena avisos antes que info', () => {
    expect(codes).toContain('weekend')
    expect(insights[0].tone).toBe('warning')
    expect(insights[insights.length - 1].tone).toBe('info')
  })

  it('compara la tasa de ahorro con la media', () => {
    const rate = insights.find((i) => i.code === 'savings_rate')
    expect(rate?.tone).toBe('warning')
  })

  it('no celebra «100 % menos» ni propone recortes por un gasto puntual', () => {
    const trip = [...dataset(), tx('2026-08-20', 60_000, 'Travel', 'expense', 'Vuelos')]
    const out = computeInsights({ txs: trip, period: '2026-10', today: '2026-10-31' })
    expect(out.some((i) => i.code === 'trend_down' && i.params.categoryKey === 'Travel')).toBe(false)
    expect(out.find((i) => i.code === 'cut_tip')?.params.categoryKey).toBe('Dining out')
  })

  it('no inventa nada sin historial', () => {
    expect(computeInsights({ txs: [], period: '2026-10', today: '2026-10-14' })).toEqual([])
  })
})

describe('computeWrapped', () => {
  const w = computeWrapped(dataset(), 2026, '2026-12-31')

  it('cuadra la portada con los totales del año', () => {
    const cover = computeWrappedCover(dataset(), 2026)
    expect(cover.incomeCents).toBe(800_000)
    expect(cover.keptCents).toBe(800_000 - cover.expenseCents)
    expect(w.movements).toBe(cover.movements)
  })

  it('saca top de categorías, mayor gasto y sitio favorito', () => {
    expect(w.topCategories[0].key).toBe('Groceries')
    expect(w.biggestExpense?.cents).toBe(25_000)
    expect(w.favoritePlace?.note).toBe('Netflix')
    expect(w.favoritePlace?.visits).toBe(4)
    expect(w.persona).toBe('saver')
  })
})
