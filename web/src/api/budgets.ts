import type { Budget } from '../domain'
import { api } from './client'

// ponytail: UI «Límites»; endpoint/tabla siguen `/api/budgets` para no migrar dominio.

/** Filas crudas (cada una rige desde su mes); resolver con `effectiveBudgets`. */
export function listBudgets() {
  return api<{ items: Budget[] }>('/api/budgets')
}

/** Límite mensual desde `period` en adelante; `limit: 0` lo quita desde ese mes. */
export function setBudget(body: { categoryId: number; period: string; limit: number }) {
  return api<Budget>('/api/budgets', {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
