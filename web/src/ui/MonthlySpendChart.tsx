import { formatCents } from '@savetowin/shared/money'
import { Info } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { MonthlyBar } from '../api/stats'
import { t } from '../i18n/t'

function eurosAxis(cents: number): string {
  const euros = Math.round(cents / 100)
  return String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function preferReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

function barFill(row: MonthlyBar): string {
  if (row.isCurrent) return 'var(--accent)'
  if (row.overBudget) return 'var(--warn)'
  return 'var(--expense)'
}

type Row = MonthlyBar & { euros: number }

function DarkTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; payload: Row }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  // Directions 11b: tooltip siempre oscuro en claro y oscuro
  return (
    <div
      className="min-w-[11rem] rounded-[12px] px-3.5 py-3 text-white"
      style={{ background: '#211B15' }}
    >
      <div className="mb-2 text-[11px] font-semibold text-white/65">{label}</div>
      <div className="flex items-center justify-between gap-3 text-[12.5px]">
        <span className="font-medium">{t('dashboard.chart.expenses')}</span>
        <span className="font-bold tabular-nums">{formatCents(row.expenseCents)}</span>
      </div>
    </div>
  )
}

/** Directions 1b / 11a — barras de gasto mensual + línea de ingreso. */
export function MonthlySpendChart({
  monthly,
  incomeReferenceCents,
}: {
  monthly: MonthlyBar[]
  incomeReferenceCents: number
}) {
  const reduced = useSyncExternalStore(subscribeMotion, preferReducedMotion, () => true)
  const withData = monthly.filter((m) => m.expenseCents > 0 || m.incomeCents > 0)
  const data: Row[] = monthly.map((m) => ({
    ...m,
    euros: Math.round(m.expenseCents / 100),
  }))

  if (withData.length === 0) return null

  const single = withData.length === 1
  const incomeLabel =
    incomeReferenceCents > 0
      ? `${t('dashboard.chart.income')} ${formatCents(incomeReferenceCents)}`
      : null

  return (
    <div className="flex flex-col gap-2">
      {incomeLabel && (
        <div className="flex justify-end">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
            <span
              className="inline-block w-[18px] border-t-2 border-dashed border-income"
              aria-hidden
            />
            {incomeLabel}
          </span>
        </div>
      )}
      <div className={`h-[200px] w-full ${single ? 'mx-auto max-w-[200px]' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barCategoryGap={single ? '40%' : '26%'}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--grid)"
              strokeWidth={1}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: 'var(--fg-2)',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              width={44}
              tickCount={4}
              tickFormatter={(v: number) => eurosAxis(v * 100)}
              tick={{
                fill: 'var(--fg-3)',
                fontSize: 10.5,
                fontWeight: 500,
              }}
            />
            <Tooltip
              cursor={{ fill: 'color-mix(in srgb, var(--fg) 6%, transparent)' }}
              content={<DarkTooltip />}
            />
            {incomeReferenceCents > 0 && (
              <ReferenceLine
                y={Math.round(incomeReferenceCents / 100)}
                stroke="var(--income)"
                strokeDasharray="5 4"
                strokeWidth={2}
              />
            )}
            <Bar
              dataKey="euros"
              maxBarSize={52}
              radius={[10, 10, 4, 4]}
              isAnimationActive={!reduced}
              animationDuration={400}
            >
              {data.map((row) => (
                <Cell key={row.period} fill={barFill(row)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {single && (
        <div className="flex items-center gap-1.5 text-[11px] font-medium leading-snug text-warn">
          <Info size={13} strokeWidth={2.4} aria-hidden />
          {t('dashboard.chart.singleMonth')}
        </div>
      )}
    </div>
  )
}
