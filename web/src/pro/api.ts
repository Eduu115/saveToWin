import type { ColorToken } from '@savetowin/shared/types'
import { api, ApiClientError } from '../api/client'

export type Analytics = {
  period: string
  months: { period: string; incomeCents: number; expenseCents: number; overBudget: boolean }[]
  byCategory: { key: string; label: string; color: ColorToken; cents: number }[]
  daily: { date: string; cents: number }[]
  savings: { period: string; balanceCents: number }[]
  savingsGoalCents: number
  limits: {
    categoryKey: string
    label: string
    color: ColorToken
    months: { period: string; limitCents: number; spentCents: number }[]
  }[]
}

export type GroupStatus = 'ok' | 'tight' | 'over' | 'tracking'
export type GroupIcon =
  | 'shapes'
  | 'party'
  | 'shield'
  | 'home'
  | 'car'
  | 'utensils'
  | 'plane'
  | 'heart'
  | 'gamepad'
  | 'shirt'

export type Group = {
  id: number
  name: string
  icon: GroupIcon
  limitCents: number | null
  warnPercent: number
  categoryIds: number[]
  spentCents: number
  status: GroupStatus
  history: { period: string; cents: number }[]
}

export type GroupsResponse = {
  period: string
  remainingDays: number
  items: Group[]
  coverage: { categoryId: number; groupIds: number[]; spentCents: number }[]
}

export type GroupInput = {
  name: string
  icon: GroupIcon
  limitCents: number | null
  warnPercent: number
  categoryIds: number[]
}

export type ProInsight = {
  code:
    | 'trend_up'
    | 'trend_down'
    | 'spike'
    | 'recurring'
    | 'cut_tip'
    | 'weekend'
    | 'projection'
    | 'savings_rate'
  tone: 'warning' | 'tip' | 'positive' | 'info'
  params: Record<string, string | number>
}

export type WrappedCover = {
  year: number
  incomeCents: number
  expenseCents: number
  keptCents: number
  savingsRatePercent: number | null
  movements: number
}

export type Wrapped = WrappedCover & {
  topCategories: { key: string; label: string; cents: number; percent: number }[]
  biggestMonth: { period: string; cents: number } | null
  bestSavingsMonth: { period: string; cents: number } | null
  biggestExpense: { note: string; categoryLabel: string; cents: number; date: string } | null
  favoritePlace: { note: string; visits: number; cents: number } | null
  favoriteWeekday: { weekday: number; cents: number } | null
  longestNoSpendStreak: number
  savedToAccountCents: number
  persona: 'saver' | 'foodie' | 'traveler' | 'shopper' | 'gamer' | 'homebody' | 'balanced'
}

export type WrappedResponse =
  | { premium: false; years: number[]; cover: WrappedCover }
  | { premium: true; years: number[]; wrapped: Wrapped }

export const fetchAnalytics = (period: string) => api<Analytics>(`/api/pro/analytics?period=${period}`)
export const fetchGroups = (period: string) => api<GroupsResponse>(`/api/pro/groups?period=${period}`)
export const fetchInsights = (period: string) =>
  api<{ period: string; items: ProInsight[] }>(`/api/pro/insights?period=${period}`)
export const fetchWrapped = (year: number) => api<WrappedResponse>(`/api/pro/wrapped?year=${year}`)

export const createGroup = (body: GroupInput) =>
  api<{ id: number }>('/api/pro/groups', { method: 'POST', body: JSON.stringify(body) })
export const updateGroup = (id: number, body: GroupInput) =>
  api<{ id: number }>(`/api/pro/groups/${id}`, { method: 'PUT', body: JSON.stringify(body) })
export const deleteGroup = (id: number) =>
  api<{ ok: true }>(`/api/pro/groups/${id}`, { method: 'DELETE' })

/** El servidor responde 402 PREMIUM_REQUIRED a quien no es premium. */
export const isPremiumRequired = (err: unknown) =>
  err instanceof ApiClientError && err.body?.error.code === 'PREMIUM_REQUIRED'

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MONTHS_LONG = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const monthShort = (period: string) => MONTHS_ES[Number(period.slice(5, 7)) - 1]
export const monthLong = (period: string) =>
  `${MONTHS_LONG[Number(period.slice(5, 7)) - 1]} ${period.slice(0, 4)}`

export function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export type ProMe = {
  plan: 'free' | 'premium'
  validUntil: string | null
  historyFrom: string | null
  freeHistoryDays: number
  enforced: boolean
}

export const fetchMe = () => api<ProMe>('/api/pro/me')
