import { formatCents } from '@savetowin/shared/money'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Flag,
  TrendingUp,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { fetchStats } from '../api/stats'
import { listAccounts, listCategories, listTransactions } from '../api/transactions'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { t } from '../i18n/t'
import { categoryBgClass, categoryIcon } from '../ui/categoryMeta'
import { CategorySpendRanking } from '../ui/CategorySpendRanking'
import { ChartPanel } from '../ui/ChartPanel'
import { InsightsColumn } from '../ui/InsightCard'
import { MonthlySpendChart } from '../ui/MonthlySpendChart'
import { ProgressRing } from '../ui/ProgressRing'

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${MONTHS_ES[m - 1]} ${y}`
}

function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatSigned(cents: number): string {
  const body = formatCents(Math.abs(cents))
  if (cents > 0) return `+ ${body}`
  if (cents < 0) return `− ${body}`
  return body
}

function formatRateTenths(tenths: number): string {
  const whole = Math.trunc(tenths / 10)
  const frac = Math.abs(tenths % 10)
  return `${whole},${frac} %`
}

/** Dashboard 1b — hero + objetivo + KPIs + gráficos. */
export function DashboardPage() {
  const { locale = DEFAULT_LOCALE } = useParams()
  const period = currentPeriod()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['stats', period],
    queryFn: () => fetchStats(period),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <ChartPanel title={t('dashboard.chart.spendTitle')} state="loading">
          {null}
        </ChartPanel>
      </div>
    )
  }
  if (isError || !data) {
    return <p className="text-danger">{t('common.error')}</p>
  }

  const empty = data.transactionCount === 0
  const remainingToGoal = Math.max(0, data.savingsGoalCents - data.savedCents)
  const streakSlots = 6
  const monthsWithSpend = data.charts.monthly.filter((m) => m.expenseCents > 0)
  const chartState =
    monthsWithSpend.length === 0
      ? ('empty' as const)
      : ('ready' as const)
  const catState =
    data.charts.byCategory.length === 0
      ? ('empty' as const)
      : ('ready' as const)

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        {/* Hero «you kept» — Directions 1b */}
        <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-raised sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-sm font-semibold text-ink-2">
              {empty
                ? t('dashboard.hero.emptyTitle')
                : `${periodLabel(data.period)} · ${t('dashboard.hero.kept')}`}
            </h1>
            <span className="text-[12.5px] font-medium text-ink-3">
              {data.daysInPeriod} {t('dashboard.days')} · {data.transactionCount}{' '}
              {t('dashboard.movements')}
            </span>
          </div>

          {empty ? (
            <div className="flex flex-col gap-2">
              <span className="text-[52px] font-extrabold leading-none tracking-tight text-line">
                — €
              </span>
              <p className="text-sm text-ink-3">{t('dashboard.hero.emptyHint')}</p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-4">
                <div
                  className={`text-[40px] font-extrabold leading-[0.95] tracking-tight tabular-nums sm:text-[52px] ${
                    data.balanceCents >= 0 ? 'text-savings' : 'text-ink'
                  }`}
                >
                  {formatSigned(data.balanceCents)}
                </div>
                {data.incomeCents > 0 && (
                  <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-pill bg-savings-weak px-3 py-2 text-[13px] font-semibold text-savings">
                    <TrendingUp size={14} strokeWidth={2.4} aria-hidden />
                    {formatRateTenths(data.savingsRateTenths)} {t('dashboard.savedRate')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="flex min-w-0 items-center gap-2.5 rounded-tile bg-surface-2 px-3 py-3 sm:gap-3 sm:px-4">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-income text-white">
                    <ArrowDownLeft size={16} strokeWidth={2.4} aria-hidden />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11.5px] font-medium text-ink-2">
                      {t('dashboard.moneyIn')}
                    </span>
                    <span className="truncate text-[15px] font-bold tabular-nums text-income sm:text-[17px]">
                      {formatSigned(data.incomeCents)}
                    </span>
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-2.5 rounded-tile bg-surface-2 px-3 py-3 sm:gap-3 sm:px-4">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-expense text-white">
                    <ArrowUpRight size={16} strokeWidth={2.4} aria-hidden />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11.5px] font-medium text-ink-2">
                      {t('dashboard.moneyOut')}
                    </span>
                    <span className="truncate text-[15px] font-bold tabular-nums sm:text-[17px]">
                      − {formatCents(data.expenseCents)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Objetivo + anillo — Directions 1b */}
        <section className="flex items-center gap-5 rounded-card border border-line bg-surface px-5 py-5 shadow-raised sm:px-6">
          <div className="relative h-[124px] w-[124px] flex-none">
            <ProgressRing
              percent={data.goalProgressPercent}
              size={124}
              strokeWidth={5}
              tone="savings"
              aria-label={`${data.goalProgressPercent} % ${t('dashboard.goal.ofGoal')}`}
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="text-2xl font-extrabold tabular-nums tracking-tight">
                {data.goalProgressPercent} %
              </span>
              <span className="text-[10.5px] font-medium text-ink-2">
                {t('dashboard.goal.ofGoal')}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-[13px] font-semibold text-ink-2">
              {t('dashboard.goal.title')}
            </div>
            <div className="text-[26px] font-extrabold tabular-nums tracking-tight">
              {formatCents(data.savedCents)}
            </div>
            <div className="text-[12.5px] font-medium leading-snug text-ink-2">
              {t('dashboard.goal.of')} {formatCents(data.savingsGoalCents)} ·{' '}
              {formatCents(remainingToGoal)} {t('dashboard.goal.toGo')}
            </div>
            {data.savingsStreakMonths > 0 && (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-savings">
                <Flag size={13} strokeWidth={2.4} aria-hidden />
                {data.savingsStreakMonths}{' '}
                {data.savingsStreakMonths === 1
                  ? t('dashboard.streak.month')
                  : t('dashboard.streak.months')}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* KPI row — Directions 1b / 9b */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <article className="flex min-w-0 flex-col gap-2.5 rounded-field border border-line bg-surface px-4 py-4 sm:px-5 sm:py-[18px]">
          <div className="text-[12.5px] font-semibold text-ink-2">
            {t('dashboard.kpi.budgetLeft')}
          </div>
          {data.budgetLimitCents === 0 ? (
            <>
              <span className="text-[24px] font-extrabold tracking-tight text-line sm:text-[30px]">— €</span>
              <span className="text-xs text-ink-3">{t('dashboard.kpi.noBudget')}</span>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-extrabold tabular-nums tracking-tight sm:text-[30px]">
                  {formatCents(Math.max(0, data.budgetRemainingCents))}
                </span>
                <span className="text-[12.5px] font-semibold text-warn">
                  {data.budgetUsedPercent} % {t('dashboard.kpi.used')}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-pill bg-track">
                <div
                  className="h-full rounded-pill bg-warn"
                  style={{ width: `${Math.min(100, data.budgetUsedPercent)}%` }}
                />
              </div>
            </>
          )}
        </article>

        <article className="flex min-w-0 flex-col gap-2.5 rounded-field border border-line bg-surface px-4 py-4 sm:px-5 sm:py-[18px]">
          <div className="text-[12.5px] font-semibold text-ink-2">
            {t('dashboard.kpi.dailyAvg')}
          </div>
          {empty ? (
            <>
              <span className="text-[24px] font-extrabold tracking-tight text-line sm:text-[30px]">— €</span>
              <span className="text-xs text-ink-3">{t('dashboard.kpi.noData')}</span>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-[24px] font-extrabold tabular-nums tracking-tight sm:text-[30px]">
                  {formatCents(data.dailyAverageCents)}
                </span>
                <span className="text-[12.5px] font-semibold text-ink-2">
                  {t('dashboard.kpi.perDay')}
                </span>
              </div>
              <p className="text-[12.5px] font-medium leading-snug text-ink-2">
                {t('dashboard.kpi.projection')}{' '}
                <b>{formatCents(data.expenseCents)}</b>
                {data.budgetLimitCents > 0 && (
                  <>
                    {' '}
                    — {t('dashboard.kpi.cap')} {formatCents(data.budgetLimitCents)}
                  </>
                )}
              </p>
            </>
          )}
        </article>

        <article className="col-span-2 flex min-w-0 flex-col gap-2.5 rounded-field border border-line bg-surface px-4 py-4 sm:px-5 sm:py-[18px]">
          <div className="text-[12.5px] font-semibold text-ink-2">
            {t('dashboard.kpi.streak')}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-extrabold tabular-nums tracking-tight sm:text-[30px]">
              {data.savingsStreakMonths}{' '}
              <span className="text-[18px] font-bold">
                {data.savingsStreakMonths === 1
                  ? t('dashboard.streak.month')
                  : t('dashboard.streak.months')}
              </span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: streakSlots }, (_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-pill ${
                  i < data.savingsStreakMonths ? 'bg-savings' : 'bg-track'
                }`}
              />
            ))}
          </div>
        </article>
      </div>

      {/* Directions 2a — en móvil el aviso va bajo los KPIs, y luego los últimos movimientos */}
      {data.insights.length > 0 && (
        <div className="xl:hidden">
          <InsightsColumn insights={data.insights} />
        </div>
      )}
      <LatestMovements locale={locale} />

      {/* Gráficos — Directions 1b / 11a / 11b */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <ChartPanel
          title={t('dashboard.chart.spendTitle')}
          state={chartState}
        >
          <MonthlySpendChart
            monthly={data.charts.monthly}
            incomeReferenceCents={data.charts.incomeReferenceCents}
          />
        </ChartPanel>

        <ChartPanel
          title={t('dashboard.chart.whereTitle')}
          state={catState}
          headerRight={
            data.charts.byCategory.length > 5 ? (
              <Link
                to={`/${locale}/transactions`}
                className="text-[12.5px] font-semibold text-accent focus-visible:shadow-focus focus-visible:outline-none"
              >
                {t('dashboard.chart.allCategories')}
              </Link>
            ) : null
          }
        >
          <CategorySpendRanking items={data.charts.byCategory} />
        </ChartPanel>
      </div>

    </div>

      {/* Avisos: columna propia con caja fija y scroll interno */}
      {data.insights.length > 0 && (
        <div className="hidden xl:sticky xl:top-6 xl:block">
          <InsightsColumn insights={data.insights} />
        </div>
      )}
    </div>
  )
}

