import { Navigate, Outlet, useParams } from 'react-router-dom'
import { DEFAULT_LOCALE, isLocale } from '../i18n/locales'

export function LocaleLayout() {
  const { locale } = useParams()
  if (!locale || !isLocale(locale)) {
    return <Navigate to={`/${DEFAULT_LOCALE}`} replace />
  }
  return <Outlet />
}
