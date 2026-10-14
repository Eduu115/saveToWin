import type { ProTx } from './insights.js'

/** Resumen anual tipo «Wrapped». Puro: recibe los movimientos del año. */

export type WrappedCover = {
  year: number
  incomeCents: number
  expenseCents: number
  keptCents: number
  savingsRatePercent: number | null
  movements: number
}

export type Wrapped = WrappedCover & {
  topCategories: { key: string; label: string; cents: number; percent: number }[]
  biggestMonth: { period: string; cents: number } | null
  bestSavingsMonth: { period: string; cents: number } | null
  biggestExpense: { note: string; categoryLabel: string; cents: number; date: string } | null
  favoritePlace: { note: string; visits: number; cents: number } | null
  favoriteWeekday: { weekday: number; cents: number } | null
  longestNoSpendStreak: number
  savedToAccountCents: number
  /** Arquetipo heurístico del año (clave de copy en la web). */
  persona: 'saver' | 'foodie' | 'traveler' | 'shopper' | 'gamer' | 'homebody' | 'balanced'
}

const PERSONA_BY_CATEGORY: Record<string, Wrapped['persona']> = {
  'Dining out': 'foodie',
  Travel: 'traveler',
  Clothing: 'shopper',
  'Digital & games': 'gamer',
  'Home & bills': 'homebody',
  Bills: 'homebody',
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function computeWrappedCover(txs: ProTx[], year: number): WrappedCover {
  const y = String(year)
  const ofYear = txs.filter((tx) => tx.date.startsWith(y))
  const income = ofYear.filter((tx) => tx.type === 'income').reduce((s, tx) => s + tx.amount, 0)
  const expense = ofYear.filter((tx) => tx.type === 'expense').reduce((s, tx) => s + tx.amount, 0)
  return {
    year,
    incomeCents: income,
    expenseCents: expense,
    keptCents: income - expense,
    savingsRatePercent: income > 0 ? Math.round(((income - expense) * 100) / income) : null,
    movements: ofYear.length,
  }
}

export function computeWrapped(txs: ProTx[], year: number, today: string): Wrapped {
  const y = String(year)
  const ofYear = txs.filter((tx) => tx.date.startsWith(y))
  const expenses = ofYear.filter((tx) => tx.type === 'expense')
  const cover = computeWrappedCover(txs, year)

  const byCat = new Map<string, { label: string; cents: number }>()
  for (const tx of expenses) {
    const row = byCat.get(tx.categoryKey) ?? { label: tx.categoryLabel, cents: 0 }
    row.cents += tx.amount
    byCat.set(tx.categoryKey, row)
  }
  const topCategories = [...byCat.entries()]
    .sort((a, b) => b[1].cents - a[1].cents)
    .slice(0, 3)
    .map(([key, r]) => ({
      key,
      label: r.label,
      cents: r.cents,
      percent: cover.expenseCents > 0 ? Math.round((r.cents * 100) / cover.expenseCents) : 0,
    }))

  const monthly = new Map<string, { income: number; expense: number }>()
  for (const tx of ofYear) {
    const p = tx.date.slice(0, 7)
    const m = monthly.get(p) ?? { income: 0, expense: 0 }
    if (tx.type === 'income') m.income += tx.amount
    if (tx.type === 'expense') m.expense += tx.amount
    monthly.set(p, m)
  }
  const months = [...monthly.entries()]
  const biggest = [...months].sort((a, b) => b[1].expense - a[1].expense)[0]
  const best = [...months]
    .filter(([, m]) => m.income > 0)
    .sort((a, b) => b[1].income - b[1].expense - (a[1].income - a[1].expense))[0]

  const top = [...expenses].sort((a, b) => b.amount - a.amount)[0]

  const places = new Map<string, { note: string; visits: number; cents: number }>()
  for (const tx of expenses) {
    const key = (tx.note ?? '').toLowerCase().trim()
    if (!key) continue
    const p = places.get(key) ?? { note: tx.note ?? '', visits: 0, cents: 0 }
    p.visits += 1
    p.cents += tx.amount
    places.set(key, p)
  }
  const favoritePlace = [...places.values()].sort((a, b) => b.visits - a.visits || b.cents - a.cents)[0]

  const weekdays = Array.from({ length: 7 }, () => 0)
  for (const tx of expenses) weekdays[new Date(`${tx.date}T12:00:00Z`).getUTCDay()] += tx.amount
  const maxDay = weekdays.reduce((best, c, i) => (c > weekdays[best] ? i : best), 0)

  // Racha más larga de días sin gastos, entre el primer movimiento del año y hoy/fin de año.
  let longest = 0
  if (ofYear.length > 0) {
    const spendDays = new Set(expenses.map((tx) => tx.date))
    const first = [...ofYear].sort((a, b) => a.date.localeCompare(b.date))[0].date
    const last = today.startsWith(y) ? today : `${y}-12-31`
    let run = 0
    for (let d = first; d <= last; d = addDays(d, 1)) {
      run = spendDays.has(d) ? 0 : run + 1
      longest = Math.max(longest, run)
    }
  }

  const savedToAccount = ofYear
    .filter((tx) => tx.type === 'savings')
    .reduce((s, tx) => s + (tx.categoryKey === 'Savings withdrawal' ? -tx.amount : tx.amount), 0)

  const persona: Wrapped['persona'] =
    cover.savingsRatePercent != null && cover.savingsRatePercent >= 30
      ? 'saver'
      : topCategories[0] && (topCategories[0].percent >= 25)
        ? (PERSONA_BY_CATEGORY[topCategories[0].key] ?? 'balanced')
        : 'balanced'

  return {
    ...cover,
    topCategories,
    biggestMonth: biggest && biggest[1].expense > 0 ? { period: biggest[0], cents: biggest[1].expense } : null,
    bestSavingsMonth:
      best && best[1].income - best[1].expense > 0
        ? { period: best[0], cents: best[1].income - best[1].expense }
        : null,
    biggestExpense: top
      ? { note: top.note ?? '', categoryLabel: top.categoryLabel, cents: top.amount, date: top.date }
      : null,
    favoritePlace: favoritePlace && favoritePlace.visits >= 2 ? favoritePlace : null,
    favoriteWeekday: weekdays[maxDay] > 0 ? { weekday: maxDay, cents: weekdays[maxDay] } : null,
    longestNoSpendStreak: longest,
    savedToAccountCents: savedToAccount,
    persona,
  }
}
