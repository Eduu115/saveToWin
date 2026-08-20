import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { listAccounts, listCards } from '../api/accounts'
import { ApiClientError } from '../api/client'
import {
  cancelSubscription,
  listSubscriptions,
  updateSubscription,
} from '../api/subscriptions'
import type {
  Subscription,
  SubscriptionCustomUnit,
  SubscriptionRecurrence,
} from '../domain'
import { t } from '../i18n/t'

const field =
  'h-field w-full rounded-field border border-line bg-surface px-3 text-ink focus-visible:shadow-focus focus-visible:outline-none'

type Draft = {
  amount: string
  accountId: string
  cardId: string
  recurrence: SubscriptionRecurrence
  customEvery: string
  customUnit: SubscriptionCustomUnit
  nextDate: string
  note: string
}

function emptyDraft(): Draft {
  return {
    amount: '',
    accountId: '',
    cardId: '',
    recurrence: 'monthly',
    customEvery: '1',
    customUnit: 'months',
    nextDate: new Date().toISOString().slice(0, 10),
    note: '',
  }
}

function fromSub(sub: Subscription): Draft {
  const abs = Math.abs(sub.amount)
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  return {
    amount: `${whole},${String(frac).padStart(2, '0')}`,
    accountId: String(sub.accountId),
    cardId: sub.cardId != null ? String(sub.cardId) : '',
    recurrence: sub.recurrence,
    customEvery: String(sub.customEvery ?? 1),
    customUnit: sub.customUnit ?? 'months',
    nextDate: sub.nextDate,
    note: sub.note ?? '',
  }
}

function recurrenceLabel(sub: Subscription): string {
  if (sub.recurrence === 'weekly') return t('subscriptions.recurrence.weekly')
  if (sub.recurrence === 'monthly') return t('subscriptions.recurrence.monthly')
  if (sub.recurrence === 'quarterly') return t('subscriptions.recurrence.quarterly')
  if (sub.recurrence === 'yearly') return t('subscriptions.recurrence.yearly')
  const every = sub.customEvery ?? 1
  const unit =
    sub.customUnit === 'weeks'
      ? t('subscriptions.unit.weeks')
      : sub.customUnit === 'years'
        ? t('subscriptions.unit.years')
        : t('subscriptions.unit.months')
  return t('subscriptions.recurrence.customEvery').replace('{n}', String(every)).replace(
    '{unit}',
    unit,
  )
}

