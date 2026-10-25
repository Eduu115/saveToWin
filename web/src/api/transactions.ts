import { api } from './client'
import type { Category, Transaction } from '../domain'
import { listAccounts } from './accounts'

export { listAccounts }

export type TransactionQuery = {
  from?: string
  to?: string
  categoryIds?: number[]
  accountIds?: number[]
  type?: 'expense' | 'income' | 'savings'
  q?: string
  minAmount?: number
  maxAmount?: number
  sort?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export type TransactionPage = {
  items: Transaction[]
  total: number
  totals: { incomeCents: number; expenseCents: number }
}

export function listTransactions(params: TransactionQuery) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '' || (Array.isArray(v) && v.length === 0)) continue
    q.set(k, Array.isArray(v) ? v.join(',') : String(v))
  }
  const qs = q.toString()
  return api<TransactionPage>(`/api/transactions${qs ? `?${qs}` : ''}`)
}

export function createTransaction(body: {
  date: string
  amount: number
  type: 'expense' | 'income' | 'savings'
  categoryId: number
  accountId: number
  cardId?: number | null
  note?: string | null
}) {
  return api<Transaction>('/api/transactions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function createTransactionsBatch(body: {
  items: {
    date: string
    amount: number
    type: 'expense' | 'income' | 'savings'
    categoryId: number
    accountId: number
    cardId?: number | null
    note?: string | null
  }[]
  skipDuplicates?: boolean
  /** Una decisión para todos los duplicados del lote. */
  onDuplicate?: 'skip' | 'keep' | 'replace'
}) {
  return api<{ inserted: number; skippedDuplicates: number; replaced: number; items: Transaction[] }>(
    '/api/transactions/batch',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  )
}

export function updateTransaction(
  id: number,
  body: Partial<{
    date: string
    amount: number
    type: 'expense' | 'income' | 'savings'
    categoryId: number
    accountId: number
    cardId: number | null
    note: string | null
  }>,
) {
  return api<Transaction>(`/api/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteTransaction(id: number) {
  return api<{ ok: true }>(`/api/transactions/${id}`, { method: 'DELETE' })
}

export function listCategories() {
  return api<{ items: Category[] }>('/api/categories')
}

export function createCategory(body: { key: string; label: string; color: Category['color']; type: 'expense' | 'income' }) {
  return api<Category>('/api/categories', { method: 'POST', body: JSON.stringify(body) })
}

export function updateCategory(
  id: number,
  body: Partial<{ label: string; color: Category['color']; archived: boolean }>,
) {
  return api<Category>(`/api/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}
