import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './auth/AuthGuard'
import { extensionPages, extensionPublicPages } from './extension'
import { DEFAULT_LOCALE } from './i18n/locales'
import { AuthPage } from './pages/AuthPage'
import { LocaleLayout } from './pages/LocaleLayout'
import { t } from './i18n/t'

// Cada pantalla con sesión va en su propio trozo: el login (lo primero que ve
// alguien nuevo) no descarga gráficos, tablas ni el importador.
const named = <K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) =>
  lazy(() => load().then((m) => ({ default: m[key] })))
const AppLayout = named(() => import('./layout/AppLayout'), 'AppLayout')
const AccountsPage = named(() => import('./pages/AccountsPage'), 'AccountsPage')
const BudgetsPage = named(() => import('./pages/BudgetsPage'), 'BudgetsPage')
const DashboardPage = named(() => import('./pages/DashboardPage'), 'DashboardPage')
const ImportPage = named(() => import('./pages/ImportPage'), 'ImportPage')
const ProfilePage = named(() => import('./pages/ProfilePage'), 'ProfilePage')
const SubscriptionsPage = named(() => import('./pages/SubscriptionsPage'), 'SubscriptionsPage')
const TransactionsPage = named(() => import('./pages/TransactionsPage'), 'TransactionsPage')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-dvh bg-bg p-6 text-ink-2">{t('common.loading')}</div>}>
        <Routes>
          <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}`} replace />} />
          <Route path="/:locale" element={<LocaleLayout />}>
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            {extensionPublicPages.map(({ path, Page }) => (
              <Route key={path} path={path} element={<Page />} />
            ))}
            <Route element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="subscriptions" element={<SubscriptionsPage />} />
                <Route path="accounts" element={<AccountsPage />} />
                <Route path="limits" element={<BudgetsPage />} />
                <Route path="budgets" element={<Navigate to="../limits" replace />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="settings" element={<Navigate to="../profile" replace />} />
                <Route path="profile" element={<ProfilePage />} />
                {extensionPages.map(({ path, Page }) => (
                  <Route key={path} path={path} element={<Page />} />
                ))}
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}`} replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
