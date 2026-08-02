import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, LayoutDashboard, LogOut, Moon, Sun, Target, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { logout } from '../api/auth'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { t } from '../i18n/t'

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
      className="inline-flex h-tap w-tap items-center justify-center rounded-pill bg-surface-2 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
    >
      {theme === 'dark' ? <Sun size={17} strokeWidth={2} aria-hidden /> : <Moon size={17} strokeWidth={2} aria-hidden />}
    </button>
  )
}

const nav = [
  { to: 'dashboard', label: 'nav.dashboard' as const, Icon: LayoutDashboard },
  { to: 'transactions', label: 'nav.transactions' as const, Icon: ArrowLeftRight },
  { to: 'budgets', label: 'nav.budgets' as const, Icon: Target },
  { to: 'import', label: 'nav.import' as const, Icon: Upload },
]

export function AppLayout() {
  const { locale = DEFAULT_LOCALE } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: async () => {
      await qc.clear()
      navigate(`/${locale}/login`, { replace: true })
    },
  })

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex h-tap items-center gap-2 rounded-pill px-4 text-sm font-medium focus-visible:shadow-focus focus-visible:outline-none ${
      isActive ? 'bg-accent text-accent-fg' : 'text-ink-2 hover:bg-surface-2'
    }`

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-2 text-lg font-extrabold tracking-tight">{t('app.name')}</span>
            <nav className="flex flex-wrap gap-1" aria-label="Principal">
              {nav.map(({ to, label, Icon }) => (
                <NavLink key={to} to={`/${locale}/${to}`} className={linkClass}>
                  <Icon size={15} strokeWidth={2} aria-hidden />
                  {t(label)}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => logoutMutation.mutate()}
              className="inline-flex h-tap items-center gap-2 rounded-pill bg-surface-2 px-4 text-sm font-medium text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
            >
              <LogOut size={15} strokeWidth={2} aria-hidden />
              {t('nav.logout')}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}
