import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { previousPeriod } from '@savetowin/shared/stats'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Plus,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import {
  createBudget,
  deleteBudget,
  listBudgets,
  updateBudget,
} from '../api/budgets'
import { ApiClientError } from '../api/client'
import { listCategories, listTransactions } from '../api/transactions'
import { fetchStats } from '../api/stats'
import { t } from '../i18n/t'
import { categoryBgClass, categoryCssVar, categoryIcon } from '../ui/categoryMeta'
import { computeEnvelopeBar, type EnvelopeStatus } from '../ui/envelopeBar'
import { ProgressRing } from '../ui/ProgressRing'

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${MONTHS_ES[m - 1]} ${y}`
}

function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  if (m === 12) return `${y + 1}-01`
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function periodEnd(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return `${period}-${String(last).padStart(2, '0')}`
}

function StatusPill({ status, usedPercent }: { status: EnvelopeStatus; usedPercent: number }) {
  if (status === 'over') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-danger px-2.5 py-1.5 text-[10.5px] font-bold text-white">
        <CircleAlert size={12} strokeWidth={2.6} aria-hidden />
        {t('budgets.status.over')}
      </span>
    )
  }
  if (status === 'tight') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-warn-weak px-2.5 py-1.5 text-[10.5px] font-bold text-warn">
        <TriangleAlert size={12} strokeWidth={2.6} aria-hidden />
        {t('budgets.status.tight')}
      </span>
    )
  }
  if (status === 'unused') {
    return (
      <span className="rounded-pill bg-surface-2 px-2.5 py-1.5 text-[10.5px] font-bold text-ink-3">
        {t('budgets.status.unused')}
      </span>
    )
  }
  return (
    <span className="rounded-pill bg-surface-2 px-2.5 py-1.5 text-[10.5px] font-bold text-ink-2">
      {usedPercent} %
    </span>
  )
}

/** Directions 12a — sobres por categoría (over/under con icono + texto). */
export function BudgetsPage() {
  const qc = useQueryClient()
  const [period, setPeriod] = useState(currentPeriod)
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftLimit, setDraftLimit] = useState('')
  const [newCategoryId, setNewCategoryId] = useState('')
  const [newLimit, setNewLimit] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const budgets = useQuery({ queryKey: ['budgets'], queryFn: listBudgets })
  const cats = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const txs = useQuery({
    queryKey: ['transactions', 'budget-period', period],
    queryFn: () =>
      listTransactions({
        from: `${period}-01`,
        to: periodEnd(period),
        limit: 500,
      }),
  })
  const stats = useQuery({
    queryKey: ['stats', period],
    queryFn: () => fetchStats(period),
  })

  const expenseCats = useMemo(
    () => (cats.data?.items ?? []).filter((c) => c.type === 'expense'),
    [cats.data],
  )

  const spentByCat = useMemo(() => {
    const map = new Map<number, number>()
    for (const tx of txs.data?.items ?? []) {
      if (tx.type !== 'expense') continue
      if (!tx.date.startsWith(period)) continue
      map.set(tx.categoryId, (map.get(tx.categoryId) ?? 0) + tx.amount)
    }
    return map
  }, [txs.data, period])

  const periodBudgets = useMemo(
    () => (budgets.data?.items ?? []).filter((b) => b.period === period),
    [budgets.data, period],
  )

  const rows = useMemo(() => {
    return periodBudgets
      .map((b) => {
        const cat = expenseCats.find((c) => c.id === b.categoryId)
        if (!cat) return null
        const spent = spentByCat.get(b.categoryId) ?? 0
        const bar = computeEnvelopeBar(spent, b.limit)
        return { budget: b, cat, spent, bar }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => {
        const order = { over: 0, tight: 1, ok: 2, unused: 3 }
        return order[a.bar.status] - order[b.bar.status]
      })
  }, [periodBudgets, expenseCats, spentByCat])

  const totalBudgeted = rows.reduce((s, r) => s + r.budget.limit, 0)
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0)
  const rollsOver = totalBudgeted - totalSpent
  const usedOfEnvelope =
    totalBudgeted > 0
      ? Math.min(100, Math.round((totalSpent * 100) / totalBudgeted))
      : 0

  const usedCats = new Set(periodBudgets.map((b) => b.categoryId))
  const availableCats = expenseCats.filter((c) => !usedCats.has(c.id))

  const createMut = useMutation({
    mutationFn: async () => {
      const limit = parseAmountToCents(newLimit)
      return createBudget({
        categoryId: Number(newCategoryId),
        period,
        limit,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['budgets'] })
      await qc.invalidateQueries({ queryKey: ['stats'] })
      setOpen(false)
      setNewCategoryId('')
      setNewLimit('')
      setFormError(null)
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiClientError
          ? err.body?.error.message ?? t('common.error')
          : t('common.error'),
      )
    },
  })

  const patchMut = useMutation({
    mutationFn: async ({ id, limit }: { id: number; limit: number }) =>
      updateBudget(id, { limit }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['budgets'] })
      await qc.invalidateQueries({ queryKey: ['stats'] })
      setEditingId(null)
      setDraftLimit('')
    },
  })

  const delMut = useMutation({
    mutationFn: deleteBudget,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['budgets'] })
      await qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  function onCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    createMut.mutate()
  }

  function startEdit(id: number, limitCents: number) {
    const whole = Math.floor(limitCents / 100)
    const frac = limitCents % 100
    setEditingId(id)
    setDraftLimit(`${whole},${String(frac).padStart(2, '0')}`)
  }

  function saveEdit(id: number) {
    try {
      const limit = parseAmountToCents(draftLimit)
      patchMut.mutate({ id, limit })
    } catch {
      setFormError(t('budgets.invalidAmount'))
    }
  }

  const loading = budgets.isLoading || cats.isLoading || txs.isLoading

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-extrabold tracking-tight">{t('budgets.title')}</h1>
          <p className="text-[13px] font-medium text-ink-2">
            {periodLabel(period)}
            {rollsOver > 0 && totalBudgeted > 0
              ? ` · ${formatCents(rollsOver)} ${t('budgets.rollsOverHint')}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-0.5 rounded-pill bg-surface-2 p-0.5">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-3.5 py-2.5 text-[12.5px] font-bold shadow-sm">
              <Wallet size={15} strokeWidth={2.2} aria-hidden />
              {t('budgets.envelopes')}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2.5 text-[12.5px] font-semibold text-ink-3"
              title={t('budgets.limitsSoon')}
            >
              {t('budgets.limits')}
            </span>
          </div>
          <div className="flex items-center gap-0.5 rounded-pill border border-line bg-surface p-0.5">
            <button
              type="button"
              aria-label={t('budgets.prevMonth')}
              onClick={() => setPeriod(previousPeriod(period))}
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-pill text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
            >
              <ChevronLeft size={17} strokeWidth={2.2} aria-hidden />
            </button>
            <span className="px-2.5 text-[13px] font-bold">{periodLabel(period)}</span>
            <button
              type="button"
              aria-label={t('budgets.nextMonth')}
              onClick={() => setPeriod(nextPeriod(period))}
              className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-pill bg-surface-2 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
            >
              <ChevronRight size={17} strokeWidth={2.2} aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={availableCats.length === 0}
            className="inline-flex h-tap items-center gap-2 rounded-pill bg-accent px-4 text-[13px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden />
            {t('budgets.add')}
          </button>
        </div>
      </div>

      {/* Resumen — Directions 12a */}
      <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-raised lg:flex-row lg:items-center lg:gap-9">
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink-2">{t('budgets.budgeted')}</span>
          <span className="text-[30px] font-extrabold tabular-nums tracking-tight">
            {formatCents(totalBudgeted)}
          </span>
        </div>
        <div className="hidden h-11 w-px bg-line lg:block" />
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-ink-2">{t('budgets.spent')}</span>
          <span className="text-[30px] font-extrabold tabular-nums tracking-tight">
            {formatCents(totalSpent)}
          </span>
        </div>
        <div className="hidden h-11 w-px bg-line lg:block" />
        <div className="flex flex-col gap-1">
          <span className="text-[12.5px] font-semibold text-savings">{t('budgets.rollsOver')}</span>
          <span
            className={`text-[30px] font-extrabold tabular-nums tracking-tight ${
              rollsOver >= 0 ? 'text-savings' : 'text-danger'
            }`}
          >
            {rollsOver >= 0 ? `+ ${formatCents(rollsOver)}` : formatCents(rollsOver)}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 lg:pl-3">
          <div className="flex h-4 overflow-hidden rounded-pill bg-track">
            {rows.length === 0 ? null : (
              <div
                className="h-full rounded-pill bg-expense"
                style={{ width: `${usedOfEnvelope}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[11.5px] font-medium text-ink-2">
            <span>
              {usedOfEnvelope} % {t('budgets.ofEnvelope')}
            </span>
            <span>{t('budgets.unspent')}</span>
          </div>
        </div>
      </section>

      <div className="grid gap-3.5 lg:grid-cols-[1.75fr_1fr]">
        <section className="rounded-card border border-line bg-surface px-5 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between border-b border-grid pb-3">
            <h2 className="text-[15px] font-bold">{t('budgets.onePerCategory')}</h2>
            <div className="hidden gap-4 text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 sm:flex">
              <span className="w-[150px] text-right">{t('budgets.spentLimit')}</span>
              <span className="w-[90px] text-right">{t('budgets.status')}</span>
            </div>
          </div>

          {loading && <p className="py-8 text-ink-2">{t('common.loading')}</p>}
          {!loading && rows.length === 0 && (
            <p className="py-10 text-center text-[13px] text-ink-3">{t('budgets.empty')}</p>
          )}

          {rows.map(({ budget, cat, spent, bar }) => {
            const Icon = categoryIcon(cat.key)
            const editing = editingId === budget.id
            return (
              <div
                key={budget.id}
                className={`flex flex-col gap-2 border-b border-grid py-3 last:border-0 sm:flex-row sm:items-center sm:gap-3.5 sm:py-0 sm:min-h-[62px] ${
                  bar.status === 'over' ? '' : ''
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={`flex h-[34px] w-[34px] flex-none items-center justify-center rounded-icon text-white ${categoryBgClass(cat.color)}`}
                  >
                    <Icon size={17} strokeWidth={2.2} aria-hidden />
                  </span>
                  <div className="w-[132px] flex-none">
                    <div className="text-[13.5px] font-semibold">{cat.label}</div>
                    <div
                      className={`text-[11px] ${
                        bar.status === 'over' ? 'text-danger' : 'text-ink-3'
                      }`}
                    >
                      {bar.status === 'over'
                        ? `${formatCents(bar.overCents)} ${t('budgets.overAmount')}`
                        : bar.status === 'unused'
                          ? t('budgets.nothingYet')
                          : `${formatCents(bar.remainingCents)} ${t('budgets.left')}`}
                    </div>
                  </div>
                  <div className="hidden h-[9px] flex-1 overflow-hidden rounded-pill bg-track sm:flex">
                    {bar.status === 'over' ? (
                      <>
                        <div
                          className="h-full"
                          style={{
                            width: `${bar.withinBarPercent}%`,
                            background: categoryCssVar(cat.color),
                          }}
                        />
                        <div
                          className="h-full bg-danger"
                          style={{ width: `${bar.overBarPercent}%` }}
                        />
                      </>
                    ) : (
                      <div
                        className="h-full rounded-pill"
                        style={{
                          width: `${bar.withinBarPercent}%`,
                          background: categoryCssVar(cat.color),
                        }}
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] tabular-nums text-ink-2">
                        {formatCents(spent)} /
                      </span>
                      <input
                        value={draftLimit}
                        onChange={(e) => setDraftLimit(e.target.value)}
                        className="h-[42px] w-24 rounded-[12px] border-2 border-accent bg-surface px-3 text-[14px] font-bold tabular-nums focus-visible:shadow-focus focus-visible:outline-none"
                        aria-label={t('budgets.limit')}
                      />
                      <button
                        type="button"
                        onClick={() => saveEdit(budget.id)}
                        className="inline-flex h-9 items-center rounded-pill bg-accent px-3 text-xs font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        {t('budgets.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs font-semibold text-ink-2"
                      >
                        {t('budgets.cancel')}
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(budget.id, budget.limit)}
                        className={`w-[150px] text-right text-[13px] font-semibold tabular-nums focus-visible:shadow-focus focus-visible:outline-none ${
                          bar.status === 'over' ? 'font-bold text-danger' : ''
                        }`}
                      >
                        {formatCents(spent)} / {formatCents(budget.limit)}
                      </button>
                      <span className="flex w-[90px] justify-end">
                        <StatusPill status={bar.status} usedPercent={bar.usedPercent} />
                      </span>
                      <button
                        type="button"
                        onClick={() => delMut.mutate(budget.id)}
                        className="text-[11px] font-semibold text-ink-3 hover:text-danger focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        {t('budgets.delete')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </section>

        {/* Objetivo solo lectura — edición en P6.2 */}
        <aside className="rounded-card border border-line bg-surface p-5 shadow-raised">
          <div className="mb-4 text-[15px] font-bold">{t('dashboard.goal.title')}</div>
          {stats.data ? (
            <div className="flex items-center gap-5">
              <div className="relative h-[116px] w-[116px] flex-none">
                <ProgressRing
                  percent={stats.data.goalProgressPercent}
                  size={116}
                  strokeWidth={5}
                  tone="savings"
                  aria-label={`${stats.data.goalProgressPercent} %`}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <span className="text-[23px] font-extrabold tabular-nums tracking-tight">
                    {stats.data.goalProgressPercent} %
                  </span>
                  <span className="text-[10px] font-medium text-ink-2">
                    {t('dashboard.goal.ofGoal')}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-2xl font-extrabold tabular-nums tracking-tight">
                  {formatCents(stats.data.savedCents)}
                </span>
                <span className="text-[12.5px] font-medium leading-snug text-ink-2">
                  {t('dashboard.goal.of')} {formatCents(stats.data.savingsGoalCents)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-ink-2">{t('common.loading')}</p>
          )}
        </aside>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <form
            onSubmit={onCreate}
            className="w-full max-w-md rounded-sheet bg-surface p-5 shadow-raised"
          >
            <h2 className="text-lg font-extrabold">{t('budgets.add')}</h2>
            <p className="mt-1 text-sm text-ink-2">{periodLabel(period)}</p>
            {formError && <p className="mt-3 text-sm text-danger">{formError}</p>}
            <label className="mt-4 block text-sm font-semibold">
              {t('transactions.category')}
              <select
                required
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                className="mt-1 h-field w-full rounded-field border border-line bg-surface px-3 focus-visible:shadow-focus focus-visible:outline-none"
              >
                <option value="">{t('budgets.pickCategory')}</option>
                {availableCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm font-semibold">
              {t('budgets.limit')}
              <input
                required
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                placeholder="200,00"
                className="mt-1 h-field w-full rounded-field border border-line bg-surface px-3 tabular-nums focus-visible:shadow-focus focus-visible:outline-none"
              />
            </label>
            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={createMut.isPending}
                className="inline-flex h-tap flex-1 items-center justify-center rounded-pill bg-accent font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
              >
                {t('budgets.save')}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
              >
                {t('budgets.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
