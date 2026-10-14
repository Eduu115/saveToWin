import { formatCents } from '@savetowin/shared/money'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Info, Lightbulb, type LucideIcon, TriangleAlert } from 'lucide-react'
import { t } from '../i18n/t'
import { fetchInsights, type ProInsight } from './api'
import { tp } from './i18n'

const TONE: Record<ProInsight['tone'], { Icon: LucideIcon; shell: string; ink: string }> = {
  warning: { Icon: TriangleAlert, shell: 'bg-warn-weak border-line', ink: 'text-warn' },
  tip: { Icon: Lightbulb, shell: 'bg-accent-weak border-line', ink: 'text-accent' },
  positive: { Icon: CircleCheck, shell: 'bg-savings-weak border-line', ink: 'text-savings' },
  info: { Icon: Info, shell: 'bg-surface border-line', ink: 'text-ink-2' },
}

const money = (v: string | number) => formatCents(Number(v))
const shortDate = (iso: string | number) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })

/** Copy de cada heurística (los cálculos viven en el servidor, `server/pro/insights.ts`). */
function copy(i: ProInsight): { title: string; body: string } {
  const p = i.params
  const cat = String(p.categoryLabel ?? '')
  switch (i.code) {
    case 'trend_up':
      return {
        title: tp('in.trend_up.title', { cat, percent: p.percent }),
        body: tp('in.trend_up.body', {
          diff: money(p.diffCents),
          projected: p.projected ? tp('in.trend_up.projected') : '',
        }),
      }
    case 'trend_down':
      return {
        title: tp('in.trend_down.title', { cat, percent: p.percent }),
        body: tp('in.trend_down.body', { diff: money(p.diffCents) }),
      }
    case 'spike':
      return {
        title: tp('in.spike.title', { cat }),
        body: tp('in.spike.body', {
          what: p.note ? `${p.note}: ` : '',
          amount: money(p.amountCents),
          date: shortDate(p.date),
          usual: money(p.usualCents),
        }),
      }
    case 'recurring':
      return {
        title: tp('in.recurring.title', { note: p.note }),
        body: tp('in.recurring.body', { amount: money(p.amountCents), months: p.months }),
      }
    case 'cut_tip':
      return {
        title: tp('in.cut_tip.title', { cat }),
        body: tp('in.cut_tip.body', { avg: money(p.avgCents), yearly: money(p.yearlyCents) }),
      }
    case 'weekend':
      return { title: tp('in.weekend.title', { percent: p.percent }), body: tp('in.weekend.body') }
    case 'projection': {
      const diff = Number(p.diffPercent)
      return {
        title: tp('in.projection.title', { projected: money(p.projectedCents) }),
        body: tp(diff >= 0 ? 'in.projection.more' : 'in.projection.less', {
          percent: Math.abs(diff),
          previous: money(p.previousCents),
        }),
      }
    }
    case 'savings_rate':
      return {
        title: tp('in.savings_rate.title', { rate: p.ratePercent }),
        body: tp('in.savings_rate.body', { avg: p.avgPercent }),
      }
  }
}

export function InsightsTab({ period }: { period: string }) {
  const q = useQuery({ queryKey: ['pro', 'insights', period], queryFn: () => fetchInsights(period) })
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12.5px] text-ink-2">{tp('in.hint')}</p>
      {q.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {q.isError && <p className="text-danger">{t('common.error')}</p>}
      {q.data && q.data.items.length === 0 && (
        <p className="rounded-card border border-dashed border-line px-5 py-10 text-center text-[13px] text-ink-3">
          {tp('in.empty')}
        </p>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {q.data?.items.map((i, idx) => {
          const tone = TONE[i.tone]
          const { title, body } = copy(i)
          return (
            <li key={`${i.code}-${idx}`} className={`flex gap-3 rounded-card border p-4 ${tone.shell}`}>
              <span className={`flex size-9 flex-none items-center justify-center rounded-icon bg-surface ${tone.ink}`}>
                <tone.Icon size={18} strokeWidth={2.2} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold leading-snug">{title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{body}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
