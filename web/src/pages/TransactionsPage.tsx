import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import { listCards } from '../api/accounts'
import { createSubscription } from '../api/subscriptions'
import { ApiClientError } from '../api/client'
import type {
  SubscriptionCustomUnit,
  SubscriptionRecurrence,
  Transaction,
} from '../domain'
import { t } from '../i18n/t'
import { sortCategoriesByDisplayOrder } from '../ui/categoryMeta'

type FlowDraft = 'expense' | 'income' | 'savings'

type Draft = {
  date: string
  amount: string
  type: FlowDraft
  categoryId: string
  accountId: string
  cardId: string
  note: string
  recurrence: SubscriptionRecurrence
  customEvery: string
  customUnit: SubscriptionCustomUnit
}

const emptyDraft = (): Draft => ({
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  type: 'expense',
  categoryId: '',
  accountId: '',
  cardId: '',
  note: '',
  recurrence: 'monthly',
  customEvery: '1',
  customUnit: 'months',
})

function fromTx(tx: Transaction): Draft {
  const abs = Math.abs(tx.amount)
  const whole = Math.floor(abs / 100)
  const frac = abs % 100
  return {
    date: tx.date,
    amount: `${whole},${String(frac).padStart(2, '0')}`,
    type: tx.type,
    categoryId: String(tx.categoryId),
    accountId: String(tx.accountId),
    cardId: tx.cardId != null ? String(tx.cardId) : '',
    note: tx.note ?? '',
    recurrence: 'monthly',
    customEvery: '1',
    customUnit: 'months',
  }
}

function typeLabel(type: FlowDraft): string {
  if (type === 'expense') return `↓ ${t('transactions.type.expense')}`
  if (type === 'income') return `↑ ${t('transactions.type.income')}`
  return `→ ${t('transactions.type.savings')}`
}

function amountClass(type: FlowDraft): string {
  if (type === 'income') return 'text-income'
  if (type === 'savings') return 'text-savings'
  return 'text-expense'
}

function amountSign(type: FlowDraft): string {
  if (type === 'expense') return '−'
  if (type === 'income') return '+'
  return '→'
}

