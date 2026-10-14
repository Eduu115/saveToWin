import { formatCents } from '@savetowin/shared/money'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Download, Lock, Share2, Sparkles, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { t } from '../i18n/t'
import { fetchWrapped, monthLong, type Wrapped, type WrappedCover } from './api'
import { tp, WEEKDAYS } from './i18n'

type Slide = { id: string; bg: string; body: ReactNode }

/** Tonos de cada historia: solo tokens (accent / ink / savings / income / surface). */
const BG = {
  accent: 'bg-accent text-accent-fg',
  ink: 'bg-ink text-bg',
  savings: 'bg-savings text-bg',
  income: 'bg-income text-bg',
  surface: 'bg-surface text-ink',
}

function Big({ children }: { children: ReactNode }) {
  return <p className="text-[clamp(40px,11vw,72px)] font-extrabold leading-[1.02] tracking-tight tabular-nums">{children}</p>
}
function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-[13px] font-bold uppercase tracking-[0.12em] opacity-75">{children}</p>
}
function Line({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-4 border-b py-3"
      style={{ borderColor: 'color-mix(in srgb, currentColor 20%, transparent)' }}
    >
      <span className="text-[15px] font-semibold opacity-80">{label}</span>
      <span className="text-[22px] font-extrabold tabular-nums">{value}</span>
    </div>
  )
}

/** Imagen 1080×1350 para compartir, dibujada con canvas (sin dependencias). */
async function renderShareImage(cover: WrappedCover, topCategory: string | null): Promise<Blob> {
  await document.fonts.ready
  const css = getComputedStyle(document.documentElement)
  const accent = css.getPropertyValue('--accent').trim() || 'rgb(168,71,28)'
  const onAccent = css.getPropertyValue('--on-accent').trim() || 'rgb(255,255,255)'
  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1350
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, 1080, 1350)
  ctx.fillStyle = onAccent
  const font = (w: number, px: number) => `${w} ${px}px "Public Sans", system-ui, sans-serif`
  ctx.font = font(700, 44)
  ctx.fillText(tp('wr.image.title', { year: cover.year }), 96, 190)
  // El importe cabe siempre en el ancho útil (888 px): se reduce si es largo.
  const kept = formatCents(cover.keptCents)
  let size = 150
  ctx.font = font(800, size)
  while (ctx.measureText(kept).width > 888 && size > 60) ctx.font = font(800, (size -= 6))
  ctx.fillText(kept, 96, 560)
  ctx.font = font(600, 46)
  ctx.globalAlpha = 0.8
  ctx.fillText(tp('wr.image.kept'), 96, 640)
  ctx.globalAlpha = 1
  ctx.font = font(700, 52)
  let y = 860
  if (cover.savingsRatePercent != null) {
    ctx.fillText(tp('wr.image.rate', { rate: cover.savingsRatePercent }), 96, y)
    y += 90
  }
  ctx.fillText(tp('wr.cover.movements', { n: cover.movements }), 96, y)
  y += 90
  if (topCategory) ctx.fillText(tp('wr.image.top', { cat: topCategory }), 96, y)
  ctx.font = font(600, 34)
  ctx.globalAlpha = 0.75
  ctx.fillText(tp('wr.image.footer'), 96, 1250)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'))
}

