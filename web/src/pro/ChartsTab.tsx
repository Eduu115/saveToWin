import { formatCents } from '@savetowin/shared/money'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartPanel } from '../ui/ChartPanel'
import { CategorySpendRanking } from '../ui/CategorySpendRanking'
import { categoryCssVar } from '../ui/categoryMeta'
import { fetchAnalytics, monthShort, type Analytics } from './api'
import { tp } from './i18n'

const euros = (cents: number) => Math.round(cents / 100)
const axisEuros = (v: number) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.')

function TipBox({ title, rows }: { title: string; rows: { label: string; cents: number }[] }) {
  return (
    <div className="min-w-[10rem] rounded-[12px] bg-ink px-3.5 py-3 text-bg shadow-raised">
      <div className="mb-1.5 text-[11px] font-semibold opacity-70">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-3 text-[12.5px]">
          <span>{r.label}</span>
          <b className="tabular-nums">{formatCents(r.cents)}</b>
        </div>
      ))}
    </div>
  )
}

/** 11a · barras de gasto por mes (actual en terracota, pasados de límite en ámbar) + línea de ingreso. */
function MonthsChart({ data }: { data: Analytics }) {
  const rows = data.months.map((m) => ({
    ...m,
    label: monthShort(m.period),
    gasto: euros(m.expenseCents),
    ingreso: euros(m.incomeCents),
  }))
  return (
    <div className="h-[220px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="24%">
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-2)', fontSize: 11, fontWeight: 600 }} />
          <YAxis axisLine={false} tickLine={false} width={44} tickCount={4} tickFormatter={axisEuros} tick={{ fill: 'var(--fg-3)', fontSize: 10.5 }} />
          <Tooltip
            cursor={{ fill: 'color-mix(in srgb, var(--fg) 6%, transparent)' }}
            content={({ active, payload }) => {
              const r = payload?.[0]?.payload as (typeof rows)[number] | undefined
              if (!active || !r) return null
              return (
                <TipBox
                  title={r.label}
                  rows={[
                    { label: tp('ch.months.expense'), cents: r.expenseCents },
                    { label: tp('ch.months.income'), cents: r.incomeCents },
                  ]}
                />
              )
            }}
          />
          <Bar dataKey="gasto" radius={[8, 8, 3, 3]} maxBarSize={36}>
            {rows.map((r) => (
              <Cell
                key={r.period}
                fill={r.period === data.period ? 'var(--accent)' : r.overBudget ? 'var(--warn)' : 'var(--expense)'}
              />
            ))}
          </Bar>
          <Line type="monotone" dataKey="ingreso" stroke="var(--income)" strokeWidth={2} strokeDasharray="5 4" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 11a · donut: máximo 5 sectores + «Otras», total en el hueco, leyenda a la derecha. */
function Donut({ data }: { data: Analytics }) {
  const total = data.byCategory.reduce((s, c) => s + c.cents, 0)
  const top = data.byCategory.slice(0, 5)
  const rest = data.byCategory.slice(5).reduce((s, c) => s + c.cents, 0)
  const slices = [
    ...top.map((c) => ({ label: c.label, cents: c.cents, fill: categoryCssVar(c.color) })),
    ...(rest > 0 ? [{ label: tp('ch.donut.other'), cents: rest, fill: 'var(--c12)' }] : []),
  ]
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative size-[150px] flex-none">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="cents" innerRadius="62%" outerRadius="100%" stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
              {slices.map((s) => (
                <Cell key={s.label} fill={s.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[15px] font-extrabold tabular-nums">{formatCents(total)}</span>
          <span className="text-[10.5px] font-medium text-ink-2">{tp('ch.donut.spent')}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12.5px]">
            <span className="size-2.5 flex-none rounded-full" style={{ background: s.fill }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{s.label}</span>
            <b className="tabular-nums">{total > 0 ? Math.round((s.cents * 100) / total) : 0} %</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** 11a · área de ahorro acumulado con el objetivo como línea discontinua etiquetada. */
function SavingsArea({ data }: { data: Analytics }) {
  const rows = data.savings.map((s) => ({ label: monthShort(s.period), saldo: euros(s.balanceCents), cents: s.balanceCents }))
  const goal = euros(data.savingsGoalCents)
  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--grid)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: 'var(--fg-2)', fontSize: 11, fontWeight: 600 }} />
          <YAxis axisLine={false} tickLine={false} width={52} tickCount={4} tickFormatter={axisEuros} domain={[0, Math.max(goal, ...rows.map((r) => r.saldo)) || 1]} tick={{ fill: 'var(--fg-3)', fontSize: 10.5 }} />
          <Tooltip content={({ active, payload }) => {
            const r = payload?.[0]?.payload as (typeof rows)[number] | undefined
            return active && r ? <TipBox title={r.label} rows={[{ label: tp('ch.savings.title'), cents: r.cents }]} /> : null
          }} />
          {goal > 0 && (
            <ReferenceLine
              y={goal}
              stroke="var(--fg-3)"
              strokeDasharray="5 4"
              label={{ value: `${tp('ch.savings.goal')} ${formatCents(data.savingsGoalCents)}`, position: 'insideTopRight', fill: 'var(--fg-2)', fontSize: 10.5 }}
            />
          )}
          <Area type="monotone" dataKey="saldo" stroke="var(--savings)" strokeWidth={2.5} fill="var(--savings-weak)" dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

/** 11a · heatmap propio (no Recharts): un cuadro por día, seis pasos de la escala --s1…--s6. */
function Heatmap({ data }: { data: Analytics }) {
  const max = Math.max(0, ...data.daily.map((d) => d.cents))
  const step = (cents: number) => (cents === 0 || max === 0 ? 0 : Math.min(6, Math.ceil((cents / max) * 6)))
  // Lunes primero: hueco inicial según el día de la semana del día 1.
  const firstWeekday = (new Date(`${data.daily[0]?.date}T12:00:00Z`).getUTCDay() + 6) % 7
  return (
    <div className="flex flex-col gap-3">
      <div className="mx-auto grid w-full max-w-[18rem] grid-cols-7 gap-1.5">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <span key={d} className="text-center text-[10.5px] font-semibold text-ink-3">{d}</span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => <span key={`pad${i}`} aria-hidden />)}
        {data.daily.map((d) => {
          const s = step(d.cents)
          return (
            <span
              key={d.date}
              title={`${Number(d.date.slice(8))} · ${formatCents(d.cents)}`}
              className="flex aspect-square items-center justify-center rounded-[6px] text-[10px] font-semibold"
              style={{
                background: s === 0 ? 'var(--surface-2)' : `var(--s${s})`,
                color: s >= 4 ? 'var(--on-accent)' : 'var(--fg-2)',
              }}
            >
              {Number(d.date.slice(8))}
            </span>
          )
        })}
      </div>
      <div className="mx-auto flex w-full max-w-[18rem] items-center justify-end gap-1.5 text-[10.5px] text-ink-3">
        <span>0 €</span>
        {[1, 2, 3, 4, 5, 6].map((s) => (
          <span key={s} className="size-3 rounded-[3px]" style={{ background: `var(--s${s})` }} aria-hidden />
        ))}
        <span>{formatCents(max)}</span>
      </div>
    </div>
  )
}

/** Límites visualizados: por categoría, 6 meses de gasto frente a su límite. */
function LimitsBoard({ data }: { data: Analytics }) {
  if (data.limits.length === 0) return <p className="py-6 text-center text-[13px] text-ink-3">{tp('ch.limits.none')}</p>
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-ink-2">{tp('ch.limits.hint')}</p>
      {data.limits.map((l) => (
        <div key={l.categoryKey} className="grid grid-cols-[minmax(0,8rem)_1fr] items-end gap-3">
          <span className="truncate pb-4 text-[12.5px] font-semibold">{l.label}</span>
          <div className="grid grid-cols-6 gap-1.5">
            {l.months.map((m) => {
              const has = m.limitCents > 0
              const ratio = has ? Math.min(1.3, m.spentCents / m.limitCents) : 0
              const over = has && m.spentCents > m.limitCents
              return (
                <div key={m.period} className="flex flex-col items-center gap-1" title={`${monthShort(m.period)} · ${formatCents(m.spentCents)} / ${has ? formatCents(m.limitCents) : '—'}`}>
                  <div className="relative h-10 w-full rounded-[5px] bg-track">
                    {has && <span className="absolute inset-x-0 border-t border-dashed border-ink-3" style={{ bottom: `${(1 / 1.3) * 100}%` }} aria-hidden />}
                    <span
                      className="absolute inset-x-0 bottom-0 rounded-[5px]"
                      style={{ height: `${(ratio / 1.3) * 100}%`, background: over ? 'var(--danger)' : categoryCssVar(l.color) }}
                    />
                  </div>
                  <span className={`text-[10px] font-semibold ${over ? 'text-danger' : 'text-ink-3'}`}>{monthShort(m.period)}</span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function ChartsTab({ period }: { period: string }) {
  const q = useQuery({ queryKey: ['pro', 'analytics', period], queryFn: () => fetchAnalytics(period) })
  const state = q.isPending ? 'loading' : q.isError ? 'error' : 'ready'
  const data = q.data
  const hasMonth = (data?.byCategory.length ?? 0) > 0
  return (
    <div className="flex flex-col gap-4 lg:gap-3">
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:gap-3">
        <ChartPanel title={tp('ch.months.title')} state={state}>
          {data && <MonthsChart data={data} />}
        </ChartPanel>
        <ChartPanel title={tp('ch.donut.title')} state={data && !hasMonth ? 'empty' : state}>
          {data && <Donut data={data} />}
        </ChartPanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:gap-3">
        <ChartPanel title={tp('ch.savings.title')} state={state}>
          {data && <SavingsArea data={data} />}
        </ChartPanel>
        <ChartPanel title={tp('ch.heatmap.title')} state={data && !hasMonth ? 'empty' : state}>
          {data && <Heatmap data={data} />}
        </ChartPanel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr] lg:gap-3">
        <ChartPanel title={tp('ch.limits.title')} state={state}>
          {data && <LimitsBoard data={data} />}
        </ChartPanel>
        <ChartPanel title={tp('ch.ranking.title')} state={data && !hasMonth ? 'empty' : state}>
          {data && (
            <CategorySpendRanking
              items={data.byCategory.map((c) => ({ key: c.key, label: c.label, color: c.color, expenseCents: c.cents }))}
              maxItems={20}
            />
          )}
        </ChartPanel>
      </div>
    </div>
  )
}
