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
          <Route path="dashboard" element={<PlaceholderPage title="dashboard" />} />
          <Route path="transactions" element={<PlaceholderPage title="transactions" />} />
          <Route path="budgets" element={<PlaceholderPage title="budgets" />} />
          <Route path="import" element={<PlaceholderPage title="import" />} />
          <Route path="login" element={<PlaceholderPage title="login" />} />
          <Route path="register" element={<PlaceholderPage title="register" />} />
        </Route>
        <Route path="*" element={<Navigate to={`/${DEFAULT_LOCALE}`} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
