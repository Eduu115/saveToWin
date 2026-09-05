import { api } from './client'
import type { Subscription } from '../domain'

export type SubscriptionCreateBody = {
  categoryId: number
  accountId: number
  cardId?: number | null
  amount: number
  recurrence: Subscription['recurrence']
  customEvery?: number | null
  customUnit?: Subscription['customUnit']
  nextDate: string
  note?: string | null
}

export type SubscriptionPatchBody = Partial<
  SubscriptionCreateBody & { status: Subscription['status'] }
>

export function listSubscriptions() {
  return api<{ items: Subscription[] }>('/api/subscriptions')
}

export function createSubscription(body: SubscriptionCreateBody) {
  return api<Subscription>('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function updateSubscription(id: number, body: SubscriptionPatchBody) {
  return api<Subscription>(`/api/subscriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function cancelSubscription(id: number) {
  return api<Subscription>(`/api/subscriptions/${id}`, { method: 'DELETE' })
}
