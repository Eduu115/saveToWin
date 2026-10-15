import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { ArrowDown, ArrowUp, ChevronDown, Download, Pencil, Plus, Repeat, Search, Trash2 } from 'lucide-react'
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
import {
  FilterBar,
  FilterSheet,
  MobileFilterBar,
  NoResults,
  PAGE_SIZE,
  Pager,
  Popover,
  filterCount,
  monthLabel,
  readFilters,
  toQuery,
  writeFilters,
  type TxFilters,
} from '../ui/TransactionFilters'

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

  // Directions 4a–4d: filtros en la URL (?m=2026-10&q=…&c=1,2&p=2), página de 50.
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => readFilters(params), [params])
  const setFilters = (f: TxFilters) => setParams(writeFilters(f))
  const [searchOpen, setSearchOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkError, setBulkError] = useState<string | null>(null)

  const listQuery = { ...toQuery(filters), limit: PAGE_SIZE, offset: (filters.page - 1) * PAGE_SIZE }
  const txs = useQuery({
    queryKey: ['transactions', 'list', listQuery],
    queryFn: () => listTransactions(listQuery),
    placeholderData: keepPreviousData,
  })
  // Otra página o filtro: la selección no se arrastra.
  const listKey = JSON.stringify(listQuery)
  useEffect(() => {
    setSelected(new Set())
    setBulkError(null)
  }, [listKey])
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

  function openNew(subscription = false) {
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
    // Desde Suscripciones → «Nueva suscripción»: el alta ya viene en esa categoría.
    if (subscription && subsId != null) d.categoryId = String(subsId)
    setDraft(d)
    setFormError(null)
    setOpen(true)
  }

  // FAB de la barra inferior móvil → /transactions?new=1 · Suscripciones → ?new=subscription
  const ready = Boolean(txs.data && cats.data && accs.data)
  useEffect(() => {
    const kind = params.get('new')
    if ((kind !== '1' && kind !== 'subscription') || !ready) return
    const next = new URLSearchParams(params)
    next.delete('new')
    setParams(next, { replace: true })
    openNew(kind === 'subscription')
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

  const items = txs.data?.items ?? []
  const total = txs.data?.total ?? 0
  const filterCats = sortCategoriesByDisplayOrder(activeCats)
  const filterAccounts = (accs.data?.items ?? []).filter((a) => !a.archived)

  // ——— Selección múltiple (escritorio, Directions 4a) ———
  const selItems = items.filter((tx) => selected.has(tx.id))
  const selNet = selItems.reduce(
    (s, tx) => s + (tx.type === 'income' ? tx.amount : tx.type === 'expense' ? -tx.amount : 0),
    0,
  )
  const selTypes = new Set(selItems.map((tx) => tx.type))
  // Recategorizar solo dentro del mismo tipo (las de ahorro van aparte).
  const recatOptions =
    selTypes.size === 1 && !selTypes.has('savings')
      ? sortCategoriesByDisplayOrder(
          activeCats.filter((c) =>
            selTypes.has('income') ? c.type === 'expense' || c.type === 'income' : c.type === 'expense',
          ),
        )
      : []
  const accountOptions = selTypes.has('savings')
    ? []
    : filterAccounts.filter((a) => a.id !== savingsAccountId)
  const allOnPage = items.length > 0 && items.every((tx) => selected.has(tx.id))

  const bulk = useMutation({
    mutationFn: (op: { kind: 'category' | 'account'; id: number } | { kind: 'delete' }) =>
      // ponytail: una petición por movimiento (≤ 50, una página); endpoint por lotes si se queda corto.
      Promise.all(
        [...selected].map((id) =>
          op.kind === 'delete'
            ? deleteTransaction(id)
            : updateTransaction(id, op.kind === 'category' ? { categoryId: op.id } : { accountId: op.id }),
        ),
      ),
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: ['transactions'] })
      await qc.invalidateQueries({ queryKey: ['stats'] })
    },
    onSuccess: () => setSelected(new Set()),
    onError: (err) =>
      setBulkError(err instanceof ApiClientError ? err.body?.error.message ?? t('common.error') : t('common.error')),
  })

  function toggleOne(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  async function exportCsv() {
    const all: Transaction[] = []
    for (let offset = 0; ; offset += 100) {
      const page = await listTransactions({ ...toQuery(filters), limit: 100, offset })
      all.push(...page.items)
      if (page.items.length === 0 || all.length >= page.total) break
    }
    // Texto: entre comillas si hace falta y sin fórmulas (=, +, -, @ al principio).
    const text = (v: string) => {
      const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v
      return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
    }
    const amount = (tx: Transaction) =>
      `${tx.type === 'expense' ? '-' : ''}${Math.floor(tx.amount / 100)},${String(tx.amount % 100).padStart(2, '0')}`
    const typeName = { expense: t('transactions.type.expense'), income: t('transactions.type.income'), savings: t('transactions.type.savings') }
    const rows = [
      [t('transactions.date'), t('transactions.col.description'), t('transactions.category'), t('transactions.type'), t('transactions.account'), t('transactions.card'), t('transactions.amount')].join(';'),
      ...all.map((tx) =>
        [
          tx.date,
          text(tx.note ?? ''),
          text(catMap.get(tx.categoryId)?.label ?? ''),
          typeName[tx.type],
          text(accMap.get(tx.accountId) ?? ''),
          text(tx.cardId != null ? (cardMap.get(tx.cardId) ?? '') : ''),
          amount(tx),
        ].join(';'),
      ),
    ]
    const blob = new Blob([`﻿${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `savetowin-movimientos-${filters.month ?? 'todo'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const noFiltersAtAll = !filters.month && !filters.q && filterCount(filters) === 0
  const bulkBtn =
    'inline-flex min-h-tap items-center gap-1.5 rounded-pill px-3 text-[13px] font-semibold hover:bg-[color-mix(in_srgb,var(--bg)_12%,transparent)] focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-40'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold tracking-tight">{t('transactions.title')}</h1>
          {txs.data && (
            <p className="mt-1 text-[13px] text-ink-2">
              {total} {total === 1 ? t('transactions.countSuffixOne') : t('transactions.countSuffix')}
              {filters.month && ` ${t('transactions.summary.in')} ${monthLabel(filters.month).toLowerCase()}`}
              {' · '}
              {t('transactions.summary.out')} {formatCents(txs.data.totals.expenseCents)}
              {' · '}
              {t('transactions.summary.income')} {formatCents(txs.data.totals.incomeCents)}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSearchOpen((o) => !o)}
            aria-label={t('transactions.searchOpen')}
            aria-expanded={searchOpen || Boolean(filters.q)}
            className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink focus-visible:shadow-focus focus-visible:outline-none md:hidden"
          >
            <Search size={18} strokeWidth={2.2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void exportCsv()}
            disabled={total === 0}
            className="hidden h-tap items-center gap-2 rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-ink focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-40 md:inline-flex"
          >
            <Download size={15} strokeWidth={2.2} aria-hidden />
            {t('transactions.export')}
          </button>
          <Link
            to={`/${locale}/subscriptions`}
            className="inline-flex h-tap items-center gap-2 rounded-pill border border-line bg-surface px-4 text-sm font-semibold text-ink focus-visible:shadow-focus focus-visible:outline-none"
          >
            <Repeat size={15} strokeWidth={2.2} aria-hidden />
            {t('transactions.subscriptions')}
          </Link>
          <button
            type="button"
            onClick={() => openNew()}
            className="hidden h-tap items-center gap-2 rounded-pill bg-accent px-4 text-sm font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none md:inline-flex"
          >
            <Plus size={16} strokeWidth={2.4} aria-hidden />
            {t('transactions.new')}
          </button>
        </div>
      </div>

      <FilterBar filters={filters} onChange={setFilters} categories={filterCats} accounts={filterAccounts} />
      <MobileFilterBar
        filters={filters}
        onChange={setFilters}
        searchOpen={searchOpen}
        onOpenSheet={() => setSheetOpen(true)}
      />

      {selected.size > 0 && (
        <div className="mb-3 hidden flex-wrap items-center gap-1 rounded-field bg-ink px-3 py-1.5 text-bg md:flex">
          <span className="mr-2 px-1 text-[13.5px] font-bold tabular-nums">
            {selected.size} {selected.size === 1 ? t('transactions.selectedOne') : t('transactions.selected')} · {selNet >= 0 ? '+' : '−'} {formatCents(Math.abs(selNet))}
          </span>
          <Popover
            button={(open, tog) => (
              <button
                type="button"
                aria-expanded={open}
                onClick={tog}
                disabled={recatOptions.length === 0 || bulk.isPending}
                title={recatOptions.length === 0 ? t('transactions.bulk.mixed') : undefined}
                className={bulkBtn}
              >
                {t('transactions.bulk.recategorize')}
                <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          >
            {(close) => (
              <ul className="text-ink">
                {recatOptions.map((c) => {
                  const Icon = categoryIcon(c.key)
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          close()
                          bulk.mutate({ kind: 'category', id: c.id })
                        }}
                        className="flex min-h-tap w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-semibold hover:bg-surface-2 focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        <span className={`flex size-6 items-center justify-center rounded-[7px] text-white ${categoryBgClass(c.color)}`}>
                          <Icon size={13} strokeWidth={2.4} aria-hidden />
                        </span>
                        {c.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Popover>
          <Popover
            button={(open, tog) => (
              <button
                type="button"
                aria-expanded={open}
                onClick={tog}
                disabled={accountOptions.length === 0 || bulk.isPending}
                className={bulkBtn}
              >
                {t('transactions.bulk.account')}
                <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
              </button>
            )}
          >
            {(close) => (
              <ul className="text-ink">
                {accountOptions.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => {
                        close()
                        bulk.mutate({ kind: 'account', id: a.id })
                      }}
                      className="flex min-h-tap w-full items-center rounded-[10px] px-2.5 text-left text-[13.5px] font-semibold hover:bg-surface-2 focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      {a.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Popover>
          <button
            type="button"
            disabled={bulk.isPending}
            onClick={() => {
              if (window.confirm(t('transactions.bulk.deleteConfirm').replace('{n}', String(selected.size)))) {
                bulk.mutate({ kind: 'delete' })
              }
            }}
            className={`${bulkBtn} text-[color-mix(in_srgb,var(--danger)_55%,var(--bg))]`}
          >
            <Trash2 size={15} strokeWidth={2.2} aria-hidden />
            {t('transactions.bulk.delete')}
          </button>
          {bulkError && <span className="px-2 text-[12.5px] font-semibold">{bulkError}</span>}
          <button type="button" onClick={() => setSelected(new Set())} className={`${bulkBtn} ml-auto opacity-80`}>
            {t('transactions.bulk.clear')}
          </button>
        </div>
      )}

      {txs.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {txs.isError && <p className="text-danger">{t('common.error')}</p>}

      {txs.data && total === 0 && noFiltersAtAll && (
        <p className="text-ink-2">{t('transactions.empty')}</p>
      )}

      {txs.data && total === 0 && !noFiltersAtAll && (
        <div className="rounded-card border border-line bg-surface">
          <NoResults filters={filters} onChange={setFilters} categories={filterCats} />
        </div>
      )}

      {txs.data && items.length > 0 && (
        <div className={`overflow-hidden rounded-card border border-line bg-surface shadow-raised ${txs.isPlaceholderData ? 'opacity-60' : ''}`}>
          {/* Cabecera de columnas (escritorio): seleccionar página y orden por fecha */}
          <div className="hidden items-center gap-3 border-b border-line px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-ink-3 md:flex">
            <input
              type="checkbox"
              checked={allOnPage}
              onChange={() => setSelected(allOnPage ? new Set() : new Set(items.map((tx) => tx.id)))}
              aria-label={t('transactions.selectPage')}
              className="size-4 accent-[var(--accent)]"
            />
            <button
              type="button"
              onClick={() => setFilters({ ...filters, sort: filters.sort === 'desc' ? 'asc' : 'desc', page: 1 })}
              aria-label={filters.sort === 'desc' ? t('transactions.sort.newest') : t('transactions.sort.oldest')}
              className="inline-flex min-h-[32px] items-center gap-1 rounded-pill px-1 uppercase hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
            >
              {t('transactions.date')}
              {filters.sort === 'desc' ? (
                <ArrowDown size={12} strokeWidth={2.6} aria-hidden />
              ) : (
                <ArrowUp size={12} strokeWidth={2.6} aria-hidden />
              )}
            </button>
            <span className="flex-1" aria-hidden />
            <span className="w-44">{t('transactions.account')}</span>
            <span className="w-28 text-right">{t('transactions.amount')}</span>
            <span className="w-8" aria-hidden />
          </div>
          {groupByDay(items).map((day) => (
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
                  const label = tx.note || cat?.label || String(tx.categoryId)
                  return (
                    <li
                      key={tx.id}
                      className={`group flex items-center border-b border-line last:border-0 ${
                        tx.type === 'income' ? 'bg-income-weak' : 'hover:bg-surface-2'
                      }`}
                    >
                      <label className="hidden min-h-row cursor-pointer items-center self-stretch pl-4 md:flex">
                        <input
                          type="checkbox"
                          checked={selected.has(tx.id)}
                          onChange={() => toggleOne(tx.id)}
                          aria-label={`${t('transactions.select')}: ${label}`}
                          className="size-4 accent-[var(--accent)]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => openEdit(tx)}
                        className="flex min-h-row min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        <span
                          className={`flex size-8 flex-none items-center justify-center rounded-icon text-white ${cat ? categoryBgClass(cat.color) : 'bg-ink-3'}`}
                        >
                          <Icon size={16} strokeWidth={2.2} aria-hidden />
                        </span>
                        {/* Directions 4a/4b: descripción arriba; categoría (· cuenta en móvil) debajo */}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{label}</span>
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

      {txs.data && total > 0 && (
        <Pager page={filters.page} total={total} onPage={(page) => setFilters({ ...filters, page })} />
      )}

      {sheetOpen && (
        <FilterSheet
          filters={filters}
          categories={filterCats}
          accounts={filterAccounts}
          onClose={() => setSheetOpen(false)}
          onApply={(f) => {
            setFilters(f)
            setSheetOpen(false)
          }}
        />
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
