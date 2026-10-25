import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, KeyRound, LogOut, Mail, ShieldAlert, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { renderSVG } from 'uqr'
import { logout, updateMe } from '../api/auth'
import { ApiClientError } from '../api/client'
import {
  confirmCode,
  deleteAccount,
  disableTwoFactor,
  enableTwoFactor,
  fetchProfile,
  requestEmailChange,
  requestPasswordChange,
  setupTwoFactor,
} from '../api/profile'
import { extensionProfileSections } from '../extension'
import { t } from '../i18n/t'
import { BackupCard } from '../ui/BackupCard'
import { ExtensionCard } from '../ui/ExtensionCard'
import { GubiaCredit } from '../ui/GubiaCredit'
import { LegalLinks } from '../ui/LegalLinks'

const field =
  'h-field w-full rounded-field border border-line bg-surface px-3 text-ink focus-visible:shadow-focus focus-visible:outline-none'
const primary =
  'inline-flex h-tap items-center justify-center gap-2 rounded-pill bg-accent px-4 text-sm font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50'
const secondary =
  'inline-flex h-tap items-center justify-center gap-2 rounded-pill bg-surface-2 px-4 text-sm font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none'

const errorText = (err: unknown) =>
  err instanceof ApiClientError ? (err.body?.error.message ?? t('common.error')) : t('common.error')

function Card({ id, title, icon, aside, children }: { id?: string; title: string; icon: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-card border border-line bg-surface p-5 shadow-raised">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
          <span className="flex size-8 items-center justify-center rounded-icon bg-surface-2 text-ink-2">{icon}</span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Label({ text, children }: { text: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12.5px] font-medium text-ink-2">{text}</span>
      {children}
    </label>
  )
}

/** Paso «te hemos enviado un código a…»: 6 dígitos y confirmar. */
function CodeStep({ to, purpose, onDone, onCancel }: { to: string; purpose: 'password' | 'email'; onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState('')
  const confirm = useMutation({ mutationFn: () => confirmCode(purpose, code), onSuccess: onDone })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        confirm.mutate()
      }}
      className="flex flex-col gap-3 rounded-tile bg-surface-2 p-4"
    >
      <p className="text-[13px] text-ink-2">
        {t('profile.code.sent')} <b className="text-ink">{to}</b>. {t('profile.code.hint')}
      </p>
      <input
        className={`${field} text-center text-[20px] font-bold tracking-[0.35em]`}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        required
        aria-label={t('profile.code.label')}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      />
      {confirm.isError && <p className="text-sm text-danger">{errorText(confirm.error)}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={code.length !== 6 || confirm.isPending} className={primary}>
          <Check size={16} strokeWidth={2.4} aria-hidden />
          {t('profile.code.confirm')}
        </button>
        <button type="button" onClick={onCancel} className={secondary}>
          {t('accounts.cancel')}
        </button>
      </div>
    </form>
  )
}

function NameRow({ initial }: { initial: string }) {
  const qc = useQueryClient()
  const [name, setName] = useState(initial)
  const [saved, setSaved] = useState(false)
  const save = useMutation({
    mutationFn: () => updateMe({ name: name.trim() || null }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['profile'] })
      await qc.invalidateQueries({ queryKey: ['auth', 'me'] })
      setSaved(true)
    },
  })
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
      className="flex items-end gap-2"
    >
      <div className="min-w-0 flex-1">
        <Label text={t('profile.name')}>
          <input
            className={field}
            value={name}
            maxLength={60}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
            placeholder={t('profile.namePh')}
          />
        </Label>
      </div>
      {name.trim() !== initial && (
        <button type="submit" disabled={save.isPending} className={primary}>
          {t('accounts.save')}
        </button>
      )}
      {saved && name.trim() === initial && (
        <span className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-savings">
          <Check size={14} strokeWidth={2.6} aria-hidden />
          {t('profile.saved')}
        </span>
      )}
    </form>
  )
}

