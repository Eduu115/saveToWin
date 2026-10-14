import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { Calendar, Check, ChevronUp, CreditCard, Delete, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import type {
  Account,
  Card,
  Category,
  SubscriptionCustomUnit,
  SubscriptionRecurrence,
} from '../domain'
import { t } from '../i18n/t'
import { categoryBgClass, categoryCssVar, categoryIcon } from './categoryMeta'

export type FlowDraft = 'expense' | 'income' | 'savings'

export type MovementDraft = {
  date: string
  amount: string
  type: FlowDraft
  categoryId: string
  accountId: string
  cardId: string
  note: string
  recurrence: SubscriptionRecurrence
  customEvery: string
  customUnit: SubscriptionCustomUnit
}

/**
 * Directions 3c — tres alturas; la completa es la pantalla entera.
 * ponytail: la compacta se ajusta al contenido (teclado + sugerencias que pueden
 * ocupar 2 líneas) en vez de 352px fijos, para que nada se solape con Guardar.
 */
type SheetHeight = 'compact' | 'medium' | 'full'
const HEIGHTS: Record<SheetHeight, string> = {
  compact: 'auto',
  medium: 'min(712px, 100dvh)',
  full: '100dvh',
}
const ORDER: SheetHeight[] = ['compact', 'medium', 'full']

function useIsDesktop() {
  const query = '(min-width: 640px)'
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return desktop
}

/** Importe tecleado → texto de la tarjeta (sin redondear lo que aún se escribe). */
function amountDisplay(amount: string): string {
  return amount === '' ? '0' : amount
}

function typedAmountCents(amount: string): number | null {
  try {
    return parseAmountToCents(amount)
  } catch {
    return null
  }
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'] as const

type Props = {
  draft: MovementDraft
  setDraft: (d: MovementDraft) => void
  editing: boolean
  isSubscriptionForm: boolean
  isSavingsForm: boolean
  categories: Category[]
  accounts: Account[]
  cards: Card[]
  formError: string | null
  saving: boolean
  deleting: boolean
  onTypeChange: (type: FlowDraft) => void
  onSubmit: () => void
  onDelete: () => void
  onClose: () => void
}

/**
 * Directions 3a/3b/3c + 4e — una sola hoja que crece: compacta (teclado + 2
 * sugerencias), media (rejilla de categorías) y completa (recurrencia).
 * En escritorio es un diálogo centrado con el contenido de la media.
 */
export function MovementSheet(props: Props) {
  const {
    draft,
    setDraft,
    editing,
    isSubscriptionForm,
    isSavingsForm,
    categories,
    accounts,
    cards,
  } = props
  const desktop = useIsDesktop()
  const [height, setHeight] = useState<SheetHeight>(editing ? 'medium' : 'compact')
  const dragFrom = useRef<number | null>(null)

  // La recurrencia solo cabe en la altura completa (3c).
  useEffect(() => {
    if (isSubscriptionForm) setHeight('full')
  }, [isSubscriptionForm])

  const compact = !desktop && height === 'compact'
  // 3c: al crecer desde compacta, la tarjeta terracota se estira hasta ser la cabecera.
  const [grewFromCompact, setGrewFromCompact] = useState(false)
  const prevHeight = useRef(height)
  useEffect(() => {
    setGrewFromCompact(prevHeight.current === 'compact' && height !== 'compact')
    prevHeight.current = height
  }, [height])
  const selectedCat = categories.find((c) => String(c.id) === draft.categoryId)
  const selectedAcc = accounts.find((a) => String(a.id) === draft.accountId)
  const cents = typedAmountCents(draft.amount)

  function grow() {
    setHeight((h) => ORDER[Math.min(ORDER.indexOf(h) + 1, ORDER.length - 1)])
  }
  function shrink() {
    if (height === 'compact' || (editing && height === 'medium')) props.onClose()
    else setHeight((h) => ORDER[Math.max(ORDER.indexOf(h) - 1, 0)])
  }

  function press(key: (typeof KEYS)[number]) {
    const cur = draft.amount
    if (key === 'del') return setDraft({ ...draft, amount: cur.slice(0, -1) })
    if (key === ',' && (cur.includes(',') || cur === '')) return
    const next = cur === '0' && key !== ',' ? key : cur + key
    if (!/^\d{0,7}(,\d{0,2})?$/.test(next)) return
    setDraft({ ...draft, amount: next })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    props.onSubmit()
  }

  const title = editing
    ? t('transactions.edit')
    : isSubscriptionForm
      ? t('transactions.newSubscription')
      : t('transactions.new')

  const sheetStyle = { '--sheet-h': HEIGHTS[height] } as CSSProperties

  const typeTabs = !isSubscriptionForm && (
    <div
      role="radiogroup"
      aria-label={t('transactions.type')}
      className={`flex gap-0.5 rounded-pill p-0.5 ${compact ? 'bg-surface-2' : 'bg-[color-mix(in_srgb,var(--on-accent)_15%,transparent)]'}`}
    >
      {(['expense', 'income', 'savings'] as const).map((type) => {
        const on = draft.type === type
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => props.onTypeChange(type)}
            className={`inline-flex h-9 items-center rounded-pill px-3 text-[12.5px] font-bold focus-visible:shadow-focus focus-visible:outline-none ${
              on
                ? compact
                  ? 'bg-surface text-accent shadow-raised'
                  : 'bg-accent-fg text-accent'
                : compact
                  ? 'text-ink-2'
                  : 'text-accent-fg opacity-85'
            }`}
          >
            {t(`transactions.type.${type}`)}
          </button>
        )
      })}
    </div>
  )

  const iconButton = (onBg: boolean) =>
    `inline-flex size-tap flex-none items-center justify-center rounded-full focus-visible:shadow-focus focus-visible:outline-none ${
      onBg ? 'bg-[color-mix(in_srgb,var(--on-accent)_15%,transparent)] text-accent-fg hover:bg-[color-mix(in_srgb,var(--on-accent)_25%,transparent)]' : 'bg-surface-2 text-ink-2'
    }`

  const closeButtons = (onBg: boolean) => (
    <div className="flex flex-none gap-2">
      {editing && (
        <button
          type="button"
          aria-label={t('transactions.delete')}
          disabled={props.deleting}
          onClick={props.onDelete}
          className={iconButton(onBg)}
        >
          <Trash2 size={17} strokeWidth={2.2} aria-hidden />
        </button>
      )}
      <button
        type="button"
        aria-label={t('transactions.close')}
        onClick={props.onClose}
        className={iconButton(onBg)}
      >
        <X size={18} strokeWidth={2.2} aria-hidden />
      </button>
    </div>
  )

  const handle = !desktop && (
    <div
      className="flex h-6 flex-none cursor-grab touch-none items-center justify-center"
      onPointerDown={(e) => {
        dragFrom.current = e.clientY
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerUp={(e) => {
        if (dragFrom.current == null) return
        const dy = e.clientY - dragFrom.current
        dragFrom.current = null
        if (dy < -40) grow()
        else if (dy > 60) shrink()
      }}
    >
      <span
        className={`h-1 w-10 rounded-pill ${compact ? 'bg-line' : 'bg-[color-mix(in_srgb,var(--on-accent)_40%,transparent)]'}`}
        aria-hidden
      />
    </div>
  )

  const saveButton = (
    <button
      type="submit"
      disabled={props.saving || cents == null}
      className="inline-flex h-14 w-full flex-none items-center justify-center gap-2 rounded-tile bg-accent text-[15px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
    >
      <Check size={18} strokeWidth={2.4} aria-hidden />
      {t('transactions.save')}
      {cents != null && cents > 0 ? ` ${formatCents(cents)}` : ''}
    </button>
  )

  const chip =
    'inline-flex h-11 items-center gap-1.5 rounded-pill px-3.5 text-[13px] font-semibold focus-visible:shadow-focus focus-visible:outline-none'
  const SelectedIcon = categoryIcon(selectedCat?.key ?? '')

  return (
    <div
      className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={props.onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        style={sheetStyle}
        className="sheet-in sheet-height flex h-[var(--sheet-h)] max-h-dvh w-full flex-col overflow-hidden rounded-t-sheet bg-surface shadow-raised sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-sheet"
      >
        {compact ? (
          /* 3a — compacta: el importe es una tarjeta dentro de la hoja */
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {handle}
            <div className="flex items-center justify-between gap-2">
              {typeTabs || <h2 className="text-[15px] font-bold">{title}</h2>}
              {closeButtons(false)}
            </div>
            <div className="flex h-[76px] flex-none items-center justify-center rounded-tile bg-accent text-accent-fg">
              <span className="text-[44px] font-extrabold leading-none tracking-tight tabular-nums">
                {amountDisplay(draft.amount)}
              </span>
              <span className="ml-1 self-end pb-4 text-xl font-bold opacity-70">€</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedCat && (
                <button
                  type="button"
                  onClick={grow}
                  className={`${chip} text-white ${categoryBgClass(selectedCat.color)}`}
                >
                  <SelectedIcon size={15} strokeWidth={2.2} aria-hidden />
                  {selectedCat.label}
                </button>
              )}
              {selectedAcc && !isSavingsForm && (
                <button type="button" onClick={grow} className={`${chip} bg-surface-2 text-ink`}>
                  <CreditCard size={15} strokeWidth={2.2} aria-hidden />
                  {selectedAcc.name}
                </button>
              )}
              <button type="button" onClick={grow} className={`${chip} bg-accent-weak text-accent`}>
                <ChevronUp size={15} strokeWidth={2.4} aria-hidden />
                {t('transactions.more')}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {KEYS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-label={k === 'del' ? t('transactions.keyDelete') : k}
                  onClick={() => press(k)}
                  className="flex h-12 items-center justify-center rounded-tile bg-surface-2 text-2xl font-semibold tabular-nums active:bg-line focus-visible:shadow-focus focus-visible:outline-none"
                >
                  {k === 'del' ? <Delete size={22} strokeWidth={2} aria-hidden /> : k}
                </button>
              ))}
            </div>
            {props.formError && <p className="text-sm text-danger">{props.formError}</p>}
            <div className="mt-3 flex-none">{saveButton}</div>
          </div>
        ) : (
          <>
            {/* 3b / 4e — cabecera terracota de borde a borde */}
            <div
              className={`flex-none bg-accent px-4 pb-5 text-accent-fg sm:px-5 sm:pt-4 ${grewFromCompact ? 'header-grow' : ''}`}
            >
              {handle}
              <div className="flex items-center justify-between gap-2">
                {typeTabs || <h2 className="text-[15px] font-bold">{title}</h2>}
                {closeButtons(true)}
              </div>
              {editing && typeTabs && (
                <p className="mt-2 text-[12px] font-semibold text-accent-fg opacity-80">{title}</p>
              )}
              {desktop ? (
                <label className="mt-3 flex items-baseline justify-center gap-1">
                  <span className="sr-only">{t('transactions.amount')}</span>
                  <input
                    required
                    inputMode="decimal"
                    placeholder="0,00"
                    value={draft.amount}
                    onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                    size={Math.max(4, draft.amount.length + 1)}
                    className="min-w-0 max-w-full bg-transparent text-center text-[44px] font-extrabold leading-none tracking-tight tabular-nums placeholder:text-accent-fg placeholder:opacity-50 focus-visible:outline-none"
                  />
                  <span className="text-xl font-bold opacity-70">€</span>
                </label>
              ) : (
                <button
                  type="button"
                  onClick={() => setHeight('compact')}
                  aria-label={`${t('transactions.amount')}: ${amountDisplay(draft.amount)} €`}
                  className="mt-3 flex w-full items-baseline justify-center gap-1 focus-visible:shadow-focus focus-visible:outline-none"
                >
                  <span className="text-[48px] font-extrabold leading-none tracking-tight tabular-nums">
                    {amountDisplay(draft.amount)}
                  </span>
                  <span className="text-xl font-bold opacity-70">€</span>
                </button>
              )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
              <fieldset>
                <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-2">
                  {t('transactions.category')}
                </legend>
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((c) => {
                    const Icon = categoryIcon(c.key)
                    const on = String(c.id) === draft.categoryId
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setDraft({ ...draft, categoryId: String(c.id) })}
                        className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-tile border px-1 py-2 text-[11px] font-semibold leading-tight focus-visible:shadow-focus focus-visible:outline-none ${
                          on
                            ? `border-transparent text-white ${categoryBgClass(c.color)}`
                            : 'border-line bg-surface text-ink-2'
                        }`}
                      >
                        <Icon
                          size={19}
                          strokeWidth={2.2}
                          aria-hidden
                          style={on ? undefined : { color: categoryCssVar(c.color) }}
                        />
                        <span className="line-clamp-2 text-center">{c.label}</span>
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {isSubscriptionForm && (
                <div className="grid gap-3">
                  <label>
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-2">
                      {t('subscriptions.recurrence')}
                    </span>
                    <select
                      className="h-field w-full rounded-field border border-line bg-surface px-3 focus-visible:shadow-focus focus-visible:outline-none"
                      value={draft.recurrence}
                      onChange={(e) =>
                        setDraft({ ...draft, recurrence: e.target.value as SubscriptionRecurrence })
                      }
                    >
                      <option value="weekly">{t('subscriptions.recurrence.weekly')}</option>
                      <option value="monthly">{t('subscriptions.recurrence.monthly')}</option>
                      <option value="quarterly">{t('subscriptions.recurrence.quarterly')}</option>
                      <option value="yearly">{t('subscriptions.recurrence.yearly')}</option>
                      <option value="custom">{t('subscriptions.recurrence.other')}</option>
                    </select>
                  </label>
                  {draft.recurrence === 'custom' && (
                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        <span className="mb-1 block text-sm text-ink-2">{t('subscriptions.every')}</span>
                        <input
                          className="h-field w-full rounded-field border border-line bg-surface px-3 tabular-nums focus-visible:shadow-focus focus-visible:outline-none"
                          type="number"
                          min={1}
                          required
                          value={draft.customEvery}
                          onChange={(e) => setDraft({ ...draft, customEvery: e.target.value })}
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-sm text-ink-2">{t('subscriptions.unit')}</span>
                        <select
                          className="h-field w-full rounded-field border border-line bg-surface px-3 focus-visible:shadow-focus focus-visible:outline-none"
                          value={draft.customUnit}
                          onChange={(e) =>
                            setDraft({ ...draft, customUnit: e.target.value as SubscriptionCustomUnit })
                          }
                        >
                          <option value="weeks">{t('subscriptions.unit.weeks')}</option>
                          <option value="months">{t('subscriptions.unit.months')}</option>
                          <option value="years">{t('subscriptions.unit.years')}</option>
                        </select>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {!isSavingsForm && (
                <fieldset>
                  <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-2">
                    {t('transactions.paidWith')}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {accounts.map((a) => {
                      const on = String(a.id) === draft.accountId
                      return (
                        <button
                          key={a.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setDraft({ ...draft, accountId: String(a.id), cardId: '' })}
                          className={`${chip} border ${
                            on ? 'border-transparent bg-ink text-bg' : 'border-line bg-surface text-ink-2'
                          }`}
                        >
                          {a.name}
                        </button>
                      )
                    })}
                  </div>
                  {cards.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2" aria-label={t('transactions.card')}>
                      {[{ id: '', name: t('transactions.cardNone') }, ...cards.map((c) => ({ id: String(c.id), name: c.name }))].map(
                        (c) => {
                          const on = draft.cardId === c.id
                          return (
                            <button
                              key={c.id || 'none'}
                              type="button"
                              aria-pressed={on}
                              onClick={() => setDraft({ ...draft, cardId: c.id })}
                              className={`${chip} h-10 border text-[12.5px] ${
                                on ? 'border-accent bg-accent-weak text-accent' : 'border-line bg-surface text-ink-2'
                              }`}
                            >
                              <CreditCard size={14} strokeWidth={2.2} aria-hidden />
                              {c.name}
                            </button>
                          )
                        },
                      )}
                    </div>
                  )}
                </fieldset>
              )}

              <div className="flex gap-2">
                <label className="flex h-[52px] flex-none items-center gap-2 rounded-tile border border-line bg-surface px-3 focus-within:shadow-focus">
                  <Calendar size={16} strokeWidth={2.2} className="text-ink-2" aria-hidden />
                  <span className="sr-only">
                    {isSubscriptionForm ? t('subscriptions.firstCharge') : t('transactions.date')}
                  </span>
                  <input
                    type="date"
                    required
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    className="w-[8.5rem] bg-transparent text-[13.5px] font-semibold focus-visible:outline-none"
                  />
                </label>
                {!isSavingsForm && (
                  <label className="flex h-[52px] min-w-0 flex-1 items-center gap-2 rounded-tile border border-line bg-surface px-3 focus-within:shadow-focus">
                    <Pencil size={16} strokeWidth={2.2} className="flex-none text-ink-2" aria-hidden />
                    <span className="sr-only">
                      {isSubscriptionForm ? t('subscriptions.noteLabel') : t('transactions.note')}
                    </span>
                    <input
                      value={draft.note}
                      placeholder={
                        isSubscriptionForm
                          ? t('subscriptions.notePlaceholder')
                          : t('transactions.notePlaceholder')
                      }
                      onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                      className="min-w-0 flex-1 bg-transparent text-[13.5px] placeholder:text-ink-3 focus-visible:outline-none"
                    />
                  </label>
                )}
                {!desktop && (
                  <button
                    type="button"
                    onClick={() => setHeight('compact')}
                    aria-label={t('transactions.keypad')}
                    className="inline-flex h-[52px] flex-none items-center rounded-tile border border-line bg-surface px-3 text-[13px] font-bold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
                  >
                    123
                  </button>
                )}
              </div>
            </div>

            <div className="flex-none px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1 sm:px-5 sm:pb-5">
              {props.formError && <p className="mb-2 text-sm text-danger">{props.formError}</p>}
              {saveButton}
            </div>
          </>
        )}
      </form>
    </div>
  )
}
