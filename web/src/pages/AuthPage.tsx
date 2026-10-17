import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CircleAlert, Eye, EyeOff, Lock, MailCheck, Server, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { confirmRegistration, fetchRegistration, login, loginTwoFactor, register } from '../api/auth'
import { ApiClientError } from '../api/client'
import type { User } from '../domain'
import { DEFAULT_LOCALE } from '../i18n/locales'
import { t } from '../i18n/t'
import { extensionLegalLinks } from '../extension'
import { GubiaCredit } from '../ui/GubiaCredit'
import { LegalLinks } from '../ui/LegalLinks'
import { BrandMark } from '../ui/BrandMark'
import { setFaviconPercent } from '../ui/ProgressRing'

type Mode = 'login' | 'register'
/** Entrar, pedir el código 2FA o pedir que se confirme el email. */
type AuthResult =
  | { user: User }
  | { twoFactorRequired: true; challenge: string }
  | { verifyEmail: true; to: string }

export function AuthPage({ mode }: { mode: Mode }) {
  const { locale = DEFAULT_LOCALE } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Segundo paso del login cuando la cuenta tiene 2FA.
  const [challenge, setChallenge] = useState<string | null>(null)
  const [code, setCode] = useState('')
  // Segundo paso del registro: código enviado al email (a dónde, enmascarado).
  const [verifyTo, setVerifyTo] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const registration = useQuery({
    queryKey: ['auth', 'registration'],
    queryFn: fetchRegistration,
    staleTime: 60_000,
  })

  useEffect(() => {
    setFaviconPercent(70)
  }, [])

  useEffect(() => {
    document.title = mode === 'login' ? t('auth.pageTitle.login') : t('auth.pageTitle.register')
  }, [mode])

  const mutation = useMutation({
    mutationFn: (): Promise<AuthResult> =>
      challenge
        ? loginTwoFactor({ challenge, code })
        : verifyTo
          ? confirmRegistration({ email, code })
          : mode === 'login'
            ? login({ email, password })
            : register({ email, password, name: name || undefined }),
    onSuccess: async (res) => {
      if ('twoFactorRequired' in res) {
        setChallenge(res.challenge)
        setCode('')
        return
      }
      if ('verifyEmail' in res) {
        setVerifyTo(res.to)
        setCode('')
        return
      }
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

  const resend = useMutation({
    mutationFn: () => register({ email, password, name: name || undefined }),
    onSuccess: () => {
      setError(null)
      setCode('')
      setNotice(t('auth.verify.resent'))
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiClientError ? err.body?.error.message ?? t('auth.error') : t('auth.error'))
    },
  })

  if (mode === 'register' && registration.data && !registration.data.open) {
    return <Navigate to={`/${locale}/login`} replace />
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    mutation.mutate()
  }

  const fieldShell = error
    ? 'flex h-[60px] items-center gap-3 rounded-field border-2 border-danger bg-surface px-4'
    : 'flex h-[60px] items-center gap-3 rounded-field border-2 border-accent bg-surface px-4 focus-within:shadow-focus'

  const brandPanel = (
    <div className="flex flex-col justify-between bg-accent px-6 pb-14 pt-8 text-accent-fg md:w-[min(100%,620px)] md:flex-none md:px-14 md:py-14">
      {/* «saveToWin by gubia digital» — opción B: misma fila que el nombre */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-accent-fg text-accent md:h-[30px]">
            <BrandMark percent={70} size={22} tone="brand" />
          </span>
          <span className="text-[17px] font-bold tracking-tight md:text-[19px]">{t('app.name')}</span>
        </div>
        <GubiaCredit variant="lockup" />
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
        <p className="hidden max-w-[420px] text-base leading-relaxed text-accent-fg opacity-80 md:block">
          {t('auth.slogan.body')}
        </p>
      </div>

      <div className="mt-10 hidden gap-7 md:mt-0 md:flex">
        <div className="flex flex-col gap-1">
          <span className="text-[26px] font-extrabold tabular-nums tracking-tight">
            {t('auth.brand.stat1.value')}
          </span>
          <span className="text-xs font-medium text-accent-fg opacity-65">
            {t('auth.brand.stat1.label')}
          </span>
        </div>
        <div className="w-px bg-[color-mix(in_srgb,var(--on-accent)_20%,transparent)]" />
        <div className="flex flex-col gap-1">
          <span className="text-[26px] font-extrabold tabular-nums tracking-tight">
            {t('auth.brand.stat2.value')}
          </span>
          <span className="text-xs font-medium text-accent-fg opacity-65">
            {t('auth.brand.stat2.label')}
          </span>
        </div>
      </div>
    </div>
  )

  // Paso de código: 2FA al entrar o confirmación del email al registrarse.
  const isEmailStep = verifyTo != null
  const codeForm = (
    <form onSubmit={onSubmit} className="flex w-full max-w-[420px] flex-col gap-6 md:gap-[26px]">
      <div className="flex flex-col gap-2">
        <span className="flex size-11 items-center justify-center rounded-tile bg-accent-weak text-accent">
          {isEmailStep ? (
            <MailCheck size={22} strokeWidth={2.2} aria-hidden />
          ) : (
            <ShieldCheck size={22} strokeWidth={2.2} aria-hidden />
          )}
        </span>
        <h1 className="text-[26px] font-extrabold tracking-tight md:text-[32px]">
          {isEmailStep ? t('auth.verify.title') : t('auth.2fa.title')}
        </h1>
        <p className="text-[13.5px] leading-relaxed text-ink-2 md:text-[14.5px]">
          {isEmailStep ? t('auth.verify.hint').replace('{to}', verifyTo) : t('auth.2fa.hint')}
        </p>
      </div>
      <label className="flex flex-col gap-2">
        <span className={`text-[12.5px] font-semibold ${error ? 'text-danger' : 'text-ink-2'}`}>{t('auth.2fa.code')}</span>
        <input
          className={`h-[60px] rounded-field border-2 bg-surface px-4 text-center text-[24px] font-bold tracking-[0.3em] text-ink focus-visible:shadow-focus focus-visible:outline-none ${
            error ? 'border-danger' : 'border-accent'
          }`}
          required
          autoFocus
          inputMode={isEmailStep ? 'numeric' : 'text'}
          autoComplete="one-time-code"
          maxLength={isEmailStep ? 6 : 12}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <span className="text-[12px] text-ink-2">
          {isEmailStep ? t('auth.verify.spam') : t('auth.2fa.recoveryHint')}
        </span>
        {error && (
          <span className="flex items-start gap-2 text-[12.5px] font-semibold leading-snug text-danger">
            <CircleAlert size={14} strokeWidth={2.6} className="mt-0.5 shrink-0" aria-hidden />
            {error}
          </span>
        )}
        {notice && !error && (
          <span className="text-[12.5px] font-semibold text-income" role="status">
            {notice}
          </span>
        )}
      </label>
      <button
        type="submit"
        disabled={mutation.isPending}
        className="flex h-[58px] items-center justify-center gap-2 rounded-field bg-accent text-[15.5px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60"
      >
        <ArrowRight size={19} strokeWidth={2.6} aria-hidden />
        {isEmailStep ? t('auth.verify.submit') : t('auth.2fa.submit')}
      </button>
      {isEmailStep && (
        <button
          type="button"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
          className="inline-flex min-h-tap items-center justify-center text-sm font-bold text-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60"
        >
          {t('auth.verify.resend')}
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setChallenge(null)
          setVerifyTo(null)
          setNotice(null)
          setError(null)
        }}
        className="inline-flex min-h-tap items-center justify-center gap-2 text-sm font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
      >
        <ArrowLeft size={16} strokeWidth={2.2} aria-hidden />
        {isEmailStep ? t('auth.verify.back') : t('auth.2fa.back')}
      </button>
    </form>
  )

  const formPanel = (
    <div className="relative -mt-7 flex flex-1 items-start justify-center rounded-t-sheet bg-bg px-5 py-8 md:mt-0 md:items-center md:rounded-none md:px-20">
      {challenge || verifyTo ? codeForm : (
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
          <span className="text-[11.5px] font-medium text-ink-2">{t('auth.or')}</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <p className="text-center text-sm text-ink-2">
          {mode === 'login' ? (
            registration.data?.open === false ? (
              <span>{t('auth.registrationClosed')}</span>
            ) : (
              <>
                {t('auth.noAccount')}{' '}
                <Link className="font-semibold text-accent" to={`/${locale}/register`}>
                  {t('auth.register')}
                </Link>
              </>
            )
          ) : (
            <>
              {t('auth.hasAccount')}{' '}
              <Link className="font-semibold text-accent" to={`/${locale}/login`}>
                {t('auth.login')}
              </Link>
            </>
          )}
        </p>

        {mode === 'register' && extensionLegalLinks.length > 0 && (
          <div className="text-[12px] leading-relaxed text-ink-2">
            {t('auth.legalConsent')} <LegalLinks className="mt-1" />
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs text-ink-2">
            <Server size={14} strokeWidth={2.2} aria-hidden />
            <span>{t('auth.selfHosted')}</span>
          </div>
          {mode === 'login' && <LegalLinks />}
        </div>
      </form>
      )}
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