function EmailRow({ email, canMail }: { email: string; canMail: boolean }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [password, setPassword] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const request = useMutation({
    mutationFn: () => requestEmailChange(newEmail, password),
    onSuccess: (r) => setSentTo(r.to),
  })
  const reset = () => {
    setOpen(false)
    setSentTo(null)
    setNewEmail('')
    setPassword('')
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[12.5px] font-medium text-ink-2">{t('profile.email')}</span>
          <p className="truncate font-semibold">{email}</p>
          {done && <p className="text-[12.5px] font-semibold text-savings">{t('profile.email.done')}</p>}
        </div>
        {!open && (
          <button type="button" disabled={!canMail} onClick={() => { setOpen(true); setDone(false) }} className={`${secondary} disabled:opacity-50`}>
            {t('profile.change')}
          </button>
        )}
      </div>
      {open && !sentTo && (
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            request.mutate()
          }}
          className="flex flex-col gap-3 rounded-tile bg-surface-2 p-4"
        >
          <Label text={t('profile.email.new')}>
            <input className={field} type="email" required autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </Label>
          <Label text={t('profile.password.current')}>
            <input className={field} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Label>
          {request.isError && <p className="text-sm text-danger">{errorText(request.error)}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={request.isPending} className={primary}>
              <Mail size={16} strokeWidth={2.2} aria-hidden />
              {t('profile.sendCode')}
            </button>
            <button type="button" onClick={reset} className={secondary}>
              {t('accounts.cancel')}
            </button>
          </div>
        </form>
      )}
      {sentTo && (
        <CodeStep
          to={sentTo}
          purpose="email"
          onCancel={reset}
          onDone={async () => {
            reset()
            setDone(true)
            await qc.invalidateQueries({ queryKey: ['profile'] })
          }}
        />
      )}
    </div>
  )
}

function PasswordCard({ canMail }: { canMail: boolean }) {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const mismatch = repeat.length > 0 && next !== repeat
  const request = useMutation({
    mutationFn: () => requestPasswordChange(current, next),
    onSuccess: (r) => setSentTo(r.to),
  })
  const reset = () => {
    setOpen(false)
    setSentTo(null)
    setCurrent('')
    setNext('')
    setRepeat('')
  }
  return (
    <Card title={t('profile.password.title')} icon={<KeyRound size={16} strokeWidth={2.2} aria-hidden />}>
      {!open && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-ink-2">{done ? t('profile.password.done') : t('profile.password.hint')}</p>
          <button type="button" disabled={!canMail} onClick={() => { setOpen(true); setDone(false) }} className={`${secondary} disabled:opacity-50`}>
            {t('profile.password.change')}
          </button>
        </div>
      )}
      {open && !sentTo && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!mismatch) request.mutate()
          }}
          className="flex flex-col gap-3"
        >
          <Label text={t('profile.password.current')}>
            <input className={field} type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </Label>
          <Label text={t('profile.password.new')}>
            <input className={field} type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </Label>
          <Label text={t('profile.password.repeat')}>
            <input className={field} type="password" required minLength={8} autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
          </Label>
          {mismatch && <p className="text-sm text-danger">{t('profile.password.mismatch')}</p>}
          {request.isError && <p className="text-sm text-danger">{errorText(request.error)}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={request.isPending || mismatch} className={primary}>
              <Mail size={16} strokeWidth={2.2} aria-hidden />
              {t('profile.sendCode')}
            </button>
            <button type="button" onClick={reset} className={secondary}>
              {t('accounts.cancel')}
            </button>
          </div>
        </form>
      )}
      {sentTo && (
        <CodeStep
          to={sentTo}
          purpose="password"
          onCancel={reset}
          onDone={() => {
            reset()
            setDone(true)
          }}
        />
      )}
    </Card>
  )
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = codes.join('\n')
  return (
    <div className="flex flex-col gap-3 rounded-tile border-2 border-accent bg-surface p-4">
      <p className="text-[13.5px] font-bold">{t('profile.2fa.recoveryTitle')}</p>
      <p className="text-[12.5px] text-ink-2">{t('profile.2fa.recoveryHint')}</p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-[14px] font-semibold">
        {codes.map((c) => (
          <li key={c} className="rounded-field bg-surface-2 px-3 py-2 text-center tabular-nums">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text)
            setCopied(true)
          }}
          className={secondary}
        >
          {copied ? <Check size={16} strokeWidth={2.4} aria-hidden /> : <Copy size={16} strokeWidth={2.2} aria-hidden />}
          {copied ? t('profile.copied') : t('profile.copy')}
        </button>
        <a
          href={`data:text/plain;charset=utf-8,${encodeURIComponent(`saveToWin · ${t('profile.2fa.recoveryTitle')}\n\n${text}\n`)}`}
          download="savetowin-codigos-recuperacion.txt"
          className={secondary}
        >
          <Download size={16} strokeWidth={2.2} aria-hidden />
          {t('profile.download')}
        </a>
        <button type="button" onClick={onDone} className={primary}>
          <Check size={16} strokeWidth={2.4} aria-hidden />
          {t('profile.2fa.saved')}
        </button>
      </div>
    </div>
  )
}

