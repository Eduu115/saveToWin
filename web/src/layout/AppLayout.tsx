import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  LogOut,
  Moon,
  ShieldCheck,
  UserRound,
  MoreHorizontal,
  Plus,
  Settings,
  Sun,
  Target,
  Upload,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { logout } from '../api/auth'
import { fetchProfile } from '../api/profile'
import { fetchStats } from '../api/stats'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { extensionPages } from '../extension'
import { t } from '../i18n/t'
import { BrandMark } from '../ui/BrandMark'
import { GubiaCredit } from '../ui/GubiaCredit'
import { setFaviconPercent } from '../ui/ProgressRing'

type Theme = 'light' | 'dark'

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() =>
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light',
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      onClick={() => setTheme(next)}
      className="inline-flex size-tap min-h-tap min-w-tap shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
    >
      {theme === 'dark' ? <Sun size={17} strokeWidth={2} aria-hidden /> : <Moon size={17} strokeWidth={2} aria-hidden />}
    </button>
  )
}

const nav = [
  { to: 'dashboard', label: t('nav.dashboard'), Icon: LayoutDashboard },
  { to: 'transactions', label: t('nav.transactions'), Icon: ArrowLeftRight },
  { to: 'accounts', label: t('nav.accounts'), Icon: Landmark },
  { to: 'limits', label: t('nav.limits'), Icon: Target },
  // Pantallas de la extensión opcional (vacío si no hay)
  ...extensionPages
    .filter((p) => p.nav !== false)
    .map(({ path, label, Icon }) => ({ to: path, label, Icon })),
  { to: 'import', label: t('nav.import'), Icon: Upload },
  { to: 'settings', label: t('nav.settings'), Icon: Settings },
]

/** Directions 2a — barra inferior móvil: 2 + FAB + 2; el resto vive en «Más». */
const mobileMain = nav.filter((n) => ['dashboard', 'transactions', 'limits'].includes(n.to))
const mobileMore = nav.filter((n) => !mobileMain.includes(n))

/**
 * Recordatorio de 2FA: solo si no está activa, con la cuenta de ≥3 días (no
 * agobiar al recién llegado), nunca dentro del perfil y, tras «Ahora no», no
 * vuelve hasta dentro de 3 semanas (por dispositivo).
 */
const NAG_KEY = 'stw.2fa-nag'
const DAY_MS = 24 * 60 * 60 * 1000
const NAG_EVERY_MS = 21 * DAY_MS
const NAG_MIN_ACCOUNT_AGE_MS = 3 * DAY_MS

function TwoFactorNag({ locale }: { locale: string }) {
  const { pathname } = useLocation()
  const profile = useQuery({ queryKey: ['profile'], queryFn: fetchProfile, staleTime: 5 * 60_000 })
  const [hidden, setHidden] = useState(() => {
    try {
      return Date.now() - Number(localStorage.getItem(NAG_KEY) ?? 0) < NAG_EVERY_MS
    } catch {
      return false
    }
  })
  const p = profile.data
  const youngAccount = p != null && Date.now() - new Date(`${p.createdAt.slice(0, 10)}T00:00:00`).getTime() < NAG_MIN_ACCOUNT_AGE_MS
  if (hidden || !p || p.twoFactorEnabled || youngAccount || pathname.endsWith('/profile')) return null
  const dismiss = () => {
    try {
      localStorage.setItem(NAG_KEY, String(Date.now()))
    } catch {
      // sin almacenamiento: se oculta solo en esta visita
    }
    setHidden(true)
  }
  return (
    <div role="status" className="mb-4 flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-raised sm:flex-row sm:items-center">
      <span className="flex size-10 flex-none items-center justify-center rounded-tile bg-warn-weak text-warn">
        <ShieldCheck size={20} strokeWidth={2.2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold">{t('nag.2fa.title')}</p>
        <p className="text-[12.5px] text-ink-2">{t('nag.2fa.body')}</p>
      </div>
      <div className="flex gap-2">
        <NavLink
          to={`/${locale}/profile#two-factor`}
          onClick={dismiss}
          className="inline-flex h-tap items-center rounded-pill bg-accent px-4 text-[13px] font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('nag.2fa.cta')}
        </NavLink>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-[13px] font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('nag.2fa.later')}
        </button>
      </div>
    </div>
  )
}

