import { t } from '../i18n/t'

export function PlaceholderPage({
  titleKey,
}: {
  titleKey: 'dashboard.title' | 'transactions.title' | 'budgets.title' | 'import.title' | 'auth.login' | 'auth.register'
}) {
  return (
    <div className="min-h-dvh bg-bg p-6 text-ink">
      <h1 className="text-2xl font-extrabold tracking-tight">{t(titleKey)}</h1>
      <p className="mt-2 text-ink-2">{t('placeholder.comingSoon')}</p>
    </div>
  )
}
