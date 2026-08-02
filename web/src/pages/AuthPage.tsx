import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { login, register } from '../api/auth'
import { ApiClientError } from '../api/client'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { t } from '../i18n/t'

type Mode = 'login' | 'register'

export function AuthPage({ mode }: { mode: Mode }) {
  const { locale = DEFAULT_LOCALE } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'login'
        ? login({ email, password })
        : register({ email, password, name: name || undefined }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      navigate(`/${locale}/dashboard`, { replace: true })
    },
    onError: (err) => {
      setError(
        err instanceof ApiClientError
          ? err.body?.error.message ?? t('auth.error')
          : t('auth.error'),
      )
    },
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  const fieldClass =
    'h-field w-full rounded-field border border-line bg-surface px-4 text-ink focus-visible:shadow-focus focus-visible:outline-none'
  const labelClass = 'mb-1 block text-sm font-medium text-ink-2'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-6 text-ink">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-card bg-surface p-6 shadow-raised"
      >
        <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{t('app.name')}</h1>
        <p className="mb-6 text-ink-2">
          {mode === 'login' ? t('auth.login') : t('auth.register')}
        </p>

        {mode === 'register' && (
          <label className="mb-4 block">
            <span className={labelClass}>{t('auth.name')}</span>
            <input
              className={fieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}

        <label className="mb-4 block">
          <span className={labelClass}>{t('auth.email')}</span>
          <input
            className={fieldClass}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="mb-4 block">
          <span className={labelClass}>{t('auth.password')}</span>
          <input
            className={fieldClass}
            type="password"
            required
            minLength={mode === 'register' ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && <p className="mb-4 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex h-tap w-full items-center justify-center rounded-pill bg-accent font-semibold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60"
        >
          {mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')}
        </button>

        <p className="mt-4 text-center text-sm text-ink-2">
          {mode === 'login' ? (
            <>
              {t('auth.noAccount')}{' '}
              <Link className="font-semibold text-accent" to={`/${locale}/register`}>
                {t('auth.register')}
              </Link>
            </>
          ) : (
            <>
              {t('auth.hasAccount')}{' '}
              <Link className="font-semibold text-accent" to={`/${locale}/login`}>
                {t('auth.login')}
              </Link>
            </>
          )}
        </p>
      </form>
    </div>
  )
}