/** 2FA con app de autenticación (TOTP): opcional y recomendada. */
function TwoFactorCard({ enabled, recoveryLeft }: { enabled: boolean; recoveryLeft: number }) {
  const qc = useQueryClient()
  const [step, setStep] = useState<'idle' | 'password' | 'scan' | 'codes' | 'disable'>('idle')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const refresh = () => qc.invalidateQueries({ queryKey: ['profile'] })

  const start = useMutation({
    mutationFn: () => setupTwoFactor(password),
    onSuccess: (r) => {
      setSetup(r)
      setStep('scan')
      setPassword('')
    },
  })
  const enable = useMutation({
    mutationFn: () => enableTwoFactor(code),
    onSuccess: async (r) => {
      setCodes(r.recoveryCodes)
      setStep('codes')
      setCode('')
      await refresh()
    },
  })
  const disable = useMutation({
    mutationFn: () => disableTwoFactor(password, code),
    onSuccess: async () => {
      setStep('idle')
      setPassword('')
      setCode('')
      await refresh()
    },
  })
  const cancel = () => {
    setStep('idle')
    setPassword('')
    setCode('')
    setSetup(null)
  }

  return (
    <Card
      id="two-factor"
      title={t('profile.2fa.title')}
      icon={enabled ? <ShieldCheck size={16} strokeWidth={2.2} aria-hidden /> : <ShieldAlert size={16} strokeWidth={2.2} aria-hidden />}
      aside={
        enabled ? (
          <span className="rounded-pill bg-savings-weak px-2.5 py-1 text-[11px] font-bold text-savings">{t('profile.2fa.on')}</span>
        ) : (
          <span className="rounded-pill bg-warn-weak px-2.5 py-1 text-[11px] font-bold text-warn">{t('profile.2fa.recommended')}</span>
        )
      }
    >
      {step === 'idle' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-[13px] text-ink-2">
            {enabled ? t('profile.2fa.onHint').replace('{n}', String(recoveryLeft)) : t('profile.2fa.offHint')}
          </p>
          {enabled ? (
            <button type="button" onClick={() => setStep('disable')} className={secondary}>
              {t('profile.2fa.disable')}
            </button>
          ) : (
            <button type="button" onClick={() => setStep('password')} className={primary}>
              <ShieldCheck size={16} strokeWidth={2.2} aria-hidden />
              {t('profile.2fa.enable')}
            </button>
          )}
        </div>
      )}

      {(step === 'password' || step === 'disable') && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (step === 'password') start.mutate()
            else disable.mutate()
          }}
          className="flex flex-col gap-3"
        >
          <Label text={t('profile.password.current')}>
            <input className={field} type="password" required autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Label>
          {step === 'disable' && (
            <Label text={t('profile.2fa.codeOrRecovery')}>
              <input className={field} required autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} />
            </Label>
          )}
          {(start.isError || disable.isError) && <p className="text-sm text-danger">{errorText(start.error ?? disable.error)}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={start.isPending || disable.isPending} className={primary}>
              {step === 'password' ? t('profile.continue') : t('profile.2fa.disable')}
            </button>
            <button type="button" onClick={cancel} className={secondary}>
              {t('accounts.cancel')}
            </button>
          </div>
        </form>
      )}

      {step === 'scan' && setup && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            enable.mutate()
          }}
          className="flex flex-col gap-4"
        >
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-ink-2">
            <li>{t('profile.2fa.step1')}</li>
            <li>{t('profile.2fa.step2')}</li>
          </ol>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* QR del otpauth://… generado en el navegador (uqr): nada sale de esta máquina */}
            <a
              href={setup.otpauthUrl}
              aria-label={t('profile.2fa.openApp')}
              className="block size-44 flex-none overflow-hidden rounded-tile border border-line bg-white p-2"
              dangerouslySetInnerHTML={{ __html: renderSVG(setup.otpauthUrl, { border: 1 }) }}
            />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[12.5px] font-medium text-ink-2">{t('profile.2fa.manual')}</span>
              <code className="break-all rounded-field bg-surface-2 px-3 py-2 font-mono text-[13px] font-semibold tracking-wider">
                {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
              </code>
            </div>
          </div>
          <Label text={t('profile.2fa.code')}>
            <input
              className={`${field} text-center text-[20px] font-bold tracking-[0.35em]`}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </Label>
          {enable.isError && <p className="text-sm text-danger">{errorText(enable.error)}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={code.length !== 6 || enable.isPending} className={primary}>
              <ShieldCheck size={16} strokeWidth={2.2} aria-hidden />
              {t('profile.2fa.enable')}
            </button>
            <button type="button" onClick={cancel} className={secondary}>
              {t('accounts.cancel')}
            </button>
          </div>
        </form>
      )}

      {step === 'codes' && <RecoveryCodes codes={codes} onDone={cancel} />}
    </Card>
  )
}

