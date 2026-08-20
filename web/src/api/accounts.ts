import { api } from './client'
import type { Account, Card } from '../domain'

export function listAccounts() {
  return api<{ items: Account[] }>('/api/accounts')
}

export function createAccount(body: { name: string; entity?: string | null }) {
  return api<Account>('/api/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateAccount(
  id: number,
  body: Partial<{ name: string; entity: string | null; archived: boolean }>,
) {
  return api<Account>(`/api/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function archiveAccount(id: number) {
  return api<Account>(`/api/accounts/${id}`, { method: 'DELETE' })
}

export function listCards(accountId?: number) {
  const q = accountId != null ? `?accountId=${accountId}` : ''
  return api<{ items: Card[] }>(`/api/cards${q}`)
}

export function createCard(body: { accountId: number; name: string }) {
  return api<Card>('/api/cards', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateCard(
  id: number,
  body: Partial<{ name: string; archived: boolean }>,
) {
  return api<Card>(`/api/cards/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function archiveCard(id: number) {
  return api<Card>(`/api/cards/${id}`, { method: 'DELETE' })
}
