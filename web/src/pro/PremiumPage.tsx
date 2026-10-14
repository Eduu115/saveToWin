import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { BarChart3, Check, Gift, History, Lightbulb, Sparkles, Target } from 'lucide-react'
import { t } from '../i18n/t'
import { fetchMe } from './api'
import { tp } from './i18n'


function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function PremiumPage() {
  const { locale = 'es' } = useParams()
  const me = useQuery({ queryKey: ['pro', 'me'], queryFn: fetchMe })
  const data = me.data
  const premium = data?.plan === 'premium'

  const features = [
    { Icon: History, text: tp('pro.f.history', { n: data?.freeHistoryDays ?? 60 }) },
    { Icon: Target, text: tp('pro.f.groups') },
    { Icon: BarChart3, text: tp('pro.f.charts') },
    { Icon: Lightbulb, text: tp('pro.f.insights') },
    { Icon: Gift, text: tp('pro.f.wrapped') },
  ]

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-[26px] font-extrabold tracking-tight">
          <Sparkles size={22} strokeWidth={2.2} className="text-accent" aria-hidden />
          {tp('pro.title')}
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-2">{tp('pro.subtitle')}</p>
      </div>

      {me.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {me.isError && <p className="text-danger">{t('common.error')}</p>}

      {data && (
        <section
          className={`rounded-card border p-5 shadow-raised ${premium ? 'border-2 border-accent bg-surface' : 'border-line bg-surface'}`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[18px] font-extrabold">
              {premium ? tp('pro.plan.premium') : tp('pro.plan.free')}
            </span>
            {premium && (
              <span className="text-[12.5px] font-semibold text-ink-2">
                {data.validUntil
                  ? `${tp('pro.plan.until')} ${longDate(data.validUntil)}`
                  : tp('pro.plan.forever')}
              </span>
            )}
          </div>
          <p className="mt-2 text-[13px] text-ink-2">
            {premium
              ? tp('pro.history.full')
              : !data.enforced
                ? tp('pro.history.notEnforced')
                : data.historyFrom
                  ? `${tp('pro.history.limited')} ${longDate(data.historyFrom)}.`
                  : tp('pro.history.full')}
          </p>
        </section>
      )}

      <section className="rounded-card border border-line bg-surface p-5">
        <h2 className="mb-3 text-[15px] font-bold">{tp('pro.includes')}</h2>
        <ul className="flex flex-col gap-3">
          {features.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-[13.5px]">
              <span className="flex size-8 flex-none items-center justify-center rounded-icon bg-accent-weak text-accent">
                <Icon size={16} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="pt-1.5">{text}</span>
              {premium && (
                <Check size={16} strokeWidth={2.4} className="ml-auto mt-2 flex-none text-savings" aria-hidden />
              )}
            </li>
          ))}
        </ul>
        {!premium && (
          <p className="mt-4 rounded-tile bg-surface-2 px-4 py-3 text-[13px] font-semibold text-ink-2">
            {tp('pro.cta.soon')}
          </p>
        )}
        {premium && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to={`/${locale}/analysis`}
              className="inline-flex h-tap items-center gap-2 rounded-pill bg-accent px-4 text-[13px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none"
            >
              <BarChart3 size={16} strokeWidth={2.2} aria-hidden />
              {tp('pro.open.analysis')}
            </Link>
            <Link
              to={`/${locale}/wrapped`}
              className="inline-flex h-tap items-center gap-2 rounded-pill border border-line bg-surface px-4 text-[13px] font-semibold focus-visible:shadow-focus focus-visible:outline-none"
            >
              <Gift size={16} strokeWidth={2.2} aria-hidden />
              {tp('pro.open.wrapped')}
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
