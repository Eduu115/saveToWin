import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Flag, PiggyBank } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { updateMe } from '../api/auth'
import { ApiClientError } from '../api/client'
import type { DashboardStats } from '../api/stats'
import { createTransaction, listAccounts, listCategories } from '../api/transactions'
import { t } from '../i18n/t'
import { ProgressRing } from './ProgressRing'

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

function estimateLandingLabel(
  savedCents: number,
  goalCents: number,
  monthlyPaceCents: number,
): string | null {
  if (goalCents <= 0 || savedCents >= goalCents || monthlyPaceCents <= 0) return null
  const months = Math.ceil((goalCents - savedCents) / monthlyPaceCents)
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return `${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
}

/** Directions 12a — objetivo de ahorro con edición y mover sobrante. */
export function SavingsGoalCard({
  stats,
  rollOverCents,
}: {
  stats: DashboardStats
  /** Sobrante de sobres del periodo (si >0, habilita mover a ahorro). */
  rollOverCents: number
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const accounts = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const categories = useQuery({ queryKey: ['categories'], queryFn: listCategories })

  const remaining = Math.max(0, stats.savingsGoalCents - stats.savedCents)
  const monthlyPace =
    stats.balanceCents > 0
      ? stats.balanceCents
      : stats.incomeCents > 0 && stats.savingsRateTenths > 0
        ? Math.trunc((stats.incomeCents * stats.savingsRateTenths) / 1000)
        : 0
  const landing = estimateLandingLabel(
    stats.savedCents,
    stats.savingsGoalCents,
    monthlyPace,
  )

  const saveGoal = useMutation({
    mutationFn: async (savingsGoalCents: number) =>
      updateMe({ savingsGoalCents }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['stats'] })
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      setEditing(false)
      setError(null)
    },
    onError: (err) => {
      setError(
        err instanceof ApiClientError
          ? err.body?.error.message ?? t('common.error')
          : t('common.error'),
      )
    },
  })

  const moveMut = useMutation({
    mutationFn: async () => {
      const savings = accounts.data?.items.find((a) => a.key === 'Savings')
      const other = categories.data?.items.find((c) => c.key === 'Other')
      if (!savings || !other) throw new Error('missing seed')
      if (rollOverCents <= 0) throw new Error('nothing to move')
      return createTransaction({
        date: new Date().toISOString().slice(0, 10),
        amount: rollOverCents,
        type: 'income',
        categoryId: other.id,
        accountId: savings.id,
        note: t('budgets.moveNote'),
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['stats'] })
      await qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  function startEdit() {
    const g = stats.savingsGoalCents
    const whole = Math.floor(g / 100)
    const frac = g % 100
    setDraft(`${whole},${String(frac).padStart(2, '0')}`)
    setEditing(true)
    setError(null)
  }

  function onSave(e: FormEvent) {
    e.preventDefault()
    try {
      saveGoal.mutate(parseAmountToCents(draft))
    } catch {
      setError(t('budgets.invalidAmount'))
    }
  }

  return (
    <aside className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-raised">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">{t('dashboard.goal.title')}</h2>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="text-xs font-semibold text-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            {t('budgets.goal.edit')}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={onSave} className="flex flex-col gap-3">
          {error && <p className="text-sm text-danger">{error}</p>}
          <label className="text-sm font-semibold text-ink-2">
            {t('budgets.goal.target')}
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="mt-1 h-field w-full rounded-field border-2 border-accent bg-surface px-3 text-[17px] font-bold tabular-nums focus-visible:shadow-focus focus-visible:outline-none"
              aria-label={t('budgets.goal.target')}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saveGoal.isPending}
              className="inline-flex h-tap flex-1 items-center justify-center rounded-pill bg-accent text-sm font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
            >
              {t('budgets.save')}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-sm font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
            >
              {t('budgets.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-5">
            <div className="relative h-[116px] w-[116px] flex-none">
              <ProgressRing
                percent={stats.goalProgressPercent}
                size={116}
                strokeWidth={5}
                tone="savings"
                aria-label={`${stats.goalProgressPercent} % ${t('dashboard.goal.ofGoal')}`}
              />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                <span className="text-[23px] font-extrabold tabular-nums tracking-tight">
                  {stats.goalProgressPercent} %
                </span>
                <span className="text-[10px] font-medium text-ink-2">
                  {t('dashboard.goal.ofGoal')}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-2xl font-extrabold tabular-nums tracking-tight">
                {formatCents(stats.savedCents)}
              </span>
              <span className="text-[12.5px] font-medium leading-snug text-ink-2">
                {t('dashboard.goal.of')} {formatCents(stats.savingsGoalCents)}
                <br />
                {formatCents(remaining)} {t('dashboard.goal.toGo')}
              </span>
              {landing && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-savings">
                  <Flag size={13} strokeWidth={2.4} aria-hidden />
                  {t('budgets.goal.landing')} {landing}
                </span>
              )}
            </div>
          </div>

          {rollOverCents > 0 && (
            <button
              type="button"
              disabled={moveMut.isPending || !accounts.data || !categories.data}
              onClick={() => moveMut.mutate()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-tile bg-savings text-[13.5px] font-bold text-white focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
            >
              <PiggyBank size={17} strokeWidth={2.2} aria-hidden />
              {t('budgets.goal.move')} {formatCents(rollOverCents)}
            </button>
          )}
        </>
      )}
    </aside>
  )
}
