import { api } from './client'

export type BackupPayload = {
  version: 1
  exportedAt?: string
  user: { name?: string | null; savingsGoalCents?: number }
  accounts: {
    key: string
    label: string
    color: string
    name: string
    initialBalance: number
  }[]
  categories: {
    key: string
    label: string
    color: string
    type: 'expense' | 'income'
  }[]
  transactions: {
    date: string
    amount: number
    type: 'expense' | 'income'
    categoryKey: string
    accountKey: string
    note?: string | null
    tags?: string[] | null
  }[]
  budgets: { categoryKey: string; period: string; limit: number }[]
}

export function downloadBackup() {
  return api<BackupPayload>('/api/backup')
}

export function restoreBackup(body: BackupPayload) {
  return api<{
    ok: true
    transactions: number
    budgets: number
    accounts: number
    categories: number
  }>('/api/backup', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
