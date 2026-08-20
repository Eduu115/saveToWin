import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { useMemo, useState, type FormEvent } from 'react'
import {
  createTransaction,
  deleteTransaction,
  listAccounts,
  listCategories,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import { ApiClientError } from '../api/client'
import type { Transaction } from '../domain'
import { t } from '../i18n/t'

type FlowDraft = 'expense' | 'income' | 'savings'

type Draft = {
  date: string
  amount: string
  type: FlowDraft
  categoryId: string
  accountId: string
  note: string
}

const emptyDraft = (): Draft => ({
  date: new Date().toISOString().slice(0, 10),
  amount: '',
  type: 'expense',
  categoryId: '',
  accountId: '',
  note: '',
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
    note: tx.note ?? '',
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

  const activeCats = useMemo(
    () => (cats.data?.items ?? []).filter((c) => !c.archived),
    [cats.data],
  )

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
    return list
  }, [activeCats, cats.data, draft.categoryId, draft.type])

  const save = useMutation({
    mutationFn: async () => {
      const amount = parseAmountToCents(draft.amount)
      const body = {
        date: draft.date,
        amount,
        type: draft.type,
        categoryId: Number(draft.categoryId),
        accountId: Number(draft.accountId),
        note: draft.note || null,
      }
      if (editing) return updateTransaction(editing.id, body)
      return createTransaction(body)
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['transactions'] })
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
      const first = activeCats.find((c) => c.type === 'expense')
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
    const expense = activeCats.find((c) => c.type === 'expense')
    if (expense) d.categoryId = String(expense.id)
    if (accs.data?.items[0]) d.accountId = String(accs.data.items[0].id)
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
  const accMap = new Map(accs.data?.items.map((a) => [a.id, a.label]) ?? [])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">{t('transactions.title')}</h1>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex h-tap items-center rounded-pill bg-accent px-4 font-semibold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('transactions.new')}
        </button>
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
                  <td className="px-4 py-3">{accMap.get(tx.accountId) ?? tx.accountId}</td>
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
              {editing ? t('transactions.edit') : t('transactions.new')}
            </h2>
            <div className="grid gap-3">
              <label>
                <span className="mb-1 block text-sm text-ink-2">{t('transactions.date')}</span>
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
              <label>
                <span className="mb-1 block text-sm text-ink-2">{t('transactions.account')}</span>
                <select
                  className={field}
                  required
                  value={draft.accountId}
                  onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}
                >
                  {(accs.data?.items ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1 block text-sm text-ink-2">{t('transactions.note')}</span>
                <input
                  className={field}
                  value={draft.note}
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