function ShareSlide({ cover, topCategory }: { cover: WrappedCover; topCategory: string | null }) {
  const [busy, setBusy] = useState(false)
  const fileName = `savetowin-wrapped-${cover.year}.png`
  const canShareFiles =
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], fileName, { type: 'image/png' })] })

  async function run(mode: 'share' | 'download') {
    setBusy(true)
    try {
      const blob = await renderShareImage(cover, topCategory)
      if (mode === 'share') {
        try {
          await navigator.share({
            files: [new File([blob], fileName, { type: 'image/png' })],
            title: tp('wr.image.title', { year: cover.year }),
          })
          return
        } catch (err) {
          // Cancelar el diálogo no es un error; cualquier otro fallo → descarga.
          if (err instanceof DOMException && err.name === 'AbortError') return
        }
      }
      const url = URL.createObjectURL(blob)
      Object.assign(document.createElement('a'), { href: url, download: fileName }).click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally {
      setBusy(false)
    }
  }

  const btn =
    'inline-flex h-14 items-center justify-center gap-2 rounded-pill px-6 text-[15px] font-bold focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60'
  return (
    <div className="flex flex-col gap-5">
      <Kicker>{tp('wr.share.title')}</Kicker>
      <Big>{formatCents(cover.keptCents)}</Big>
      <p className="text-[16px] opacity-80">{tp('wr.share.body')}</p>
      <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
        {canShareFiles && (
          <button type="button" disabled={busy} onClick={() => void run('share')} className={`${btn} bg-accent text-accent-fg shadow-accent`}>
            <Share2 size={18} strokeWidth={2.2} aria-hidden />
            {tp('wr.share.cta')}
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => void run('download')}
          className={`${btn} ${canShareFiles ? 'border border-line bg-surface text-ink' : 'bg-accent text-accent-fg shadow-accent'}`}
        >
          <Download size={18} strokeWidth={2.2} aria-hidden />
          {tp('wr.share.download')}
        </button>
      </div>
    </div>
  )
}

function slidesFor(data: { premium: true; wrapped: Wrapped } | { premium: false; cover: WrappedCover }, locale: string): Slide[] {
  const cover = data.premium ? data.wrapped : data.cover
  const coverSlide: Slide = {
    id: 'cover',
    bg: BG.accent,
    body: (
      <div className="flex flex-col gap-4">
        <Kicker>{tp('wr.cover.kicker', { year: cover.year })}</Kicker>
        <Big>{formatCents(cover.keptCents)}</Big>
        <p className="text-[20px] font-semibold opacity-85">{tp('wr.cover.kept')}</p>
        <span
          className="mt-2 self-start rounded-pill px-4 py-2 text-[14px] font-bold"
          style={{ background: 'color-mix(in srgb, currentColor 15%, transparent)' }}
        >
          {tp('wr.cover.movements', { n: cover.movements })}
        </span>
      </div>
    ),
  }

  if (!data.premium) {
    return [
      coverSlide,
      {
        id: 'locked',
        bg: BG.surface,
        body: (
          <div className="flex flex-col gap-4">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent-weak text-accent">
              <Lock size={22} strokeWidth={2.2} aria-hidden />
            </span>
            <p className="text-[30px] font-extrabold leading-tight">{tp('wr.locked.title')}</p>
            <p className="text-[16px] text-ink-2">{tp('wr.locked.body')}</p>
            <Link
              to={`/${locale}/premium`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-tap items-center gap-2 self-start rounded-pill bg-accent px-5 font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
            >
              <Sparkles size={16} strokeWidth={2.2} aria-hidden />
              {tp('an.locked.cta')}
            </Link>
          </div>
        ),
      },
      { id: 'share', bg: BG.surface, body: <ShareSlide cover={cover} topCategory={null} /> },
    ]
  }

  const w = data.wrapped
  const slides: Slide[] = [
    coverSlide,
    {
      id: 'money',
      bg: BG.ink,
      body: (
        <div className="flex flex-col gap-2">
          <Kicker>{tp('wr.money.title')}</Kicker>
          <Line label={tp('wr.money.in')} value={formatCents(w.incomeCents)} />
          <Line label={tp('wr.money.out')} value={formatCents(w.expenseCents)} />
          {w.savingsRatePercent != null && (
            <p className="mt-4 text-[26px] font-extrabold leading-tight">{tp('wr.money.rate', { rate: w.savingsRatePercent })}</p>
          )}
        </div>
      ),
    },
  ]
  if (w.topCategories.length > 0) {
    slides.push({
      id: 'top',
      bg: BG.surface,
      body: (
        <div className="flex flex-col gap-5">
          <Kicker>{tp('wr.top.title')}</Kicker>
          {w.topCategories.map((c, i) => (
            <div key={c.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[22px] font-extrabold">
                  {i + 1}. {c.label}
                </span>
                <span className="text-[16px] font-bold tabular-nums text-ink-2">{formatCents(c.cents)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-pill bg-track">
                <div className="h-full rounded-pill bg-accent" style={{ width: `${Math.max(4, c.percent)}%` }} />
              </div>
              <span className="text-[13px] font-semibold text-ink-2">{c.percent} %</span>
            </div>
          ))}
        </div>
      ),
    })
  }
  if (w.biggestMonth || w.bestSavingsMonth) {
    slides.push({
      id: 'months',
      bg: BG.savings,
      body: (
        <div className="flex flex-col gap-6">
          <Kicker>{tp('wr.months.title')}</Kicker>
          {w.bestSavingsMonth && (
            <div>
              <p className="text-[15px] font-semibold opacity-80">{tp('wr.months.best')}</p>
              <p className="text-[34px] font-extrabold">{monthLong(w.bestSavingsMonth.period)}</p>
              <p className="text-[18px] font-bold tabular-nums">+ {formatCents(w.bestSavingsMonth.cents)}</p>
            </div>
          )}
          {w.biggestMonth && (
            <div>
              <p className="text-[15px] font-semibold opacity-80">{tp('wr.months.biggest')}</p>
              <p className="text-[34px] font-extrabold">{monthLong(w.biggestMonth.period)}</p>
              <p className="text-[18px] font-bold tabular-nums">− {formatCents(w.biggestMonth.cents)}</p>
            </div>
          )}
        </div>
      ),
    })
  }
  if (w.favoritePlace || w.biggestExpense) {
    slides.push({
      id: 'place',
      bg: BG.accent,
      body: (
        <div className="flex flex-col gap-6">
          {w.favoritePlace && (
            <div>
              <Kicker>{tp('wr.place.title')}</Kicker>
              <p className="mt-2 text-[40px] font-extrabold leading-tight">{w.favoritePlace.note}</p>
              <p className="text-[18px] font-bold opacity-85">
                {tp('wr.place.visits', { n: w.favoritePlace.visits, amount: formatCents(w.favoritePlace.cents) })}
              </p>
            </div>
          )}
          {w.biggestExpense && (
            <div>
              <p className="text-[15px] font-semibold opacity-80">{tp('wr.place.biggest')}</p>
              <p className="text-[30px] font-extrabold tabular-nums">{formatCents(w.biggestExpense.cents)}</p>
              <p className="text-[15px] font-semibold opacity-85">
                {w.biggestExpense.note || w.biggestExpense.categoryLabel} ·{' '}
                {new Date(`${w.biggestExpense.date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
              </p>
            </div>
          )}
        </div>
      ),
    })
  }
  slides.push({
    id: 'days',
    bg: BG.ink,
    body: (
      <div className="flex flex-col gap-6">
        <Kicker>{tp('wr.days.title')}</Kicker>
        {w.favoriteWeekday && (
          <div>
            <p className="text-[15px] font-semibold opacity-80">{tp('wr.days.weekday')}</p>
            <p className="text-[40px] font-extrabold capitalize">{WEEKDAYS[w.favoriteWeekday.weekday]}</p>
          </div>
        )}
        <div>
          <p className="text-[15px] font-semibold opacity-80">{tp('wr.days.streak')}</p>
          <p className="text-[40px] font-extrabold">{tp('wr.days.streakN', { n: w.longestNoSpendStreak })}</p>
        </div>
      </div>
    ),
  })
  slides.push({
    id: 'persona',
    bg: BG.savings,
    body: (
      <div className="flex flex-col gap-4">
        <Kicker>{tp('wr.persona.title')}</Kicker>
        <p className="text-[clamp(36px,10vw,60px)] font-extrabold leading-[1.05]">{tp(`wr.persona.${w.persona}`)}</p>
        {w.savedToAccountCents > 0 && (
          <p className="text-[18px] font-bold opacity-85">{tp('wr.persona.saved', { amount: formatCents(w.savedToAccountCents) })}</p>
        )}
      </div>
    ),
  })
  slides.push({ id: 'share', bg: BG.surface, body: <ShareSlide cover={w} topCategory={w.topCategories[0]?.label ?? null} /> })
  return slides
}

/** Premium · Wrapped: el resumen del año en historias. La portada es gratis. */
export function WrappedPage() {
  const { locale = 'es' } = useParams()
  const navigate = useNavigate()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [index, setIndex] = useState(0)
  const q = useQuery({ queryKey: ['pro', 'wrapped', year], queryFn: () => fetchWrapped(year) })

  const slides = q.data ? slidesFor(q.data, locale) : []
  const close = useCallback(() => navigate(`/${locale}/analysis`), [navigate, locale])
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(slides.length - 1, i + d))), [slides.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [close, go])

  const slide = slides[index]
  const cover = q.data ? (q.data.premium ? q.data.wrapped : q.data.cover) : null
  const empty = cover != null && cover.movements === 0

  return (
    <div className={`fade-in fixed inset-0 z-[60] flex flex-col ${slide && !empty ? slide.bg : BG.surface}`}>
      <div className="mx-auto flex w-full max-w-lg flex-none flex-col gap-3 px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex gap-1" aria-hidden>
          {slides.map((s, i) => (
            <span key={s.id} className={`h-1 flex-1 rounded-pill ${i <= index ? 'bg-current' : 'bg-current opacity-25'}`} />
          ))}
        </div>
        <div className="flex items-center justify-between">
          {q.data && q.data.years.length > 1 ? (
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value))
                setIndex(0)
              }}
              className="h-10 rounded-pill bg-transparent px-2 text-[14px] font-bold focus-visible:shadow-focus focus-visible:outline-none"
            >
              {q.data.years.map((y) => (
                <option key={y} value={y} className="text-ink">
                  {y}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[14px] font-bold">{year}</span>
          )}
          <button
            type="button"
            aria-label={tp('wr.close')}
            onClick={close}
            className="inline-flex size-tap items-center justify-center rounded-full focus-visible:shadow-focus focus-visible:outline-none"
          >
            <X size={22} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      </div>

      <div
        className="mx-auto flex w-full max-w-lg flex-1 cursor-pointer select-none items-center px-6 pb-10"
        onClick={(e) => {
          const third = e.currentTarget.getBoundingClientRect().width / 3
          go(e.clientX - e.currentTarget.getBoundingClientRect().left < third ? -1 : 1)
        }}
      >
        {q.isPending && <p>{t('common.loading')}</p>}
        {q.isError && <p className="text-danger">{t('common.error')}</p>}
        {empty && <p className="text-[18px] font-semibold">{tp('wr.empty', { year })}</p>}
        {slide && !empty && (
          <div key={slide.id} className="sheet-in w-full">
            {slide.body}
          </div>
        )}
      </div>

      {slides.length > 1 && !empty && (
        <div className="mx-auto flex w-full max-w-lg flex-none justify-between px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <button type="button" aria-label={tp('wr.prev')} disabled={index === 0} onClick={() => go(-1)} className="inline-flex size-tap items-center justify-center rounded-full disabled:opacity-30 focus-visible:shadow-focus focus-visible:outline-none">
            <ChevronLeft size={24} strokeWidth={2.2} aria-hidden />
          </button>
          <button type="button" aria-label={tp('wr.next')} disabled={index === slides.length - 1} onClick={() => go(1)} className="inline-flex size-tap items-center justify-center rounded-full disabled:opacity-30 focus-visible:shadow-focus focus-visible:outline-none">
            <ChevronRight size={24} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
