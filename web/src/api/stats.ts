import type { Insight } from '@savetowin/shared/insights'
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
  /** Fuera de la ventana de historial disponible: sin cifras. */
  locked: boolean
}

export type CategorySpend = {
  key: string
  label: string
  color: ColorToken
  expenseCents: number
}

export type DashboardStats = PeriodStats & {
  /** `YYYY-MM-DD` desde el que hay historial disponible; null = sin límite. */
  historyFrom: string | null
  savingsStreakMonths: number
  charts: {
    monthly: MonthlyBar[]
    incomeReferenceCents: number
    byCategory: CategorySpend[]
  }
  insights: Insight[]
}

export function fetchStats(period?: string) {
  const qs = period ? `?period=${encodeURIComponent(period)}` : ''
  return api<DashboardStats>(`/api/stats${qs}`)
}
