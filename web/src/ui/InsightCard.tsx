import { formatCents } from '@savetowin/shared/money'
import type { Insight } from '@savetowin/shared/insights'
import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { t } from '../i18n/t'

const MONTHS_SHORT = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
]

function kindStyles(kind: Insight['kind']) {
  switch (kind) {
    case 'heads_up':
      return {
        shell: 'bg-warn-weak border-[color:var(--warn-border)] text-warn',
        Icon: TriangleAlert,
        title: t('insight.headsUp'),
      }
    case 'on_track':
      return {
        shell: 'bg-savings-weak border-[color:var(--savings-border)] text-savings',
        Icon: CircleCheck,
        title: t('insight.onTrack'),
      }
    case 'over':
      return {
        shell: 'bg-danger-weak border-[color:var(--danger-border)] text-danger',
        Icon: CircleAlert,
        title: t('insight.over'),
      }
  }
}

function InsightBody({ insight }: { insight: Insight }) {
  const p = insight.params
  if (insight.code === 'budget_over') {
    return (
      <p className="text-[14.5px] font-medium leading-snug text-ink text-pretty">
        {p.categoryLabel}{' '}
        {t('insight.over.is')}{' '}
        <b>{formatCents(p.overCents ?? 0)} {t('insight.over.over')}</b>
        {' — '}
        {t('insight.over.hint')}
      </p>
    )
  }
  if (insight.code === 'budget_pace') {
    const day = p.breachDay ?? 0
    const month = MONTHS_SHORT[(p.breachMonth ?? 1) - 1] ?? ''
    return (
      <p className="text-[14.5px] font-medium leading-snug text-ink text-pretty">
        {t('insight.pace.atThisPace')}{' '}
        <b>{p.categoryLabel}</b>{' '}
        {t('insight.pace.passesOn')}{' '}
        <b>
          {day} {month}
        </b>
        .
      </p>
    )
  }
  // goal_on_track
  return (
    <p className="text-[14.5px] font-medium leading-snug text-ink text-pretty">
      {t('insight.goal.youAre')}{' '}
      <b>
        {p.daysAhead} {t('insight.goal.daysAhead')}
      </b>{' '}
      {t('insight.goal.of')} {formatCents(p.goalCents ?? 0)}.
    </p>
  )
}

/** Directions 9b / 1b — tarjeta de conclusión. Solo se monta si hay insight. */
export function InsightCard({ insight }: { insight: Insight }) {
  const { locale = DEFAULT_LOCALE } = useParams()
  const { shell, Icon, title } = kindStyles(insight.kind)
  const showCta =
    (insight.code === 'budget_over' || insight.code === 'budget_pace') &&
    (insight.params.txCount ?? 0) > 0

  return (
    <article
      className={`flex flex-col gap-2.5 rounded-card border px-5 py-[18px] ${shell}`}
    >
      <div className="flex items-center gap-2 text-xs font-bold tracking-[0.04em] uppercase">
        <Icon size={15} strokeWidth={2.4} aria-hidden />
        {title}
      </div>
      <InsightBody insight={insight} />
      {showCta && (
        <Link
          to={`/${locale}/transactions`}
          className="mt-0.5 inline-flex h-tap items-center self-start rounded-pill bg-accent px-4 text-[12.5px] font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('insight.review')} {insight.params.txCount}
        </Link>
      )}
    </article>
  )
}

export function InsightsColumn({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null
  return (
    <div className="flex flex-col gap-4">
      {insights.map((i) => (
        <InsightCard key={i.id} insight={i} />
      ))}
    </div>
  )
}