export function SubscriptionsPage() {
  const { locale = 'es' } = useParams()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Subscription | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)

  const subs = useQuery({ queryKey: ['subscriptions'], queryFn: listSubscriptions })
  const accs = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const cardsQ = useQuery({ queryKey: ['cards'], queryFn: () => listCards() })

  const accMap = useMemo(
    () => new Map(accs.data?.items.map((a) => [a.id, a.name]) ?? []),
    [accs.data],
  )
  const cardMap = useMemo(
    () => new Map(cardsQ.data?.items.map((c) => [c.id, c.name]) ?? []),
    [cardsQ.data],
  )

  const cardsForSelect = useMemo(() => {
    const accountId = draft.accountId ? Number(draft.accountId) : null
    if (accountId == null) return []
    const selectedCardId = draft.cardId ? Number(draft.cardId) : null
    return (cardsQ.data?.items ?? []).filter(
      (c) =>
        c.accountId === accountId && (!c.archived || c.id === selectedCardId),
    )
  }, [cardsQ.data, draft.accountId, draft.cardId])

  const activeAccounts = useMemo(() => {
    const selectedId = draft.accountId ? Number(draft.accountId) : null
    return (accs.data?.items ?? []).filter((a) => !a.archived || a.id === selectedId)
  }, [accs.data, draft.accountId])

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('no editing')
      const amount = parseAmountToCents(draft.amount)
      return updateSubscription(editing.id, {
        amount,
        accountId: Number(draft.accountId),
        cardId: draft.cardId ? Number(draft.cardId) : null,
        recurrence: draft.recurrence,
        customEvery:
          draft.recurrence === 'custom' ? Number(draft.customEvery) || 1 : null,
        customUnit: draft.recurrence === 'custom' ? draft.customUnit : null,
        nextDate: draft.nextDate,
        note: draft.note || null,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['subscriptions'] })
      await qc.invalidateQueries({ queryKey: ['transactions'] })
      await qc.invalidateQueries({ queryKey: ['stats'] })
      setEditing(null)
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

  const cancel = useMutation({
    mutationFn: (id: number) => cancelSubscription(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['subscriptions'] })
      setEditing(null)
    },
  })

  function openEdit(sub: Subscription) {
    setEditing(sub)
    setDraft(fromSub(sub))
    setFormError(null)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const items = subs.data?.items ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {t('subscriptions.title')}
          </h1>
          <p className="mt-1 text-sm text-ink-2">{t('subscriptions.hint')}</p>
        </div>
        <Link
          to={`/${locale}/transactions`}
          className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('subscriptions.back')}
        </Link>
      </div>

      {subs.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {subs.isError && <p className="text-danger">{t('common.error')}</p>}

      {subs.data && items.length === 0 && (
        <p className="text-ink-2">{t('subscriptions.empty')}</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((sub) => (
            <li
              key={sub.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-surface px-4 py-3 shadow-raised"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left focus-visible:shadow-focus focus-visible:outline-none"
                onClick={() => openEdit(sub)}
              >
                <span className="block font-semibold">
                  {sub.note?.trim() || t('subscriptions.unnamed')}
                </span>
                <span className="mt-0.5 block text-sm text-ink-2">
                  {recurrenceLabel(sub)}
                  {' · '}
                  {accMap.get(sub.accountId) ?? sub.accountId}
                  {sub.cardId != null && cardMap.has(sub.cardId)
                    ? ` · ${cardMap.get(sub.cardId)}`
                    : ''}
                  {sub.status === 'active'
                    ? ` · ${t('subscriptions.next')}: ${sub.nextDate}`
                    : ` · ${t('subscriptions.status.cancelled')}`}
                </span>
              </button>
              <span
                className={`tabular-nums font-medium ${
                  sub.status === 'cancelled' ? 'text-ink-2' : 'text-expense'
                }`}
              >
                −{formatCents(sub.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-lg rounded-sheet bg-surface p-5 shadow-raised"
          >
            <h2 className="mb-4 text-lg font-bold">{t('subscriptions.edit')}</h2>
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-sm text-ink-2">
                  {t('transactions.note')}
                </span>
                <input
                  className={field}
                  value={draft.note}
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  placeholder={t('subscriptions.notePlaceholder')}
                />
              </label>
              <label>
                <span className="mb-1 block text-sm text-ink-2">
                  {t('transactions.amount')}
                </span>
                <input
                  className={`${field} tabular-nums`}
                  required
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </label>
              <label>
                <span className="mb-1 block text-sm text-ink-2">
                  {t('subscriptions.recurrence')}
                </span>
                <select
                  className={field}
                  value={draft.recurrence}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      recurrence: e.target.value as SubscriptionRecurrence,
                    })
                  }
                >
                  <option value="weekly">{t('subscriptions.recurrence.weekly')}</option>
                  <option value="monthly">{t('subscriptions.recurrence.monthly')}</option>
                  <option value="quarterly">
                    {t('subscriptions.recurrence.quarterly')}
                  </option>
                  <option value="yearly">{t('subscriptions.recurrence.yearly')}</option>
                  <option value="custom">{t('subscriptions.recurrence.other')}</option>
                </select>
              </label>
              {draft.recurrence === 'custom' && (
                <div className="grid grid-cols-[1fr_1fr] gap-2">
                  <label>
                    <span className="mb-1 block text-sm text-ink-2">
                      {t('subscriptions.every')}
                    </span>
                    <input
                      className={`${field} tabular-nums`}
                      type="number"
                      min={1}
                      required
                      value={draft.customEvery}
                      onChange={(e) =>
                        setDraft({ ...draft, customEvery: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-sm text-ink-2">
                      {t('subscriptions.unit')}
                    </span>
                    <select
                      className={field}
                      value={draft.customUnit}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          customUnit: e.target.value as SubscriptionCustomUnit,
                        })
                      }
                    >
                      <option value="weeks">{t('subscriptions.unit.weeks')}</option>
                      <option value="months">{t('subscriptions.unit.months')}</option>
                      <option value="years">{t('subscriptions.unit.years')}</option>
                    </select>
                  </label>
                </div>
              )}
              <label>
                <span className="mb-1 block text-sm text-ink-2">
                  {t('subscriptions.next')}
                </span>
                <input
                  className={field}
                  type="date"
                  required
                  value={draft.nextDate}
                  onChange={(e) => setDraft({ ...draft, nextDate: e.target.value })}
                />
              </label>
              <label>
                <span className="mb-1 block text-sm text-ink-2">
                  {t('transactions.account')}
                </span>
                <select
                  className={field}
                  required
                  value={draft.accountId}
                  onChange={(e) =>
                    setDraft({ ...draft, accountId: e.target.value, cardId: '' })
                  }
                >
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm text-ink-2">
                  {t('transactions.card')}
                </span>
                <select
                  className={field}
                  value={draft.cardId}
                  onChange={(e) => setDraft({ ...draft, cardId: e.target.value })}
                >
                  <option value="">{t('transactions.cardNone')}</option>
                  {cardsForSelect.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {formError && <p className="mt-3 text-sm text-danger">{formError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={save.isPending || editing.status === 'cancelled'}
                className="inline-flex h-tap items-center rounded-pill bg-accent px-4 font-semibold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
              >
                {t('subscriptions.save')}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
              >
                {t('transactions.cancel')}
              </button>
              {editing.status === 'active' && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t('subscriptions.cancelConfirm'))) {
                      cancel.mutate(editing.id)
                    }
                  }}
                  className="inline-flex h-tap items-center rounded-pill bg-danger-weak px-4 text-danger focus-visible:shadow-focus focus-visible:outline-none"
                >
                  {t('subscriptions.unsubscribe')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
