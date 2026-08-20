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
    entity?: string | null
    initialBalance: number
    archived?: boolean
  }[]
  cards?: {
    accountKey: string
    name: string
    archived?: boolean
  }[]
  categories: {
    key: string
    label: string
    color: string
    type: 'expense' | 'income' | 'savings'
  }[]
  transactions: {
    date: string
    amount: number
    type: 'expense' | 'income' | 'savings'
    categoryKey: string
    accountKey: string
    cardName?: string | null
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
    cards?: number
  }>('/api/backup', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