/** Directions 2a — «Últimos» (solo móvil): tres movimientos y enlace a todos. */
function LatestMovements({ locale }: { locale: string }) {
  const txs = useQuery({
    queryKey: ['transactions', 'latest'],
    queryFn: () => listTransactions({ limit: 3 }),
  })
  const cats = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const accs = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const items = txs.data?.items ?? []
  if (items.length === 0) return null
  const catById = new Map((cats.data?.items ?? []).map((c) => [c.id, c]))
  const accById = new Map((accs.data?.items ?? []).map((a) => [a.id, a.name]))

  return (
    <section className="md:hidden" aria-labelledby="latest-title">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="latest-title" className="text-[15px] font-bold">
          {t('dashboard.latest')}
        </h2>
        <Link
          to={`/${locale}/transactions`}
          className="inline-flex min-h-tap items-center text-[13px] font-semibold text-accent focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('dashboard.latestAll')} {txs.data?.total ?? ''} →
        </Link>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((tx) => {
          const cat = catById.get(tx.categoryId)
          const Icon = categoryIcon(cat?.key ?? '')
          const income = tx.type === 'income'
          return (
            <li
              key={tx.id}
              className={`flex min-h-row items-center gap-3 rounded-tile px-2 py-2 ${income ? 'bg-income-weak' : ''}`}
            >
              <span
                className={`flex size-10 flex-none items-center justify-center rounded-icon text-white ${cat ? categoryBgClass(cat.color) : 'bg-ink-3'}`}
              >
                <Icon size={18} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {tx.note || cat?.label}
                </span>
                <span className="block truncate text-[12px] text-ink-2">
                  {cat?.label} · {accById.get(tx.accountId)}
                </span>
              </span>
              <span
                className={`whitespace-nowrap text-sm font-bold tabular-nums ${income ? 'text-income' : tx.type === 'savings' ? 'text-savings' : ''}`}
              >
                {income ? '+' : tx.type === 'savings' ? '→' : '−'} {formatCents(tx.amount)}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
