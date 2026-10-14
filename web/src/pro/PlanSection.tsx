import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Sparkles } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { fetchMe } from './api'
import { tp } from './i18n'

/** «Tu plan» dentro del perfil (vía `profileSections` del núcleo). */
export function PlanSection() {
  const { locale = 'es' } = useParams()
  const me = useQuery({ queryKey: ['pro', 'me'], queryFn: fetchMe })
  const data = me.data
  if (!data) return null
  const premium = data.plan === 'premium'
  const until = data.validUntil
    ? new Date(`${data.validUntil}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-raised">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
          <span className="flex size-8 items-center justify-center rounded-icon bg-accent-weak text-accent">
            <Sparkles size={16} strokeWidth={2.2} aria-hidden />
          </span>
          {tp('an.plan')}
        </h2>
        <span
          className={`rounded-pill px-2.5 py-1 text-[11px] font-bold ${premium ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-ink-2'}`}
        >
          {premium ? tp('pro.plan.premium') : tp('pro.plan.free')}
        </span>
      </div>
      <p className="text-[13px] text-ink-2">
        {premium
          ? until
            ? `${tp('pro.plan.premium')} ${tp('pro.plan.until')} ${until}.`
            : `${tp('pro.plan.premium')} · ${tp('pro.plan.forever')}.`
          : tp('an.locked.body')}
      </p>
      <Link
        to={`/${locale}/premium`}
        className="mt-3 inline-flex min-h-tap items-center gap-1 text-[13.5px] font-semibold text-accent focus-visible:shadow-focus focus-visible:outline-none"
      >
        {premium ? tp('pro.plan.manage') : tp('an.locked.cta')}
        <ChevronRight size={16} strokeWidth={2.2} aria-hidden />
      </Link>
    </section>
  )
}
