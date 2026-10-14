import { formatCents, parseAmountToCents } from '@savetowin/shared/money'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Car,
  Check,
  CircleAlert,
  Gamepad2,
  Heart,
  House,
  Link2,
  type LucideIcon,
  MoreVertical,
  PartyPopper,
  Plane,
  Plus,
  Shapes,
  Shield,
  Shirt,
  Trash2,
  TriangleAlert,
  Utensils,
  X,
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { ApiClientError } from '../api/client'
import { listCategories } from '../api/transactions'
import type { Category } from '../domain'
import { t } from '../i18n/t'
import { categoryBgClass, categoryCssVar, categoryIcon, sortCategoriesByDisplayOrder } from '../ui/categoryMeta'
import {
  createGroup,
  deleteGroup,
  fetchGroups,
  type Group,
  type GroupIcon,
  type GroupInput,
  updateGroup,
} from './api'
import { tp } from './i18n'

export const GROUP_ICONS: Record<GroupIcon, LucideIcon> = {
  shapes: Shapes,
  party: PartyPopper,
  shield: Shield,
  home: House,
  car: Car,
  utensils: Utensils,
  plane: Plane,
  heart: Heart,
  gamepad: Gamepad2,
  shirt: Shirt,
}

function centsToInput(cents: number | null): string {
  if (cents == null) return ''
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`
}

function StatusPill({ status }: { status: Group['status'] }) {
  if (status === 'over') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-danger px-2 py-1 text-[10.5px] font-bold text-white">
        <CircleAlert size={12} strokeWidth={2.6} aria-hidden />
        {tp('gr.status.over')}
      </span>
    )
  }
  if (status === 'tight') {
    return (
      <span className="inline-flex items-center gap-1 rounded-pill bg-warn-weak px-2 py-1 text-[10.5px] font-bold text-warn">
        <TriangleAlert size={12} strokeWidth={2.6} aria-hidden />
        {tp('gr.status.tight')}
      </span>
    )
  }
  return null
}

/** Directions 6a — tarjeta de una regla que cubre varias categorías. */
function GroupCard({
  group,
  cats,
  remainingDays,
  onEdit,
}: {
  group: Group
  cats: Map<number, Category>
  remainingDays: number
  onEdit: () => void
}) {
  const Icon = GROUP_ICONS[group.icon] ?? Shapes
  const members = group.categoryIds.map((id) => cats.get(id)).filter((c): c is Category => c != null)
  const limit = group.limitCents
  const over = limit != null && group.spentCents > limit
  const withinPct = limit ? Math.min(100, (Math.min(group.spentCents, limit) * 100) / Math.max(group.spentCents, limit)) : 0
  const overPct = over && limit ? 100 - (limit * 100) / group.spentCents : 0
  const left = limit != null ? limit - group.spentCents : 0
  const barColor = members[0] ? categoryCssVar(members[0].color) : 'var(--accent)'
  const histMax = Math.max(1, ...group.history.map((h) => h.cents), limit ?? 0)

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className={`flex w-full flex-col gap-3 rounded-card border bg-surface p-4 text-left shadow-raised focus-visible:shadow-focus focus-visible:outline-none sm:flex-row sm:items-center sm:gap-5 ${
          over ? 'border-danger' : 'border-line'
        }`}
      >
        <div className="flex min-w-0 items-center gap-3 sm:w-[15rem] sm:flex-none">
          <span className={`flex size-11 flex-none items-center justify-center rounded-tile ${over ? 'bg-danger-weak text-danger' : 'bg-surface-2 text-ink-2'}`}>
            <Icon size={20} strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-bold">{group.name}</span>
              <StatusPill status={group.status} />
            </div>
            <div className="mt-1 flex items-center gap-1">
              {members.slice(0, 5).map((c) => {
                const CI = categoryIcon(c.key)
                return (
                  <span key={c.id} title={c.label} className={`flex size-5 items-center justify-center rounded-[6px] text-white ${categoryBgClass(c.color)}`}>
                    <CI size={11} strokeWidth={2.4} aria-hidden />
                  </span>
                )
              })}
              <span className="ml-1 text-[11.5px] text-ink-3">
                {members.length === 1 ? tp('gr.category') : tp('gr.categories', { n: members.length })}
              </span>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {limit != null ? (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-pill bg-track">
                <div className="h-full" style={{ width: `${over ? 100 - overPct : withinPct}%`, background: barColor }} />
                {over && <div className="h-full bg-danger" style={{ width: `${overPct}%` }} />}
              </div>
              <p className={`mt-1.5 text-[11.5px] font-medium ${over ? 'text-danger' : 'text-ink-2'}`}>
                {over
                  ? `${formatCents(-left)} ${tp('gr.over')}`
                  : `${formatCents(left)} ${tp('gr.left')}${
                      remainingDays > 0 ? ` · ${tp('gr.perDay', { amount: formatCents(Math.floor(left / remainingDays)) })}` : ''
                    }`}
              </p>
            </>
          ) : (
            <p className="text-[11.5px] font-medium text-ink-3">{tp('gr.tracking')}</p>
          )}
          {/* Mini histórico de 6 meses */}
          <div className="mt-2 flex h-6 items-end gap-1" aria-hidden>
            {group.history.map((h, i) => (
              <span
                key={h.period}
                className="w-full rounded-[3px]"
                style={{
                  height: `${Math.max(8, (h.cents * 100) / histMax)}%`,
                  background: i === group.history.length - 1 ? barColor : 'var(--track)',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <span className={`whitespace-nowrap text-[15px] font-extrabold tabular-nums ${over ? 'text-danger' : ''}`}>
            {formatCents(group.spentCents)}
            {limit != null && <span className="font-semibold text-ink-3"> / {formatCents(limit)}</span>}
          </span>
          <MoreVertical size={16} className="text-ink-3" aria-hidden />
        </div>
      </button>
    </li>
  )
}

/** Directions 6c — hoja de crear/editar agrupación. */
function GroupSheet({
  group,
  categories,
  groups,
  onClose,
}: {
  group: Group | null
  categories: Category[]
  groups: Group[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [name, setName] = useState(group?.name ?? '')
  const [icon, setIcon] = useState<GroupIcon>(group?.icon ?? 'shapes')
  const [limit, setLimit] = useState(centsToInput(group?.limitCents ?? null))
  const [warn, setWarn] = useState((group?.warnPercent ?? 80) < 100)
  const [selected, setSelected] = useState<Set<number>>(new Set(group?.categoryIds ?? []))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const inOthers = new Set(groups.filter((g) => g.id !== group?.id).flatMap((g) => g.categoryIds))
  const overlap = categories.filter((c) => selected.has(c.id) && inOthers.has(c.id))

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ['pro', 'groups'] })
    onClose()
  }
  const save = useMutation({
    mutationFn: (body: GroupInput) => (group ? updateGroup(group.id, body) : createGroup(body)),
    onSuccess: done,
    onError: (err) =>
      setError(err instanceof ApiClientError ? (err.body?.error.message ?? t('common.error')) : t('common.error')),
  })
  const remove = useMutation({ mutationFn: () => deleteGroup(group!.id), onSuccess: done })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    let limitCents: number | null = null
    if (limit.trim()) {
      try {
        limitCents = parseAmountToCents(limit)
      } catch {
        setError(t('budgets.invalidAmount'))
        return
      }
    }
    save.mutate({
      name: name.trim(),
      icon,
      limitCents: limitCents && limitCents > 0 ? limitCents : null,
      warnPercent: warn ? 80 : 100,
      categoryIds: [...selected],
    })
  }

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="sheet-in flex max-h-dvh w-full flex-col overflow-hidden rounded-t-sheet bg-surface shadow-raised sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-sheet"
      >
        <div className="flex-none bg-accent px-5 pb-5 pt-4 text-accent-fg">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">{group ? tp('gr.edit') : tp('gr.new')}</h2>
            <div className="flex gap-2">
              {group && (
                <button
                  type="button"
                  aria-label={tp('gr.form.delete')}
                  onClick={() => window.confirm(tp('gr.form.deleteConfirm')) && remove.mutate()}
                  className="inline-flex size-tap items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--on-accent)_15%,transparent)] focus-visible:shadow-focus focus-visible:outline-none"
                >
                  <Trash2 size={17} strokeWidth={2.2} aria-hidden />
                </button>
              )}
              <button
                type="button"
                aria-label={tp('gr.form.close')}
                onClick={onClose}
                className="inline-flex size-tap items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--on-accent)_15%,transparent)] focus-visible:shadow-focus focus-visible:outline-none"
              >
                <X size={18} strokeWidth={2.2} aria-hidden />
              </button>
            </div>
          </div>
          <label className="mt-3 flex items-baseline justify-center gap-1">
            <span className="sr-only">{tp('gr.form.limit')}</span>
            <input
              inputMode="decimal"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder={tp('gr.form.noLimit')}
              size={limit ? Math.max(3, limit.length + 1) : 10}
              className="min-w-0 max-w-full bg-transparent text-center text-[40px] font-extrabold leading-none tracking-tight tabular-nums placeholder:text-[22px] placeholder:font-bold placeholder:text-accent-fg placeholder:opacity-60 focus-visible:outline-none"
            />
            {limit && <span className="text-xl font-bold opacity-70">€</span>}
          </label>
          <p className="mt-1 text-center text-[11.5px] font-semibold text-accent-fg opacity-75">{tp('gr.form.limit')}</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <label className="flex h-[52px] items-center gap-3 rounded-tile border border-line px-3 focus-within:shadow-focus">
            <span className="flex size-8 flex-none items-center justify-center rounded-icon bg-accent-weak text-accent">
              {(() => {
                const I = GROUP_ICONS[icon]
                return <I size={16} strokeWidth={2.2} aria-hidden />
              })()}
            </span>
            <span className="sr-only">{tp('gr.form.name')}</span>
            <input
              required
              maxLength={40}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tp('gr.form.namePh')}
              className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold placeholder:font-normal placeholder:text-ink-3 focus-visible:outline-none"
            />
          </label>

          <fieldset>
            <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-2">{tp('gr.form.icon')}</legend>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(GROUP_ICONS) as GroupIcon[]).map((k) => {
                const I = GROUP_ICONS[k]
                const on = k === icon
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    aria-label={k}
                    onClick={() => setIcon(k)}
                    className={`inline-flex size-11 items-center justify-center rounded-tile border focus-visible:shadow-focus focus-visible:outline-none ${
                      on ? 'border-accent bg-accent-weak text-accent' : 'border-line text-ink-2'
                    }`}
                  >
                    <I size={18} strokeWidth={2.2} aria-hidden />
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <div className="mb-2 flex items-center justify-between">
              <legend className="text-[11px] font-bold uppercase tracking-wide text-ink-2">{tp('gr.form.covers')}</legend>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setSelected(new Set(categories.map((c) => c.id)))} className="inline-flex h-8 items-center rounded-pill bg-accent-weak px-3 text-[12px] font-semibold text-accent focus-visible:shadow-focus focus-visible:outline-none">
                  {tp('gr.form.all')}
                </button>
                <button type="button" onClick={() => setSelected(new Set())} className="inline-flex h-8 items-center rounded-pill bg-surface-2 px-3 text-[12px] font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none">
                  {tp('gr.form.clear')}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {categories.map((c) => {
                const I = categoryIcon(c.key)
                const on = selected.has(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    className={`relative flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-tile border px-1 py-2 text-[11px] font-semibold leading-tight focus-visible:shadow-focus focus-visible:outline-none ${
                      on ? `border-transparent text-white ${categoryBgClass(c.color)}` : 'border-line bg-surface text-ink-2'
                    }`}
                  >
                    {on && (
                      <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-surface text-ink">
                        <Check size={10} strokeWidth={3} aria-hidden />
                      </span>
                    )}
                    {!on && inOthers.has(c.id) && <Link2 size={11} className="absolute right-1.5 top-1.5 text-ink-3" aria-hidden />}
                    <I size={18} strokeWidth={2.2} aria-hidden style={on ? undefined : { color: categoryCssVar(c.color) }} />
                    <span className="line-clamp-2 text-center">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          {overlap.length > 0 && (
            <p className="flex gap-2 rounded-tile bg-surface-2 px-3.5 py-3 text-[12.5px] text-ink-2">
              <Link2 size={15} className="mt-0.5 flex-none" aria-hidden />
              {tp('gr.form.overlap', { names: overlap.map((c) => c.label).join(', ') })}
            </p>
          )}

          <label className="flex min-h-[52px] items-center justify-between gap-3 rounded-tile border border-line px-4">
            <span className="text-[13.5px] font-semibold">{tp('gr.form.warn')}</span>
            <input type="checkbox" checked={warn} onChange={(e) => setWarn(e.target.checked)} className="size-5 accent-[var(--accent)]" />
          </label>
        </div>

        <div className="flex-none px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
          {error && <p className="mb-2 text-sm text-danger">{error}</p>}
          <button
            type="submit"
            disabled={save.isPending || selected.size === 0 || !name.trim()}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-tile bg-accent text-[15px] font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-50"
          >
            <Check size={18} strokeWidth={2.4} aria-hidden />
            {group ? tp('gr.form.save', { n: selected.size }) : tp('gr.form.create', { n: selected.size })}
          </button>
        </div>
      </form>
    </div>
  )
}

export function GroupsTab({ period }: { period: string }) {
  const q = useQuery({ queryKey: ['pro', 'groups', period], queryFn: () => fetchGroups(period) })
  const cats = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  const [editing, setEditing] = useState<Group | null | 'new'>(null)

  const expenseCats = sortCategoriesByDisplayOrder(
    (cats.data?.items ?? []).filter((c) => c.type === 'expense' && !c.archived),
  )
  const catMap = new Map((cats.data?.items ?? []).map((c) => [c.id, c]))
  const items = q.data?.items ?? []
  const groupName = new Map(items.map((g) => [g.id, g.name]))
  const watched = (q.data?.coverage ?? []).filter((c) => c.groupIds.length > 0)
  const unwatched = (q.data?.coverage ?? []).filter((c) => c.groupIds.length === 0)

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-3">
      <div className="flex flex-col gap-3">
        {q.isPending && <p className="text-ink-2">{t('common.loading')}</p>}
        {q.isError && <p className="text-danger">{t('common.error')}</p>}
        {q.data && (
          <p className="text-[12.5px] font-medium text-ink-2">
            {items.length === 0 ? tp('gr.empty') : tp('gr.summary', { n: items.length })}
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {items.map((g) => (
            <GroupCard key={g.id} group={g} cats={catMap} remainingDays={q.data?.remainingDays ?? 0} onEdit={() => setEditing(g)} />
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="flex min-h-[72px] w-full items-center gap-4 rounded-card border border-dashed border-line px-5 text-left text-ink-2 hover:bg-surface focus-visible:shadow-focus focus-visible:outline-none"
        >
          <span className="flex size-10 flex-none items-center justify-center rounded-tile bg-surface-2">
            <Plus size={19} strokeWidth={2} aria-hidden />
          </span>
          <span>
            <span className="block font-semibold text-ink">{tp('gr.new')}</span>
            <span className="block text-[12px]">{tp('gr.newHint')}</span>
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <section className="rounded-card border border-line bg-surface p-5">
          <h3 className="text-[15px] font-bold">{tp('gr.coverage.title')}</h3>
          <p className="mb-3 text-[12px] text-ink-2">{tp('gr.coverage.hint')}</p>
          <ul className="flex flex-col gap-2.5">
            {watched.map((c) => {
              const cat = catMap.get(c.categoryId)
              if (!cat) return null
              const I = categoryIcon(cat.key)
              return (
                <li key={c.categoryId} className="flex items-center gap-2.5 text-[13px]">
                  <span className={`flex size-7 flex-none items-center justify-center rounded-icon text-white ${categoryBgClass(cat.color)}`}>
                    <I size={14} strokeWidth={2.2} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{cat.label}</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    {c.groupIds.map((id) => (
                      <span key={id} className="rounded-pill bg-surface-2 px-2 py-0.5 text-[10.5px] font-bold text-ink-2">
                        {groupName.get(id)}
                      </span>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
        {unwatched.length > 0 && (
          <section className="rounded-card border border-line bg-surface p-5">
            <h3 className="mb-2 text-[15px] font-bold">{tp('gr.unwatched.title')}</h3>
            <div className="flex flex-wrap gap-1.5">
              {unwatched.map((c) => {
                const cat = catMap.get(c.categoryId)
                if (!cat) return null
                return (
                  <span key={c.categoryId} className="inline-flex h-8 items-center gap-1.5 rounded-pill border border-line px-3 text-[12px] font-semibold text-ink-2">
                    <span className="size-2 rounded-full" style={{ background: categoryCssVar(cat.color) }} aria-hidden />
                    {cat.label}
                  </span>
                )
              })}
            </div>
            <p className="mt-2 text-[11.5px] text-ink-3">{tp('gr.unwatched.hint')}</p>
          </section>
        )}
      </div>

      {editing && (
        <GroupSheet
          group={editing === 'new' ? null : editing}
          categories={expenseCats}
          groups={items}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
