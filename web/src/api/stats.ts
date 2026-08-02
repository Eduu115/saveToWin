import type { ColorToken } from '@savetowin/shared/types'
import type { PeriodStats } from '@savetowin/shared/stats'
import { api } from './client'

export type MonthlyBar = {
  period: string
  label: string
  expenseCents: number
  incomeCents: number
  overBudget: boolean
  isCurrent: boolean
}

export type CategorySpend = {
  key: string
  label: string
  color: ColorToken
  expenseCents: number
}

export type DashboardStats = PeriodStats & {
  savingsStreakMonths: number
  charts: {
    monthly: MonthlyBar[]
    incomeReferenceCents: number
    byCategory: CategorySpend[]
  }
}

export function fetchStats(period?: string) {
  const qs = period ? `?period=${encodeURIComponent(period)}` : ''
  return api<DashboardStats>(`/api/stats${qs}`)
}
