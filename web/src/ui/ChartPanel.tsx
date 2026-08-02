import { ChartColumn } from 'lucide-react'
import type { ReactNode } from 'react'
import { t } from '../i18n/t'

/** Contenedor de gráfico Directions 11b — vacío / carga / contenido. */
export function ChartPanel({
  title,
  headerRight,
  state,
  children,
  className = '',
}: {
  title: string
  headerRight?: ReactNode
  state: 'ready' | 'empty' | 'loading' | 'error'
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={`flex flex-col rounded-card border border-line bg-surface px-6 py-5 ${className}`}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {headerRight}
      </div>

      {state === 'loading' && (
        <div
          className="flex h-[200px] items-end gap-2.5 rounded-field border border-grid px-5 pb-5 pt-[18px]"
          aria-busy
          aria-label={t('common.loading')}
        >
          {[48, 66, 38, 74, 56, 44].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-[7px] rounded-b-[3px] bg-track"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      )}

      {state === 'empty' && (
        <div className="flex h-[200px] flex-col items-center justify-center gap-3 rounded-field border border-dashed border-line px-6">
          <span className="flex h-12 w-12 items-center justify-center rounded-pill bg-surface-2 text-ink-3">
            <ChartColumn size={22} strokeWidth={1.8} aria-hidden />
          </span>
          <p className="max-w-[16rem] text-center text-[12.5px] font-semibold leading-snug text-ink-3">
            {t('dashboard.chart.empty')}
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="flex h-[200px] items-center justify-center rounded-field border border-line px-6">
          <p className="text-[12.5px] font-semibold text-warn">{t('common.error')}</p>
        </div>
      )}

      {state === 'ready' && children}
    </section>
  )
}