/** Eliminar la cuenta (derecho de supresión): contraseña y, con 2FA, un código. */
function DeleteAccountCard({ twoFactor }: { twoFactor: boolean }) {
  const { locale = 'es' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const remove = useMutation({
    mutationFn: () => deleteAccount(password, twoFactor ? code : undefined),
    onSuccess: () => {
      qc.clear()
      navigate(`/${locale}/login`, { replace: true })
    },
  })
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">{t('profile.delete.title')}</h2>
          <p className="mt-1 max-w-md text-[12.5px] text-ink-2">{t('profile.delete.hint')}</p>
        </div>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex h-tap items-center gap-2 rounded-pill bg-danger-weak px-4 text-sm font-semibold text-danger focus-visible:shadow-focus focus-visible:outline-none">
            <Trash2 size={16} strokeWidth={2.2} aria-hidden />
            {t('profile.delete.cta')}
          </button>
        )}
      </div>
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (window.confirm(t('profile.delete.confirm'))) remove.mutate()
          }}
          className="mt-4 flex flex-col gap-3"
        >
          <Label text={t('profile.password.current')}>
            <input className={field} type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Label>
          {twoFactor && (
            <Label text={t('profile.2fa.codeOrRecovery')}>
              <input className={field} required autoComplete="one-time-code" maxLength={12} value={code} onChange={(e) => setCode(e.target.value)} />
            </Label>
          )}
          {remove.isError && <p className="text-sm text-danger">{errorText(remove.error)}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={remove.isPending} className="inline-flex h-tap items-center gap-2 rounded-pill bg-danger px-4 text-sm font-bold text-white focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50">
              <Trash2 size={16} strokeWidth={2.2} aria-hidden />
              {t('profile.delete.final')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={secondary}>
              {t('accounts.cancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

/** Perfil: gestión mínima de la cuenta (sin parte social). */
export function ProfilePage() {
  const { locale = 'es' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const profile = useQuery({ queryKey: ['profile'], queryFn: fetchProfile })
  const out = useMutation({
    mutationFn: logout,
    onSettled: async () => {
      qc.clear()
      navigate(`/${locale}/login`, { replace: true })
    },
  })
  const p = profile.data
  // Desde el aviso de 2FA (`/profile#two-factor`): ir directo a esa sección.
  const { hash } = useLocation()
  useEffect(() => {
    if (p && hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' })
  }, [p, hash])
  const initial = (p?.name?.trim() || p?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {profile.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
      {profile.isError && <p className="text-danger">{t('common.error')}</p>}
      {p && (
        <>
          <div className="flex items-center gap-4">
            <span className="flex size-16 flex-none items-center justify-center rounded-full bg-accent text-[26px] font-extrabold text-accent-fg">
              {initial}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-[26px] font-extrabold tracking-tight">{p.name || t('profile.title')}</h1>
              <p className="truncate text-[13px] text-ink-2">{p.email}</p>
              <p className="text-[12px] text-ink-3">
                {t('profile.since')}{' '}
                {new Date(`${p.createdAt.slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <Card title={t('profile.data')} icon={<UserRound size={16} strokeWidth={2.2} aria-hidden />}>
            <div className="flex flex-col gap-4">
              <NameRow initial={p.name ?? ''} />
              <EmailRow email={p.email} canMail={p.emailConfigured} />
            </div>
          </Card>
          <PasswordCard canMail={p.emailConfigured} />
          {!p.emailConfigured && <p className="text-[12.5px] text-ink-3">{t('profile.noMail')}</p>}
          <TwoFactorCard enabled={p.twoFactorEnabled} recoveryLeft={p.recoveryCodesLeft} />
          {extensionProfileSections.map((Section, i) => (
            <Section key={i} />
          ))}
          <BackupCard />
          <ExtensionCard />
          <DeleteAccountCard twoFactor={p.twoFactorEnabled} />
          <button
            type="button"
            onClick={() => out.mutate()}
            className="inline-flex min-h-tap items-center justify-center gap-2 self-start rounded-pill px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2 focus-visible:shadow-focus focus-visible:outline-none"
          >
            <LogOut size={16} strokeWidth={2.2} aria-hidden />
            {t('nav.logout')}
          </button>
          <footer className="flex flex-col gap-2 border-t border-line pt-4">
            <GubiaCredit variant="inline" />
            <LegalLinks />
          </footer>
        </>
      )}
    </div>
  )
}
