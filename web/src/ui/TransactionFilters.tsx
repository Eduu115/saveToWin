import { formatCents } from '@savetowin/shared/money'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownUp,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { listTransactions, type TransactionQuery } from '../api/transactions'
import type { Account, Category } from '../domain'
import { t } from '../i18n/t'
import { categoryBgClass, categoryCssVar, categoryIcon } from './categoryMeta'

/** Directions 4a–4d: estado de los filtros de Movimientos (vive en la URL). */
export type TxFilters = {
  /** `YYYY-MM`; null = todo el historial */
  month: string | null
  q: string
  categoryIds: number[]
  accountIds: number[]
  minCents: number | null
  maxCents: number | null
  type: 'expense' | 'income' | null
  sort: 'desc' | 'asc'
  page: number
}

export const PAGE_SIZE = 50

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
]

const pad = (n: number) => String(n).padStart(2, '0')

export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return `${MONTHS_ES[m - 1]} ${y}`
}

/** Mes actual y los 23 anteriores (más el elegido, si es más antiguo). */
function monthOptions(selected: string | null): string[] {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < 24; i++) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
    d.setMonth(d.getMonth() - 1, 1)
  }
  if (selected && !out.includes(selected)) out.push(selected)
  return out
}

const ids = (v: string | null) =>
  v ? v.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0) : []
const cents = (v: string | null) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function readFilters(p: URLSearchParams): TxFilters {
  const m = p.get('m')
  const type = p.get('t')
  return {
    month: m === 'all' ? null : m && /^\d{4}-\d{2}$/.test(m) ? m : currentMonth(),
    q: p.get('q') ?? '',
    categoryIds: ids(p.get('c')),
    accountIds: ids(p.get('a')),
    minCents: cents(p.get('min')),
    maxCents: cents(p.get('max')),
    type: type === 'expense' || type === 'income' ? type : null,
    sort: p.get('s') === 'asc' ? 'asc' : 'desc',
    page: Math.max(1, Math.floor(Number(p.get('p'))) || 1),
  }
}

export function writeFilters(f: TxFilters): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.month !== currentMonth()) out.m = f.month ?? 'all'
  if (f.q) out.q = f.q
  if (f.categoryIds.length) out.c = f.categoryIds.join(',')
  if (f.accountIds.length) out.a = f.accountIds.join(',')
  if (f.minCents != null) out.min = String(f.minCents)
  if (f.maxCents != null) out.max = String(f.maxCents)
  if (f.type) out.t = f.type
  if (f.sort === 'asc') out.s = 'asc'
  if (f.page > 1) out.p = String(f.page)
  return out
}

export function toQuery(f: TxFilters): TransactionQuery {
  const q: TransactionQuery = {
    q: f.q || undefined,
    categoryIds: f.categoryIds,
    accountIds: f.accountIds,
    type: f.type ?? undefined,
    minAmount: f.minCents ?? undefined,
    maxAmount: f.maxCents ?? undefined,
    sort: f.sort,
  }
  if (f.month) {
    const [y, m] = f.month.split('-').map(Number)
    q.from = `${f.month}-01`
    q.to = `${f.month}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`
  }
  return q
}

/** Grupos de filtros activos (sin mes ni búsqueda): el número del botón «Filtros». */
export function filterCount(f: TxFilters): number {
  return (
    Number(f.categoryIds.length > 0) +
    Number(f.accountIds.length > 0) +
    Number(f.minCents != null || f.maxCents != null) +
    Number(f.type != null)
  )
}

export const clearedFilters = (f: TxFilters): TxFilters => ({
  ...f,
  q: '',
  categoryIds: [],
  accountIds: [],
  minCents: null,
  maxCents: null,
  type: null,
  page: 1,
})

function euros(c: number): string {
  return formatCents(c).replace(',00', '')
}

function amountSummary(f: TxFilters): string | null {
  if (f.minCents == null && f.maxCents == null) return null
  if (f.maxCents == null) return `≥ ${euros(f.minCents ?? 0)}`
  if (f.minCents == null) return `≤ ${euros(f.maxCents)}`
  return `${euros(f.minCents)} – ${euros(f.maxCents)}`
}

const toggle = (list: number[], id: number) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

