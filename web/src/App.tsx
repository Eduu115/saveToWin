import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DEFAULT_LOCALE } from './i18n/locales'
import { LocaleLayout } from './pages/LocaleLayout'
import { PlaceholderPage } from './pages/PlaceholderPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${DEFAULT_LOCALE}`} replace />} />
        <Route path="/:locale" element={<LocaleLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<PlaceholderPage titleKey="dashboard.title" />} />
          <Route path="transactions" element={<PlaceholderPage titleKey="transactions.title" />} />
          <Route path="budgets" element={<PlaceholderPage titleKey="budgets.title" />} />
          <Route path="import" element={<PlaceholderPage titleKey="import.title" />} />
          <Route path="login" element={<PlaceholderPage titleKey="auth.login" />} />
          <Route path="register" element={<PlaceholderPage titleKey="auth.register" />} />
        </Route>
        <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}`} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
