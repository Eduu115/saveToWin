import { api } from './client'
import type { Category, Transaction } from '../domain'
import { listAccounts } from './accounts'

export { listAccounts }

export function listTransactions(params: {
  from?: string
  to?: string
  limit?: number
  offset?: number
}) {
  const q = new URLSearchParams()
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.limit) q.set('limit', String(params.limit))
  if (params.offset) q.set('offset', String(params.offset))
  const qs = q.toString()
  return api<{ items: Transaction[]; total: number }>(
    `/api/transactions${qs ? `?${qs}` : ''}`,
  )
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
}) {
  return api<{ inserted: number; skippedDuplicates: number; items: Transaction[] }>(
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