const chipBase =
  'inline-flex h-11 items-center gap-1.5 rounded-pill px-4 text-[13px] font-semibold focus-visible:shadow-focus focus-visible:outline-none'
const addChip = `${chipBase} border border-dashed border-line bg-surface text-ink-2 hover:text-ink`
const onChip = `${chipBase} border border-line bg-surface text-ink`

function MonthSelect({
  value,
  onChange,
  withIcon,
}: {
  value: string | null
  onChange: (m: string | null) => void
  withIcon?: boolean
}) {
  return (
    <label
      className={`${chipBase} relative bg-accent font-bold text-accent-fg shadow-accent focus-within:shadow-focus`}
    >
      {withIcon && <Calendar size={15} strokeWidth={2.2} aria-hidden />}
      <span className="whitespace-nowrap">{value ? monthLabel(value) : t('transactions.month.all')}</span>
      <ChevronDown size={15} strokeWidth={2.4} aria-hidden />
      <select
        aria-label={t('transactions.month.label')}
        value={value ?? 'all'}
        onChange={(e) => onChange(e.target.value === 'all' ? null : e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="all">{t('transactions.month.all')}</option>
        {monthOptions(value).map((p) => (
          <option key={p} value={p}>
            {monthLabel(p)}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Desplegable ligero: se cierra al pulsar fuera o con Escape. */
function Popover({
  button,
  className,
  children,
}: {
  button: (open: boolean, toggle: () => void) => ReactNode
  className?: string
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      {button(open, () => setOpen((o) => !o))}
      {open && (
        <div
          className={`fade-in absolute left-0 top-full z-30 mt-2 max-h-80 w-64 overflow-y-auto rounded-field border border-line bg-surface p-2 shadow-raised ${className ?? ''}`}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export { Popover }

const optionRow =
  'flex min-h-tap w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13.5px] font-semibold hover:bg-surface-2 focus-visible:shadow-focus focus-visible:outline-none'

function CheckList<T extends { id: number }>({
  items,
  selected,
  onToggle,
  render,
}: {
  items: T[]
  selected: number[]
  onToggle: (id: number) => void
  render: (item: T) => ReactNode
}) {
  return (
    <ul>
      {items.map((it) => (
        <li key={it.id}>
          <label className={`${optionRow} cursor-pointer`}>
            <input
              type="checkbox"
              checked={selected.includes(it.id)}
              onChange={() => onToggle(it.id)}
              className="size-4 accent-[var(--accent)]"
            />
            {render(it)}
          </label>
        </li>
      ))}
    </ul>
  )
}

function CategoryDot({ c }: { c: Category }) {
  return <span className={`size-2.5 flex-none rounded-full ${categoryBgClass(c.color)}`} aria-hidden />
}

function SearchInput({ value, onChange, autoFocus }: { value: string; onChange: (q: string) => void; autoFocus?: boolean }) {
  // Se aplica 300 ms después de dejar de teclear (una consulta por búsqueda, no por tecla).
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  useEffect(() => {
    if (text.trim() === value) return
    const id = setTimeout(() => onChange(text.trim()), 300)
    return () => clearTimeout(id)
  }, [text, value, onChange])
  return (
    <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-pill border border-line bg-surface px-4 focus-within:border-accent focus-within:shadow-focus">
      <Search size={16} strokeWidth={2.2} className="flex-none text-ink-3" aria-hidden />
      <input
        type="search"
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('transactions.search')}
        aria-label={t('transactions.search')}
        className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-3 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('')
            onChange('')
          }}
          aria-label={t('transactions.searchClear')}
          className="-mr-2 flex size-8 flex-none items-center justify-center rounded-full bg-surface-2 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
        >
          <X size={14} strokeWidth={2.4} aria-hidden />
        </button>
      )}
    </label>
  )
}

type BarProps = {
  filters: TxFilters
  onChange: (f: TxFilters) => void
  categories: Category[]
  accounts: Account[]
}

/** Directions 4a — barra de filtros de escritorio. */
export function FilterBar({ filters: f, onChange, categories, accounts }: BarProps) {
  const set = (patch: Partial<TxFilters>) => onChange({ ...f, ...patch, page: 1 })
  const catById = new Map(categories.map((c) => [c.id, c]))
  const accLabel = accounts
    .filter((a) => f.accountIds.includes(a.id))
    .map((a) => a.name)
    .join(', ')
  const amount = amountSummary(f)
  const anyFilter = filterCount(f) > 0 || f.q !== ''
  return (
    <div className="mb-4 hidden flex-wrap items-center gap-2 md:flex">
      <div className="w-full max-w-[260px]">
        <SearchInput value={f.q} onChange={(q) => set({ q })} />
      </div>
      <MonthSelect value={f.month} onChange={(month) => set({ month })} withIcon />

      {f.categoryIds.map((id) => {
        const c = catById.get(id)
        if (!c) return null
        return (
          <span key={id} className={`${onChip} pr-1.5`}>
            <CategoryDot c={c} />
            {c.label}
            <button
              type="button"
              onClick={() => set({ categoryIds: f.categoryIds.filter((x) => x !== id) })}
              aria-label={`${t('transactions.filter.remove')}: ${c.label}`}
              className="flex size-8 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
            >
              <X size={14} strokeWidth={2.4} aria-hidden />
            </button>
          </span>
        )
      })}

      <Popover
        button={(open, tog) => (
          <button type="button" aria-expanded={open} onClick={tog} className={addChip}>
            <Plus size={15} strokeWidth={2.4} aria-hidden />
            {t('transactions.filter.addCategory')}
          </button>
        )}
      >
        {() => (
          <CheckList
            items={categories}
            selected={f.categoryIds}
            onToggle={(id) => set({ categoryIds: toggle(f.categoryIds, id) })}
            render={(c) => (
              <>
                <CategoryDot c={c} />
                {c.label}
              </>
            )}
          />
        )}
      </Popover>

      <Popover
        button={(open, tog) => (
          <button type="button" aria-expanded={open} onClick={tog} className={accLabel ? onChip : addChip}>
            <span className="max-w-[180px] truncate">{accLabel || t('transactions.filter.account')}</span>
            <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      >
        {() => (
          <CheckList
            items={accounts}
            selected={f.accountIds}
            onToggle={(id) => set({ accountIds: toggle(f.accountIds, id) })}
            render={(a) => a.name}
          />
        )}
      </Popover>

      <Popover
        className="w-72 p-3"
        button={(open, tog) => (
          <button type="button" aria-expanded={open} onClick={tog} className={amount ? onChip : addChip}>
            <SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden />
            {amount ?? t('transactions.filter.amount')}
          </button>
        )}
      >
        {(close) => (
          <AmountForm
            filters={f}
            onApply={(minCents, maxCents) => {
              set({ minCents, maxCents })
              close()
            }}
          />
        )}
      </Popover>

      <Popover
        button={(open, tog) => (
          <button type="button" aria-expanded={open} onClick={tog} className={f.type ? onChip : addChip}>
            {f.type === 'expense'
              ? t('transactions.type.expenses')
              : f.type === 'income'
                ? t('transactions.type.incomes')
                : t('transactions.filter.type')}
            <ChevronDown size={14} strokeWidth={2.4} aria-hidden />
          </button>
        )}
      >
        {(close) => (
          <div role="radiogroup" aria-label={t('transactions.filter.type')}>
            {([null, 'expense', 'income'] as const).map((type) => (
              <button
                key={type ?? 'all'}
                type="button"
                role="radio"
                aria-checked={f.type === type}
                onClick={() => {
                  set({ type })
                  close()
                }}
                className={`${optionRow} ${f.type === type ? 'text-accent' : ''}`}
              >
                {type === 'expense'
                  ? t('transactions.type.expenses')
                  : type === 'income'
                    ? t('transactions.type.incomes')
                    : t('transactions.type.all')}
              </button>
            ))}
          </div>
        )}
      </Popover>

      {anyFilter && (
        <button
          type="button"
          onClick={() => onChange(clearedFilters(f))}
          className="ml-auto inline-flex min-h-tap items-center px-2 text-[13px] font-bold text-accent focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('transactions.filter.clear')}
        </button>
      )}
    </div>
  )
}

function AmountForm({ filters, onApply }: { filters: TxFilters; onApply: (min: number | null, max: number | null) => void }) {
  const toText = (c: number | null) => (c == null ? '' : String(c / 100).replace('.', ','))
  const [min, setMin] = useState(toText(filters.minCents))
  const [max, setMax] = useState(toText(filters.maxCents))
  const parse = (s: string) => {
    const n = Number(s.replace(/\./g, '').replace(',', '.'))
    return s.trim() === '' || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 100)
  }
  const field =
    'h-11 w-full rounded-field border border-line bg-surface px-3 text-[14px] tabular-nums focus-visible:border-accent focus-visible:shadow-focus focus-visible:outline-none'
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onApply(parse(min), parse(max))
      }}
      className="grid gap-3"
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-2">
          {t('transactions.filter.min')}
          <input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className={field} />
        </label>
        <label className="grid gap-1 text-[11px] font-bold uppercase tracking-wide text-ink-2">
          {t('transactions.filter.max')}
          <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className={field} />
        </label>
      </div>
      <button
        type="submit"
        className="h-11 rounded-pill bg-accent text-[13.5px] font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none"
      >
        {t('transactions.filter.apply')}
      </button>
    </form>
  )
}

/** Directions 4b — barra móvil: buscador desplegable, mes, «Filtros (n)» y orden por fecha. */
export function MobileFilterBar({
  filters: f,
  onChange,
  searchOpen,
  onOpenSheet,
}: {
  filters: TxFilters
  onChange: (f: TxFilters) => void
  searchOpen: boolean
  onOpenSheet: () => void
}) {
  const set = (patch: Partial<TxFilters>) => onChange({ ...f, ...patch, page: 1 })
  const n = filterCount(f)
  return (
    <div className="mb-4 grid gap-3 md:hidden">
      {(searchOpen || f.q) && <SearchInput value={f.q} onChange={(q) => set({ q })} autoFocus={!f.q} />}
      <div className="flex gap-1.5 [&>*]:px-3">
        <MonthSelect value={f.month} onChange={(month) => set({ month })} />
        <button type="button" onClick={onOpenSheet} className={`${onChip} border`}>
          <SlidersHorizontal size={15} strokeWidth={2.2} aria-hidden />
          {t('transactions.filters')}
          {n > 0 && (
            <span className="flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">
              {n}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => set({ sort: f.sort === 'desc' ? 'asc' : 'desc' })}
          aria-label={f.sort === 'desc' ? t('transactions.sort.newest') : t('transactions.sort.oldest')}
          className={`${onChip} border`}
        >
          <ArrowDownUp size={15} strokeWidth={2.2} aria-hidden />
          {t('transactions.sort.date')}
        </button>
      </div>
    </div>
  )
}

const SLIDER_MAX = 50_000 // 500 €; arriba del todo = sin tope
const SLIDER_STEP = 500

const thumb =
  'pointer-events-none absolute inset-0 h-11 w-full appearance-none bg-transparent ' +
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-11 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full ' +
  '[&::-webkit-slider-thumb]:bg-[radial-gradient(circle,var(--surface)_0_9px,var(--accent)_9.5px_12px,transparent_12.5px)] ' +
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-11 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 ' +
  '[&::-moz-range-thumb]:bg-[radial-gradient(circle,var(--surface)_0_9px,var(--accent)_9.5px_12px,transparent_12.5px)]'

/** Directions 4c — hoja de filtros (móvil). Aplica al pulsar «Mostrar N movimientos». */
export function FilterSheet({
  filters,
  onApply,
  onClose,
  categories,
  accounts,
}: {
  filters: TxFilters
  onApply: (f: TxFilters) => void
  onClose: () => void
  categories: Category[]
  accounts: Account[]
}) {
  const [d, setD] = useState<TxFilters>({ ...filters, page: 1 })
  const count = useQuery({
    queryKey: ['transactions', 'count', toQuery(d)],
    queryFn: () => listTransactions({ ...toQuery(d), limit: 1 }),
  })
  const lo = d.minCents ?? 0
  const hi = d.maxCents ?? SLIDER_MAX
  const n = count.data?.total

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const legend = 'mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-2'
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-filters-title"
        onClick={(e) => e.stopPropagation()}
        className="sheet-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-sheet bg-surface shadow-raised"
      >
        <div className="mx-auto mt-2 h-1 w-10 flex-none rounded-pill bg-line" aria-hidden />
        <div className="flex flex-none items-center justify-between px-5 pb-2 pt-3">
          <h2 id="tx-filters-title" className="text-[20px] font-extrabold tracking-tight">
            {t('transactions.filters')}
          </h2>
          <button
            type="button"
            onClick={() => setD({ ...clearedFilters(d), q: d.q })}
            className="min-h-tap px-1 text-[13.5px] font-bold text-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            {t('transactions.filter.reset')}
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pb-4">
          <fieldset>
            <legend className={legend}>{t('transactions.category')}</legend>
            <div className="grid grid-cols-4 gap-2">
              {categories.map((c) => {
                const Icon = categoryIcon(c.key)
                const on = d.categoryIds.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setD({ ...d, categoryIds: toggle(d.categoryIds, c.id) })}
                    className={`flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-tile border px-1 py-2 text-[11px] font-semibold leading-tight focus-visible:shadow-focus focus-visible:outline-none ${
                      on ? `border-transparent text-white ${categoryBgClass(c.color)}` : 'border-line bg-surface text-ink-2'
                    }`}
                  >
                    <Icon size={19} strokeWidth={2.2} aria-hidden style={on ? undefined : { color: categoryCssVar(c.color) }} />
                    <span className="line-clamp-2 text-center">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className={legend}>{t('transactions.account')}</legend>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => {
                const on = d.accountIds.includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setD({ ...d, accountIds: toggle(d.accountIds, a.id) })}
                    className={`${chipBase} border ${on ? 'border-transparent bg-ink text-bg' : 'border-line bg-surface text-ink-2'}`}
                  >
                    {a.name}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-1 flex items-baseline justify-between">
              <legend className={legend}>{t('transactions.amount')}</legend>
              <span className="text-[13px] font-bold tabular-nums">
                {euros(lo)} — {hi >= SLIDER_MAX ? `${euros(SLIDER_MAX)}+` : euros(hi)}
              </span>
            </div>
            <div className="relative h-11">
              <div className="absolute inset-x-[22px] top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-track" aria-hidden />
              <div
                className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-pill bg-accent"
                style={{
                  left: `calc(22px + (100% - 44px) * ${lo / SLIDER_MAX})`,
                  right: `calc(22px + (100% - 44px) * ${1 - hi / SLIDER_MAX})`,
                }}
                aria-hidden
              />
              <input
                type="range"
                min={0}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={lo}
                aria-label={t('transactions.filter.min')}
                aria-valuetext={euros(lo)}
                onChange={(e) => {
                  const v = Math.min(Number(e.target.value), hi - SLIDER_STEP)
                  setD({ ...d, minCents: v <= 0 ? null : v })
                }}
                className={thumb}
              />
              <input
                type="range"
                min={0}
                max={SLIDER_MAX}
                step={SLIDER_STEP}
                value={hi}
                aria-label={t('transactions.filter.max')}
                aria-valuetext={hi >= SLIDER_MAX ? t('transactions.filter.noMax') : euros(hi)}
                onChange={(e) => {
                  const v = Math.max(Number(e.target.value), lo + SLIDER_STEP)
                  setD({ ...d, maxCents: v >= SLIDER_MAX ? null : v })
                }}
                className={thumb}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend className={legend}>{t('transactions.type')}</legend>
            <div role="radiogroup" className="grid grid-cols-3 gap-0.5 rounded-pill bg-surface-2 p-0.5">
              {([null, 'expense', 'income'] as const).map((type) => (
                <button
                  key={type ?? 'all'}
                  type="button"
                  role="radio"
                  aria-checked={d.type === type}
                  onClick={() => setD({ ...d, type })}
                  className={`h-11 rounded-pill text-[13.5px] focus-visible:shadow-focus focus-visible:outline-none ${
                    d.type === type ? 'bg-surface font-bold shadow-sm' : 'font-semibold text-ink-2'
                  }`}
                >
                  {type === 'expense'
                    ? t('transactions.type.expenses')
                    : type === 'income'
                      ? t('transactions.type.incomes')
                      : t('transactions.type.all')}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex-none border-t border-line px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={() => onApply(d)}
            className="h-[56px] w-full rounded-field bg-accent text-[15.5px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            {n === 1 ? t('transactions.filter.showOne') : t('transactions.filter.show').replace('{n}', n == null ? '…' : String(n))}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Directions 4d — sin resultados, con salidas para ampliar la búsqueda. */
export function NoResults({
  filters: f,
  onChange,
  categories,
}: {
  filters: TxFilters
  onChange: (f: TxFilters) => void
  categories: Category[]
}) {
  const names = categories.filter((c) => f.categoryIds.includes(c.id)).map((c) => c.label)
  const parts: string[] = []
  if (f.q) parts.push(t('transactions.noResults.named').replace('{q}', f.q))
  if (names.length) parts.push(`${t('transactions.noResults.in')} ${names.join(', ')}`)
  if (filterCount(f) > (names.length ? 1 : 0)) parts.push(t('transactions.noResults.withFilters'))
  if (f.month) parts.push(`${t('transactions.noResults.during')} ${monthLabel(f.month).toLowerCase()}`)
  const btn =
    'inline-flex h-[52px] w-full max-w-xs items-center justify-center gap-2 rounded-field text-[14.5px] font-bold focus-visible:shadow-focus focus-visible:outline-none'
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        <SearchX size={30} strokeWidth={2} aria-hidden />
      </span>
      <h2 className="mt-5 text-[20px] font-extrabold tracking-tight">{t('transactions.noResults.title')}</h2>
      <p className="mt-2 max-w-sm text-[14.5px] text-ink-2">
        {t('transactions.noResults.nothing')} {parts.join(' ')}.
      </p>
      <div className="mt-6 flex w-full flex-col items-center gap-2">
        {names.length > 0 && (
          <button
            type="button"
            onClick={() => onChange({ ...f, categoryIds: [], page: 1 })}
            className={`${btn} bg-accent text-accent-fg shadow-accent`}
          >
            <Search size={17} strokeWidth={2.4} aria-hidden />
            {t('transactions.noResults.allCategories')}
          </button>
        )}
        {f.month && (
          <button
            type="button"
            onClick={() => onChange({ ...f, month: null, page: 1 })}
            className={`${btn} border border-line bg-surface text-ink`}
          >
            <Calendar size={17} strokeWidth={2.2} aria-hidden />
            {t('transactions.noResults.allTime')}
          </button>
        )}
        {!f.month && names.length === 0 && (
          <button
            type="button"
            onClick={() => onChange(clearedFilters(f))}
            className={`${btn} border border-line bg-surface text-ink`}
          >
            {t('transactions.noResults.clear')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Pie: «Mostrando 1–50 de 161» + páginas. */
export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, page * PAGE_SIZE)
  // Ventana de hasta 5 páginas alrededor de la actual.
  const start = Math.max(1, Math.min(page - 2, pages - 4))
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i)
  const circle =
    'flex size-11 items-center justify-center rounded-full border text-[13.5px] font-bold tabular-nums focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-40'
  return (
    <nav className="mt-4 flex flex-wrap items-center justify-between gap-3" aria-label="Paginación">
      <p className="text-[13px] text-ink-2">
        {t('transactions.showing')
          .replace('{from}', String(from))
          .replace('{to}', String(to))
          .replace('{total}', String(total))}
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            aria-label={t('transactions.page.prev')}
            className={`${circle} border-line bg-surface text-ink-2`}
          >
            <ChevronLeft size={16} strokeWidth={2.4} aria-hidden />
          </button>
          {nums.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPage(n)}
              aria-current={n === page ? 'page' : undefined}
              aria-label={t('transactions.page.n').replace('{n}', String(n))}
              className={`${circle} ${n === page ? 'border-transparent bg-accent text-accent-fg' : 'border-line bg-surface text-ink'}`}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => onPage(page + 1)}
            aria-label={t('transactions.page.next')}
            className={`${circle} border-line bg-surface text-ink-2`}
          >
            <ChevronRight size={16} strokeWidth={2.4} aria-hidden />
          </button>
        </div>
      )}
    </nav>
  )
}