function currentPeriod(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function AppLayout() {
  const { locale = DEFAULT_LOCALE } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const period = currentPeriod()

  const { data: stats } = useQuery({
    queryKey: ['stats', period],
    queryFn: () => fetchStats(period),
  })
  const goalPercent = stats?.goalProgressPercent ?? 0

  useEffect(() => {
    setFaviconPercent(goalPercent)
  }, [goalPercent])

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: async () => {
      setFaviconPercent(70)
      await qc.clear()
      navigate(`/${locale}/login`, { replace: true })
    },
  })

  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => setMoreOpen(false), [pathname])
  const moreActive = mobileMore.some((n) => pathname.includes(`/${n.to}`))

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-tap flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold focus-visible:shadow-focus focus-visible:outline-none ${
      isActive ? 'text-accent' : 'text-ink-2'
    }`

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex h-tap items-center gap-2 rounded-pill px-4 text-sm font-medium focus-visible:shadow-focus focus-visible:outline-none ${
      isActive ? 'bg-accent text-accent-fg' : 'text-ink-2 hover:bg-surface-2'
    }`

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-2 flex items-center gap-2.5">
              <BrandMark percent={goalPercent} size={24} />
              <span className="text-base font-bold tracking-tight">{t('app.name')}</span>
            </div>
            <nav className="hidden flex-wrap gap-1 md:flex" aria-label="Principal">
              {nav.map(({ to, label, Icon }) => (
                <NavLink key={to} to={`/${locale}/${to}`} className={linkClass}>
                  <Icon size={15} strokeWidth={2} aria-hidden />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <NavLink
              to={`/${locale}/profile`}
              aria-label={t('nav.profile')}
              title={t('nav.profile')}
              className={({ isActive }) =>
                `inline-flex size-tap shrink-0 items-center justify-center rounded-full focus-visible:shadow-focus focus-visible:outline-none ${
                  isActive ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-ink-2'
                }`
              }
            >
              <UserRound size={18} strokeWidth={2} aria-hidden />
            </NavLink>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              className="hidden h-tap items-center gap-2 rounded-pill bg-surface-2 px-4 text-sm font-medium text-ink-2 focus-visible:shadow-focus focus-visible:outline-none md:inline-flex"
            >
              <LogOut size={15} strokeWidth={2} aria-hidden />
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 pb-32 md:p-6 lg:py-5">
        <TwoFactorNag locale={locale} />
        <Outlet />
      </main>

      {/* Directions 2a — barra inferior con FAB (solo móvil) */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="relative mx-auto flex h-16 max-w-md items-stretch px-2">
          {mobileMain.slice(0, 2).map(({ to, label, Icon }) => (
            <NavLink key={to} to={`/${locale}/${to}`} className={tabClass}>
              <Icon size={21} strokeWidth={2} aria-hidden />
              {label}
            </NavLink>
          ))}
          <div className="flex-1" aria-hidden />
          <button
            type="button"
            aria-label={t('transactions.new')}
            onClick={() => navigate(`/${locale}/transactions?new=1`)}
            className="absolute left-1/2 top-0 inline-flex size-[60px] -translate-x-1/2 -translate-y-1/3 items-center justify-center rounded-full bg-accent text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            <Plus size={28} strokeWidth={2.4} aria-hidden />
          </button>
          {mobileMain.slice(2).map(({ to, label, Icon }) => (
            <NavLink key={to} to={`/${locale}/${to}`} className={tabClass}>
              <Icon size={21} strokeWidth={2} aria-hidden />
              {label}
            </NavLink>
          ))}
          <button
            type="button"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            className={tabClass({ isActive: moreActive || moreOpen })}
          >
            <MoreHorizontal size={21} strokeWidth={2} aria-hidden />
            {t('nav.more')}
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="sheet-in absolute inset-x-0 bottom-0 rounded-t-sheet bg-surface px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 shadow-raised"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-pill bg-line" aria-hidden />
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[15px] font-bold">{t('nav.more')}</span>
              <button
                type="button"
                aria-label={t('transactions.close')}
                onClick={() => setMoreOpen(false)}
                className="inline-flex size-tap items-center justify-center rounded-full bg-surface-2 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
              >
                <X size={18} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {mobileMore.map(({ to, label, Icon }) => (
                <li key={to}>
                  <NavLink
                    to={`/${locale}/${to}`}
                    className={({ isActive }) =>
                      `flex min-h-[52px] items-center gap-3 rounded-tile px-3 font-semibold focus-visible:shadow-focus focus-visible:outline-none ${
                        isActive ? 'bg-accent-weak text-accent' : 'hover:bg-surface-2'
                      }`
                    }
                  >
                    <Icon size={19} strokeWidth={2} aria-hidden />
                    {label}
                  </NavLink>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => logoutMutation.mutate()}
                  className="flex min-h-[52px] w-full items-center gap-3 rounded-tile px-3 font-semibold text-ink-2 hover:bg-surface-2 focus-visible:shadow-focus focus-visible:outline-none"
                >
                  <LogOut size={19} strokeWidth={2} aria-hidden />
                  {t('nav.logout')}
                </button>
              </li>
            </ul>
            <div className="mt-3 border-t border-line px-3 pt-2">
              <GubiaCredit variant="inline" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
