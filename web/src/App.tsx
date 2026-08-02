import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthGuard } from './auth/AuthGuard'
import { DEFAULT_LOCALE } from './i18n/locales'
import { t } from './i18n/t'
import { AppLayout } from './layout/AppLayout'
import { AuthPage } from './pages/AuthPage'
import { DashboardPage } from './pages/DashboardPage'
import { LocaleLayout } from './pages/LocaleLayout'
import { TransactionsPage } from './pages/TransactionsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 30_000,
    },
  },
})

function SimplePage({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-2">{t('placeholder.comingSoon')}</p>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}`} replace />} />
          <Route path="/:locale" element={<LocaleLayout />}>
            <Route path="login" element={<AuthPage mode="login" />} />
            <Route path="register" element={<AuthPage mode="register" />} />
            <Route element={<AuthGuard />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="budgets" element={<SimplePage title={t('budgets.title')} />} />
                <Route path="import" element={<SimplePage title={t('import.title')} />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}`} replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
