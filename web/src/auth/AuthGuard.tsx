import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { fetchMe } from '../api/auth'
import { ApiClientError } from '../api/client'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { t } from '../i18n/t'

export function AuthGuard() {
  const { locale = DEFAULT_LOCALE } = useParams()
  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: fetchMe,
    retry: false,
  })

  if (me.isPending) {
    return (
      <div className="min-h-dvh bg-bg p-6 text-ink-2">{t('common.loading')}</div>
    )
  }

  if (me.isError) {
    const status = me.error instanceof ApiClientError ? me.error.status : 0
    if (status === 401) {
      return <Navigate to={`/${locale}/login`} replace />
    }
    return (
      <div className="min-h-dvh bg-bg p-6 text-danger">{t('common.error')}</div>
    )
  }

  return <Outlet context={{ user: me.data.user }} />
}
