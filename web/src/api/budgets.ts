import type { Budget } from '../domain'
import { api } from './client'

export function listBudgets() {
  return api<{ items: Budget[] }>('/api/budgets')
}

export function createBudget(body: {
  categoryId: number
  period: string
  limit: number
}) {
  return api<Budget>('/api/budgets', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateBudget(
  id: number,
  body: Partial<{ categoryId: number; period: string; limit: number }>,
) {
  return api<Budget>(`/api/budgets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function deleteBudget(id: number) {
  return api<{ ok: true }>(`/api/budgets/${id}`, { method: 'DELETE' })
}
