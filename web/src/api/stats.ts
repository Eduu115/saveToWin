import type { PeriodStats } from '@savetowin/shared/stats'
import { api } from './client'

export type DashboardStats = PeriodStats & {
  savingsStreakMonths: number
}

export function fetchStats(period?: string) {
  const qs = period ? `?period=${encodeURIComponent(period)}` : ''
  return api<DashboardStats>(`/api/stats${qs}`)
}