export function TransactionsPage() {
  const { locale = 'es' } = useParams()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)

  const txs = useQuery({
    queryKey: ['transactions'],
    queryFn: () => listTransactions({ limit: 100 }),
  })
  const cats = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const accs = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const cardsQ = useQuery({ queryKey: ['cards'], queryFn: () => listCards() })

  const activeCats = useMemo(
    () => (cats.data?.items ?? []).filter((c) => !c.archived),
    [cats.data],
  )

  const selectedCat = useMemo(() => {
    if (!draft.categoryId) return undefined
    return (cats.data?.items ?? []).find((c) => String(c.id) === draft.categoryId)
  }, [cats.data, draft.categoryId])

  const isSubscriptionForm =
    !editing && selectedCat?.key === 'Subscriptions' && draft.type === 'expense'

  const activeAccounts = useMemo(() => {
    const items = accs.data?.items ?? []
    const selectedId = draft.accountId ? Number(draft.accountId) : null
    return items.filter((a) => !a.archived || a.id === selectedId)
  }, [accs.data, draft.accountId])

  const cardsForSelect = useMemo(() => {
    const accountId = draft.accountId ? Number(draft.accountId) : null
    if (accountId == null) return []
    const selectedCardId = draft.cardId ? Number(draft.cardId) : null
    return (cardsQ.data?.items ?? []).filter(
      (c) =>
        c.accountId === accountId && (!c.archived || c.id === selectedCardId),
    )
  }, [cardsQ.data, draft.accountId, draft.cardId])

  const catsForSelect = useMemo(() => {
    const byId = new Map((cats.data?.items ?? []).map((c) => [c.id, c]))
    const selected = draft.categoryId ? byId.get(Number(draft.categoryId)) : undefined
    let list = activeCats.filter((c) => {
      if (draft.type === 'savings') return c.type === 'savings'
      if (draft.type === 'income') return c.type === 'expense' || c.type === 'income'
      return c.type === 'expense'
    })
    if (selected?.archived && !list.some((c) => c.id === selected.id)) {
      list = [...list, selected]
    }
    return sortCategoriesByDisplayOrder(list)
  }, [activeCats, cats.data, draft.categoryId, draft.type])

  const save = useMutation({
    mutationFn: async () => {
      const amount = parseAmountToCents(draft.amount)
      if (isSubscriptionForm) {
        return createSubscription({
          categoryId: Number(draft.categoryId),
          accountId: Number(draft.accountId),
          cardId: draft.cardId ? Number(draft.cardId) : null,
          amount,
          recurrence: draft.recurrence,
          customEvery:
            draft.recurrence === 'custom' ? Number(draft.customEvery) || 1 : null,
          customUnit: draft.recurrence === 'custom' ? draft.customUnit : null,
          nextDate: draft.date,
          note: draft.note || null,
        })
      }
      const body = {
        date: draft.date,
        amount,
        type: draft.type,
        categoryId: Number(draft.categoryId),
        accountId: Number(draft.accountId),
        cardId: draft.cardId ? Number(draft.cardId) : null,
        note: draft.note || null,
      }
      if (editing) return updateTransaction(editing.id, body)
      return createTransaction(body)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['transactions'] })
      await qc.invalidateQueries({ queryKey: ['subscriptions'] })
      await qc.invalidateQueries({ queryKey: ['stats'] })
      setOpen(false)
      setEditing(null)
      setDraft(emptyDraft())
      setFormError(null)
    },
    onError: (err) => {
      setFormError(
        err instanceof ApiClientError
          ? err.body?.error.message ?? t('common.error')
          : err instanceof Error
            ? err.message
            : t('common.error'),
      )
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteTransaction(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['transactions'] })
      await qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  function applyTypeDefaults(type: FlowDraft, base: Draft): Draft {
    const next = { ...base, type }
    if (type === 'savings') {
      const savingsAcc = accs.data?.items.find((a) => a.key === 'Savings')
      const savingsCat = activeCats.find((c) => c.key === 'Savings transfer')
      if (savingsAcc) next.accountId = String(savingsAcc.id)
      if (savingsCat) next.categoryId = String(savingsCat.id)
    } else {
      const first = sortCategoriesByDisplayOrder(
        activeCats.filter((c) => c.type === 'expense'),
      )[0]
      const cur = activeCats.find((c) => String(c.id) === next.categoryId)
      if (first && (!next.categoryId || cur?.type === 'savings')) {
        next.categoryId = String(first.id)
      }
    }
    return next
  }

  function openNew() {
    setEditing(null)
    const d = emptyDraft()
    const expense = sortCategoriesByDisplayOrder(
      activeCats.filter((c) => c.type === 'expense'),
    )[0]
    if (expense) d.categoryId = String(expense.id)
    const firstAcc = (accs.data?.items ?? []).find((a) => !a.archived)
    if (firstAcc) d.accountId = String(firstAcc.id)
    setDraft(d)
    setFormError(null)
    setOpen(true)
  }

  function openEdit(tx: Transaction) {
    setEditing(tx)
    setDraft(fromTx(tx))
    setFormError(null)
    setOpen(true)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const field =
    'h-field w-full rounded-field border border-line bg-surface px-3 text-ink focus-visible:shadow-focus focus-visible:outline-none'
  const catMap = new Map(cats.data?.items.map((c) => [c.id, c.label]) ?? [])
  const accMap = new Map(accs.data?.items.map((a) => [a.id, a.name]) ?? [])
  const cardMap = new Map(cardsQ.data?.items.map((c) => [c.id, c.name]) ?? [])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('transactions.title')}</h1>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/${locale}/subscriptions`}
            className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 font-semibold text-ink focus-visible:shadow-focus focus-visible:outline-none"
          >
            {t('transactions.subscriptions')}
          </Link>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-tap items-center rounded-pill bg-accent px-4 font-semibold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
          >
            {t('transactions.new')}
          </button>
        </div>
      </div>

      {txs.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {txs.isError && <p className="text-danger">{t('common.error')}</p>}

      {txs.data && txs.data.items.length === 0 && (
        <p className="text-ink-2">{t('transactions.empty')}</p>
      )}

      {txs.data && txs.data.items.length > 0 && (
        <div className="overflow-x-auto rounded-card bg-surface shadow-raised">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-ink-2">
              <tr>
                <th className="px-4 py-3 font-medium">{t('transactions.date')}</th>
                <th className="px-4 py-3 font-medium">{t('transactions.type')}</th>
                <th className="px-4 py-3 font-medium">{t('transactions.category')}</th>
                <th className="px-4 py-3 font-medium">{t('transactions.account')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('transactions.amount')}</th>
              </tr>
            </thead>
            <tbody>
              {txs.data.items.map((tx) => (
                <tr
                  key={tx.id}
                  className="border-b border-line last:border-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-left font-medium focus-visible:shadow-focus focus-visible:outline-none"
                      onClick={() => openEdit(tx)}
                    >
                      {tx.date}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-ink-2">{typeLabel(tx.type)}</td>
                  <td className="px-4 py-3">{catMap.get(tx.categoryId) ?? tx.categoryId}</td>
                  <td className="px-4 py-3">
                    {accMap.get(tx.accountId) ?? tx.accountId}
                    {tx.cardId != null && cardMap.has(tx.cardId) && (
                      <span className="mt-0.5 block text-[11px] text-ink-2">
                        {cardMap.get(tx.cardId)}
                      </span>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium tabular-nums ${amountClass(tx.type)}`}
                  >
                    {amountSign(tx.type)}
                    {formatCents(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <form
            onSubmit={onSubmit}
            className="w-full max-w-lg rounded-sheet bg-surface p-5 shadow-raised"
          >
            <h2 className="mb-4 text-lg font-bold">
              {editing
                ? t('transactions.edit')
                : isSubscriptionForm
                  ? t('transactions.newSubscription')
                  : t('transactions.new')}
            </h2>
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-sm text-ink-2">
                  {isSubscriptionForm
                    ? t('subscriptions.firstCharge')
                    : t('transactions.date')}
                </span>
                <input
                  className={field}
                  type="date"
                  required
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </label>
              <label>
                <span className="mb-1 block text-sm text-ink-2">{t('transactions.amount')}</span>
                <input
                  className={`${field} tabular-nums`}
                  required
                  inputMode="decimal"
                  placeholder="12,34"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                />
              </label>
              {!isSubscriptionForm && (
                <label>
                  <span className="mb-1 block text-sm text-ink-2">{t('transactions.type')}</span>
                  <select
                    className={field}
                    value={draft.type}
                    onChange={(e) =>
                      setDraft(applyTypeDefaults(e.target.value as FlowDraft, draft))
                    }
                  >
                    <option value="expense">{t('transactions.type.expense')}</option>
                    <option value="income">{t('transactions.type.income')}</option>
                    <option value="savings">{t('transactions.type.savings')}</option>
                  </select>
                </label>
              )}
              <label>
                <span className="mb-1 block text-sm text-ink-2">{t('transactions.category')}</span>
                <select
                  className={field}
                  required
                  value={draft.categoryId}
                  onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                >
                  {catsForSelect.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              {isSubscriptionForm && (
                <>
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
                      <option value="weekly">
                        {t('subscriptions.recurrence.weekly')}
                      </option>
                      <option value="monthly">
                        {t('subscriptions.recurrence.monthly')}
                      </option>
                      <option value="quarterly">
                        {t('subscriptions.recurrence.quarterly')}
                      </option>
                      <option value="yearly">
                        {t('subscriptions.recurrence.yearly')}
                      </option>
                      <option value="custom">
                        {t('subscriptions.recurrence.other')}
                      </option>
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
                </>
              )}
              <label>
                <span className="mb-1 block text-sm text-ink-2">{t('transactions.account')}</span>
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
                <span className="mb-1 block text-sm text-ink-2">{t('transactions.card')}</span>
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
              <label>
                <span className="mb-1 block text-sm text-ink-2">
                  {isSubscriptionForm
                    ? t('subscriptions.noteLabel')
                    : t('transactions.note')}
                </span>
                <input
                  className={field}
                  value={draft.note}
                  placeholder={
                    isSubscriptionForm ? t('subscriptions.notePlaceholder') : undefined
                  }
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                />
              </label>
            </div>
            {formError && <p className="mt-3 text-sm text-danger">{formError}</p>}
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex h-tap items-center rounded-pill bg-accent px-4 font-semibold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
              >
                {t('transactions.save')}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
              >
                {t('transactions.cancel')}
              </button>
              {editing && (
                <button
                  type="button"
                  onClick={() => {
                    remove.mutate(editing.id)
                    setOpen(false)
                  }}
                  className="inline-flex h-tap items-center rounded-pill bg-danger-weak px-4 text-danger focus-visible:shadow-focus focus-visible:outline-none"
                >
                  {t('transactions.delete')}
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
