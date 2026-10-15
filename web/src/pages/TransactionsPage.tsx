import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { Pencil, Plus, Repeat } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
import type { Transaction } from '../domain'
import { t } from '../i18n/t'
import {
  categoryBgClass,
  categoryIcon,
  sortCategoriesByDisplayOrder,
} from '../ui/categoryMeta'
import { MovementSheet, type FlowDraft, type MovementDraft } from '../ui/MovementSheet'

type Draft = MovementDraft

const emptyDraft = (): Draft => ({
  date: new Date().toLocaleDateString('sv-SE'),
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
    // Directions 3a: sugerencias = última categoría y última cuenta usadas en un gasto.
    // Nunca sugerir Suscripciones: esa categoría convierte el alta en una suscripción
    // (y los cargos que genera cada suscripción son justo los gastos más recientes).
    const subsId = activeCats.find((c) => c.key === 'Subscriptions')?.id
    const last = txs.data?.items.find(
      (tx) => tx.type === 'expense' && tx.subscriptionId == null && tx.categoryId !== subsId,
    )
    const lastCat = activeCats.find((c) => c.id === last?.categoryId)
    const lastAcc = (accs.data?.items ?? []).find((a) => a.id === last?.accountId && !a.archived)
    const expense =
      lastCat ??
      sortCategoriesByDisplayOrder(
        activeCats.filter((c) => c.type === 'expense' && c.id !== subsId),
      )[0]
    if (expense) d.categoryId = String(expense.id)
    const firstAcc = lastAcc ?? (accs.data?.items ?? []).find((a) => !a.archived)
    if (firstAcc) d.accountId = String(firstAcc.id)
    setDraft(d)
    setFormError(null)
    setOpen(true)
  }

  // FAB de la barra inferior móvil → /transactions?new=1
  const [params, setParams] = useSearchParams()
  const ready = Boolean(txs.data && cats.data && accs.data)
  useEffect(() => {
    if (params.get('new') !== '1' || !ready) return
    setParams({}, { replace: true })
    openNew()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, ready])

  function openEdit(tx: Transaction) {
    setEditing(tx)
    setDraft(fromTx(tx))
    setFormError(null)
    setOpen(true)
  }

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
            className="hidden h-tap items-center gap-2 rounded-pill bg-accent px-4 text-sm font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none md:inline-flex"
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
                        className={`group flex min-h-row w-full items-center gap-3 px-4 py-2.5 text-left focus-visible:shadow-focus focus-visible:outline-none ${
                          tx.type === 'income' ? 'bg-income-weak' : 'hover:bg-surface-2'
                        }`}
                      >
                        <span
                          className={`flex size-8 flex-none items-center justify-center rounded-icon text-white ${cat ? categoryBgClass(cat.color) : 'bg-ink-3'}`}
                        >
                          <Icon size={16} strokeWidth={2.2} aria-hidden />
                        </span>
                        {/* Directions 4a/4b: descripción arriba; categoría (· cuenta en móvil) debajo */}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {tx.note || cat?.label || tx.categoryId}
                          </span>
                          <span className="block truncate text-[12px] text-ink-2">
                            {tx.note ? cat?.label : typeLabel(tx.type, cat?.key)}
                            <span className="sm:hidden">
                              {' · '}
                              {accMap.get(tx.accountId) ?? tx.accountId}
                            </span>
                          </span>
                        </span>
                        <span className="hidden w-44 min-w-0 text-[13px] text-ink-2 sm:block">
                          <span className="block truncate">
                            {accMap.get(tx.accountId) ?? tx.accountId}
                          </span>
                          {card && <span className="block truncate text-[11px]">{card}</span>}
                        </span>
                        <span
                          className={`whitespace-nowrap text-right text-sm font-bold tabular-nums sm:w-28 ${amountClass(tx.type)}`}
                        >
                          {amountSign(tx.type, cat?.key)} {formatCents(tx.amount)}
                        </span>
                        <span
                          className="hidden size-8 flex-none items-center justify-center rounded-full text-ink-3 group-hover:bg-surface group-hover:text-ink sm:flex"
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
        <MovementSheet
          draft={draft}
          setDraft={setDraft}
          editing={editing != null}
          isSubscriptionForm={isSubscriptionForm}
          isSavingsForm={isSavingsForm}
          categories={catsForSelect}
          accounts={activeAccounts}
          cards={cardsForSelect}
          formError={formError}
          saving={save.isPending}
          deleting={remove.isPending}
          onTypeChange={(type) => setDraft(applyTypeDefaults(type, draft))}
          onSubmit={() => save.mutate()}
          onDelete={() => {
            if (editing && window.confirm(t('transactions.deleteConfirm'))) {
              remove.mutate(editing.id)
            }
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
