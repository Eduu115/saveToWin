import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { Check, Pencil, Plus, Repeat, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
import {
  categoryBgClass,
  categoryIcon,
  sortCategoriesByDisplayOrder,
} from '../ui/categoryMeta'

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

function typeLabel(type: FlowDraft, categoryKey?: string): string {
  if (type === 'expense') return `↓ ${t('transactions.type.expense')}`
  if (type === 'income') return `↑ ${t('transactions.type.income')}`
  return `${amountSign(type, categoryKey)} ${t('transactions.type.savings')}`
}

function amountClass(type: FlowDraft): string {
  if (type === 'income') return 'text-income'
  if (type === 'savings') return 'text-savings'
  return 'text-expense'
}

function amountSign(type: FlowDraft, categoryKey?: string): string {
  if (type === 'expense') return '−'
  if (type === 'income') return '+'
  return categoryKey === 'Savings withdrawal' ? '←' : '→'
}

/** Neto del día: ingresos − gastos; el ahorro no cuenta (es una transferencia). */
function groupByDay(items: Transaction[]) {
  const days: { date: string; net: number; items: Transaction[] }[] = []
  for (const tx of items) {
    let day = days[days.length - 1]
    if (!day || day.date !== tx.date) {
      day = { date: tx.date, net: 0, items: [] }
      days.push(day)
    }
    day.items.push(tx)
    if (tx.type === 'income') day.net += tx.amount
    if (tx.type === 'expense') day.net -= tx.amount
  }
  return days
}

function draftAmountLabel(amount: string): string {
  try {
    return formatCents(parseAmountToCents(amount || '0'))
  } catch {
    return formatCents(0)
  }
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
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
  // Ahorro: solo fecha + cantidad + ingreso/retirada; cuenta siempre Savings, sin tarjeta.
  const isSavingsForm = draft.type === 'savings'
  const savingsAccountId = accs.data?.items.find((a) => a.key === 'Savings')?.id

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
      if (isSavingsForm && savingsAccountId == null) throw new Error(t('common.error'))
      const body = {
        date: draft.date,
        amount,
        type: draft.type,
        categoryId: Number(draft.categoryId),
        accountId: isSavingsForm ? Number(savingsAccountId) : Number(draft.accountId),
        cardId: !isSavingsForm && draft.cardId ? Number(draft.cardId) : null,
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
      setOpen(false)
      setEditing(null)
    },
    onError: () => setFormError(t('common.error')),
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
      if (savingsAccountId != null && next.accountId === String(savingsAccountId)) {
        const firstAcc = (accs.data?.items ?? []).find(
          (a) => !a.archived && a.id !== savingsAccountId,
        )
        if (firstAcc) next.accountId = String(firstAcc.id)
      }
    }
    return next
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

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
  const catMap = new Map(cats.data?.items.map((c) => [c.id, c]) ?? [])
  const accMap = new Map(accs.data?.items.map((a) => [a.id, a.name]) ?? [])
  const cardMap = new Map(cardsQ.data?.items.map((c) => [c.id, c.name]) ?? [])

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold tracking-tight">{t('transactions.title')}</h1>
          {txs.data && txs.data.items.length > 0 && (
            <p className="mt-1 text-[13px] text-ink-2">
              {txs.data.total} {t('transactions.countSuffix')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/${locale}/subscriptions`}
            className="inline-flex h-tap items-center gap-2 rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-ink focus-visible:shadow-focus focus-visible:outline-none"
          >
            <Repeat size={15} strokeWidth={2.2} aria-hidden />
            {t('transactions.subscriptions')}
          </Link>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-tap items-center gap-2 rounded-pill bg-accent px-4 text-sm font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden />
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
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-raised">
          {groupByDay(txs.data.items).map((day) => (
            <section key={day.date}>
              <h2 className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-2">
                <span>{dayLabel(day.date)}</span>
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="tabular-nums">
                  {day.net >= 0 ? '+' : '−'} {formatCents(Math.abs(day.net))}
                </span>
              </h2>
              <ul>
                {day.items.map((tx) => {
                  const cat = catMap.get(tx.categoryId)
                  const Icon = categoryIcon(cat?.key ?? '')
                  const card = tx.cardId != null ? cardMap.get(tx.cardId) : undefined
                  return (
                    <li key={tx.id} className="border-b border-line last:border-0">
                      <button
                        type="button"
                        onClick={() => openEdit(tx)}
                        className="group flex min-h-row w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        <span
                          className={`flex size-8 flex-none items-center justify-center rounded-icon text-white ${cat ? categoryBgClass(cat.color) : 'bg-ink-3'}`}
                        >
                          <Icon size={16} strokeWidth={2.2} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {cat?.label ?? tx.categoryId}
                          </span>
                          <span className="block truncate text-[12px] text-ink-2">
                            {tx.note || typeLabel(tx.type, cat?.key)}
                          </span>
                        </span>
                        <span className="hidden w-44 min-w-0 text-[13px] text-ink-2 sm:block">
                          <span className="block truncate">
                            {accMap.get(tx.accountId) ?? tx.accountId}
                          </span>
                          {card && <span className="block truncate text-[11px]">{card}</span>}
                        </span>
                        <span
                          className={`w-28 text-right text-sm font-bold tabular-nums ${amountClass(tx.type)}`}
                        >
                          {amountSign(tx.type, cat?.key)} {formatCents(tx.amount)}
                        </span>
                        <span
                          className="flex size-8 flex-none items-center justify-center rounded-full text-ink-3 group-hover:bg-surface group-hover:text-ink"
                          aria-hidden
                        >
                          <Pencil size={15} strokeWidth={2.2} />
                        </span>
                        <span className="sr-only">{t('transactions.edit')}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <form
            onSubmit={onSubmit}
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-sheet bg-surface shadow-raised"
          >
            <div className="bg-accent px-5 pb-5 pt-4 text-accent-fg">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-bold">
                  {editing
                    ? t('transactions.edit')
                    : isSubscriptionForm
                      ? t('transactions.newSubscription')
                      : t('transactions.new')}
                </h2>
                <div className="flex gap-2">
                  {editing && (
                    <button
                      type="button"
                      aria-label={t('transactions.delete')}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(t('transactions.deleteConfirm'))) {
                          remove.mutate(editing.id)
                        }
                      }}
                      className="inline-flex size-tap items-center justify-center rounded-full bg-accent-fg/15 hover:bg-accent-fg/25 focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      <Trash2 size={17} strokeWidth={2.2} aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={t('transactions.close')}
                    onClick={() => setOpen(false)}
                    className="inline-flex size-tap items-center justify-center rounded-full bg-accent-fg/15 hover:bg-accent-fg/25 focus-visible:shadow-focus focus-visible:outline-none"
                  >
                    <X size={18} strokeWidth={2.2} aria-hidden />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-center text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
                {draftAmountLabel(draft.amount)}
              </p>
            </div>
            <div className="grid gap-3 p-5">
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
              {!isSavingsForm && (
                <>
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
                </>
              )}
            </div>
            <div className="px-5 pb-5">
              {formError && <p className="mb-3 text-sm text-danger">{formError}</p>}
              <button
                type="submit"
                disabled={save.isPending}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-accent font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
              >
                <Check size={18} strokeWidth={2.4} aria-hidden />
                {t('transactions.save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
