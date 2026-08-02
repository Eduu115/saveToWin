import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CircleAlert, Eye, EyeOff, Lock, Server } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { login, register } from '../api/auth'
import { ApiClientError } from '../api/client'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { t } from '../i18n/t'
import { BrandMark } from '../ui/BrandMark'

type Mode = 'login' | 'register'

export function AuthPage({ mode }: { mode: Mode }) {
  const { locale = DEFAULT_LOCALE } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

  const fieldShell = error
    ? 'flex h-[60px] items-center gap-3 rounded-field border-2 border-danger bg-surface px-4'
    : 'flex h-[60px] items-center gap-3 rounded-field border-2 border-accent bg-surface px-4 focus-within:shadow-focus'

  const brandPanel = (
    <div className="flex flex-col justify-between bg-accent px-6 pb-8 pt-8 text-accent-fg md:w-[min(100%,620px)] md:flex-none md:px-14 md:py-14">
      <div className="flex items-center gap-3">
        <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-accent-fg text-accent md:h-[30px]">
          <BrandMark size={22} />
        </span>
        <span className="text-[17px] font-bold tracking-tight md:text-[19px]">{t('app.name')}</span>
      </div>

      <div className="mt-8 flex flex-col gap-4 md:mt-0 md:gap-[22px]">
        <h2 className="max-w-[26rem] text-[30px] font-extrabold leading-[1.12] tracking-tight md:text-[46px] md:leading-[1.08]">
          <span className="md:hidden">{t('auth.slogan.mobile')}</span>
          <span className="hidden md:inline">
            {t('auth.slogan.line1')}
            <br />
            {t('auth.slogan.line2')}
            <br />
            {t('auth.slogan.line3')}
          </span>
        </h2>
        <p className="hidden max-w-[420px] text-base leading-relaxed text-accent-fg/80 md:block">
          {t('auth.slogan.body')}
        </p>
      </div>

      <div className="mt-10 hidden gap-7 md:mt-0 md:flex">
        <div className="flex flex-col gap-1">
          <span className="text-[26px] font-extrabold tabular-nums tracking-tight">
            {t('auth.brand.stat1.value')}
          </span>
          <span className="text-xs font-medium text-accent-fg/65">
            {t('auth.brand.stat1.label')}
          </span>
        </div>
        <div className="w-px bg-accent-fg/20" />
        <div className="flex flex-col gap-1">
          <span className="text-[26px] font-extrabold tabular-nums tracking-tight">
            {t('auth.brand.stat2.value')}
          </span>
          <span className="text-xs font-medium text-accent-fg/65">
            {t('auth.brand.stat2.label')}
          </span>
        </div>
      </div>
    </div>
  )

  const formPanel = (
    <div className="flex flex-1 items-center justify-center bg-bg px-5 py-8 md:px-20">
      <form
        onSubmit={onSubmit}
        className="flex w-full max-w-[420px] flex-col gap-6 md:gap-[26px]"
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-[26px] font-extrabold tracking-tight md:text-[32px]">
            {mode === 'login' ? t('auth.welcomeBack') : t('auth.createTitle')}
          </h1>
          <p className="text-[13.5px] leading-relaxed text-ink-2 md:text-[14.5px]">
            {mode === 'login' ? t('auth.welcomeHint') : t('auth.createHint')}
          </p>
        </div>

        {mode === 'register' && (
          <label className="flex flex-col gap-2">
            <span className="text-[12.5px] font-semibold text-ink-2">{t('auth.name')}</span>
            <input
              className="h-[60px] rounded-field border border-line bg-surface px-4 text-ink focus-visible:border-accent focus-visible:shadow-focus focus-visible:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}

        <label className="flex flex-col gap-2">
          <span
            className={`text-[12.5px] font-semibold ${error ? 'text-danger' : 'text-ink-2'}`}
          >
            {t('auth.email')}
          </span>
          <input
            className={`h-[60px] rounded-field border-2 bg-surface px-4 text-ink focus-visible:shadow-focus focus-visible:outline-none ${
              error ? 'border-danger' : 'border-accent'
            }`}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span
            className={`text-[12.5px] font-semibold ${error ? 'text-danger' : 'text-ink-2'}`}
          >
            {t('auth.password')}
          </span>
          <div className={fieldShell}>
            <Lock
              size={19}
              strokeWidth={2.2}
              className={error ? 'text-danger' : 'text-accent'}
              aria-hidden
            />
            <input
              className="min-w-0 flex-1 bg-transparent text-[18px] font-bold tracking-[0.2em] text-ink outline-none md:text-[20px]"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={mode === 'register' ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button
              type="button"
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              onClick={() => setShowPassword((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-pill bg-surface-2 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
            >
              {showPassword ? (
                <EyeOff size={18} strokeWidth={2.2} aria-hidden />
              ) : (
                <Eye size={18} strokeWidth={2.2} aria-hidden />
              )}
            </button>
          </div>
          {error && (
            <span className="flex items-start gap-2 text-[12.5px] font-semibold leading-snug text-danger">
              <CircleAlert size={14} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden />
              {error}
            </span>
          )}
        </label>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex h-[58px] items-center justify-center gap-2 rounded-field bg-accent text-[15.5px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60"
        >
          <ArrowRight size={19} strokeWidth={2.6} aria-hidden />
          {mode === 'login' ? t('auth.unlock') : t('auth.submitRegister')}
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-[11.5px] font-medium text-ink-3">{t('auth.or')}</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <p className="text-center text-sm text-ink-2">
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

        <div className="flex items-center gap-2 pt-1 text-xs text-ink-3">
          <Server size={14} strokeWidth={2.2} aria-hidden />
          <span>{t('auth.selfHosted')}</span>
        </div>
      </form>
    </div>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-bg text-ink md:flex-row">
      {/* Móvil: marca arriba (8b); desktop: columna izquierda (8a) */}
      {brandPanel}
      {/* Móvil: sheet crema con radio superior */}
      <div className="-mt-2 flex flex-1 flex-col rounded-t-sheet bg-bg md:mt-0 md:rounded-none">
        {formPanel}
      </div>
    </div>
  )
}
