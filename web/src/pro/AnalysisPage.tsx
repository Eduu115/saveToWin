import { useQuery } from '@tanstack/react-query'
import { BarChart3, ChevronLeft, ChevronRight, Gift, Lightbulb, Lock, Shapes, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { t } from '../i18n/t'
import { currentPeriod, fetchMe, monthLong, shiftPeriod } from './api'
import { ChartsTab } from './ChartsTab'
import { GroupsTab } from './GroupsTab'
import { tp } from './i18n'
import { InsightsTab } from './InsightsTab'

type Tab = 'charts' | 'groups' | 'insights'
const TABS: { id: Tab; label: string; Icon: typeof BarChart3 }[] = [
  { id: 'charts', label: tp('an.tab.charts'), Icon: BarChart3 },
  { id: 'groups', label: tp('an.tab.groups'), Icon: Shapes },
  { id: 'insights', label: tp('an.tab.insights'), Icon: Lightbulb },
]

/** Premium · Análisis: gráficos (11a), agrupaciones (6a/6c) y consejos. */
export function AnalysisPage() {
  const { locale = 'es' } = useParams()
  const me = useQuery({ queryKey: ['pro', 'me'], queryFn: fetchMe })
  const [tab, setTab] = useState<Tab>('charts')
  const [period, setPeriod] = useState(currentPeriod)
  const premium = me.data?.plan === 'premium'
  const isCurrent = period === currentPeriod()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight">{tp('an.title')}</h1>
          <p className="mt-1 text-[13px] text-ink-2">{tp('an.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/${locale}/wrapped`}
            className="inline-flex h-tap items-center gap-2 rounded-pill bg-accent px-4 text-[13px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            <Gift size={16} strokeWidth={2.2} aria-hidden />
            {tp('an.wrapped')}
          </Link>
          <Link
            to={`/${locale}/premium`}
            className="inline-flex h-tap items-center gap-2 rounded-pill border border-line bg-surface px-4 text-[13px] font-semibold focus-visible:shadow-focus focus-visible:outline-none"
          >
            <Sparkles size={15} strokeWidth={2.2} className="text-accent" aria-hidden />
            {tp('an.plan')}
          </Link>
        </div>
      </div>

      {me.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {me.isError && <p className="text-danger">{t('common.error')}</p>}

      {me.data && !premium && (
        <section className="flex flex-col items-center gap-3 rounded-card border-2 border-accent bg-surface px-6 py-12 text-center shadow-raised">
          <span className="flex size-12 items-center justify-center rounded-full bg-accent-weak text-accent">
            <Lock size={22} strokeWidth={2.2} aria-hidden />
          </span>
          <h2 className="text-[20px] font-extrabold">{tp('an.locked.title')}</h2>
          <p className="max-w-md text-[13.5px] text-ink-2">{tp('an.locked.body')}</p>
          <Link
            to={`/${locale}/premium`}
            className="mt-1 inline-flex h-tap items-center gap-2 rounded-pill bg-accent px-5 text-[13.5px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            <Sparkles size={16} strokeWidth={2.2} aria-hidden />
            {tp('an.locked.cta')}
          </Link>
        </section>
      )}

      {premium && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" className="flex w-full gap-0.5 rounded-pill bg-surface-2 p-0.5 sm:w-auto">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-pill px-3.5 text-[12.5px] focus-visible:shadow-focus focus-visible:outline-none sm:flex-none ${
                    tab === id ? 'bg-surface font-bold shadow-sm' : 'font-semibold text-ink-2'
                  }`}
                >
                  <Icon size={15} strokeWidth={2.2} aria-hidden />
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 items-center justify-between gap-0.5 rounded-pill border border-line bg-surface p-0.5 sm:ml-auto sm:flex-none">
              <button
                type="button"
                aria-label={tp('an.prev')}
                onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
                className="inline-flex size-10 items-center justify-center rounded-pill text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
              >
                <ChevronLeft size={17} strokeWidth={2.2} aria-hidden />
              </button>
              <span className="px-2.5 text-[13px] font-bold">{monthLong(period)}</span>
              <button
                type="button"
                aria-label={tp('an.next')}
                disabled={isCurrent}
                onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
                className="inline-flex size-10 items-center justify-center rounded-pill bg-surface-2 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-40"
              >
                <ChevronRight size={17} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
          </div>

          <div role="tabpanel">
            {tab === 'charts' && <ChartsTab period={period} />}
            {tab === 'groups' && <GroupsTab period={period} />}
            {tab === 'insights' && <InsightsTab period={period} />}
          </div>
        </>
      )}
    </div>
  )
}
