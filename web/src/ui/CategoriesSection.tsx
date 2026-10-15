import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColorToken } from '@savetowin/shared/types'
import { Archive, ArchiveRestore, Check, Lock, Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ApiClientError } from '../api/client'
import { createCategory, listCategories, updateCategory } from '../api/transactions'
import type { Category } from '../domain'
import { t } from '../i18n/t'
import { categoryBgClass, categoryIcon, sortCategoriesByDisplayOrder } from './categoryMeta'

const COLORS: ColorToken[] = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11', 'c12']
/** Las usa la lógica (igual que en el servidor): se renombran, pero no se archivan. */
const SYSTEM_KEYS = new Set(['Subscriptions', 'Savings transfer', 'Savings withdrawal', 'Other'])

const field =
  'h-field w-full rounded-field border border-line bg-surface px-3 text-ink focus-visible:shadow-focus focus-visible:outline-none'
const iconBtn =
  'inline-flex size-tap flex-none items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:shadow-focus focus-visible:outline-none'
const label = 'mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-ink-2'

function errorText(err: unknown): string {
  return err instanceof ApiClientError ? err.body?.error.message ?? t('common.error') : t('common.error')
}

function ColorPicker({ value, onChange }: { value: ColorToken; onChange: (c: ColorToken) => void }) {
  return (
    <div role="radiogroup" aria-label={t('categories.color')} className="flex flex-wrap gap-1.5">
      {COLORS.map((c, i) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={t('categories.colorN').replace('{n}', String(i + 1))}
          onClick={() => onChange(c)}
          className="flex size-tap items-center justify-center rounded-full focus-visible:shadow-focus focus-visible:outline-none"
        >
          <span
            className={`flex size-8 items-center justify-center rounded-full text-white ${categoryBgClass(c)} ${
              value === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
            }`}
          >
            {value === c && <Check size={15} strokeWidth={3} aria-hidden />}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Gestión de categorías: crear, renombrar, cambiar color y archivar (nunca se borran). */
export function CategoriesSection() {
  const qc = useQueryClient()
  const cats = useQuery({ queryKey: ['categories'], queryFn: listCategories })
  // null = nada abierto · 'new' = alta · id = edición
  const [formFor, setFormFor] = useState<null | 'new' | number>(null)
  const [name, setName] = useState('')
  const [color, setColor] = useState<ColorToken>('c1')
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const all = cats.data?.items ?? []
  const active = sortCategoriesByDisplayOrder(all.filter((c) => !c.archived))
  const archived = sortCategoriesByDisplayOrder(all.filter((c) => c.archived))

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ['categories'] })
    await qc.invalidateQueries({ queryKey: ['stats'] })
    setFormFor(null)
    setError(null)
  }

  const save = useMutation({
    mutationFn: () => {
      const labelText = name.trim()
      if (!labelText) throw new Error(t('accounts.nameRequired'))
      if (formFor === 'new') return createCategory({ key: labelText, label: labelText, color, type })
      return updateCategory(Number(formFor), { label: labelText, color })
    },
    onSuccess: done,
    onError: (err) => setError(err instanceof ApiClientError ? errorText(err) : (err as Error).message),
  })

  const archive = useMutation({
    mutationFn: ({ id, archived: value }: { id: number; archived: boolean }) => updateCategory(id, { archived: value }),
    onSuccess: done,
    onError: (err) => setError(errorText(err)),
  })

  function open(target: 'new' | Category) {
    setError(null)
    if (target === 'new') {
      // Color de partida: el menos usado entre las activas.
      const used = new Map(COLORS.map((c) => [c, 0]))
      for (const c of active) used.set(c.color, (used.get(c.color) ?? 0) + 1)
      setColor([...used.entries()].sort((a, b) => a[1] - b[1])[0][0])
      setName('')
      setType('expense')
      setFormFor('new')
    } else {
      setName(target.label)
      setColor(target.color)
      setFormFor(target.id)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    save.mutate()
  }

  const form = (isNew: boolean) => (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label>
        <span className={label}>{t('categories.name')}</span>
        <input
          className={field}
          value={name}
          maxLength={40}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder={t('categories.namePlaceholder')}
        />
      </label>
      {isNew && (
        <div>
          <span className={label}>{t('categories.type')}</span>
          <div role="radiogroup" className="grid grid-cols-2 gap-0.5 rounded-pill bg-surface-2 p-0.5">
            {(['expense', 'income'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={type === v}
                onClick={() => setType(v)}
                className={`h-10 rounded-pill text-[13px] focus-visible:shadow-focus focus-visible:outline-none ${
                  type === v ? 'bg-surface font-bold shadow-sm' : 'font-semibold text-ink-2'
                }`}
              >
                {v === 'expense' ? t('transactions.type.expense') : t('transactions.type.income')}
              </button>
            ))}
          </div>
        </div>
      )}
      <div>
        <span className={label}>{t('categories.color')}</span>
        <ColorPicker value={color} onChange={setColor} />
      </div>
      {error && <p className="text-[13px] font-semibold text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex h-tap items-center rounded-pill bg-accent px-5 text-sm font-bold text-accent-fg focus-visible:shadow-focus focus-visible:outline-none disabled:opacity-60"
        >
          {isNew ? t('categories.add') : t('categories.save')}
        </button>
        <button
          type="button"
          onClick={() => setFormFor(null)}
          className="inline-flex h-tap items-center rounded-pill bg-surface-2 px-4 text-sm font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
        >
          {t('categories.cancel')}
        </button>
      </div>
    </form>
  )

  const groups: { title: string; items: Category[] }[] = [
    { title: t('categories.expense'), items: active.filter((c) => c.type === 'expense') },
    { title: t('categories.income'), items: active.filter((c) => c.type === 'income') },
    { title: t('categories.savings'), items: active.filter((c) => c.type === 'savings') },
  ]

  return (
    <section className="flex flex-col gap-4" aria-labelledby="categories-title">
      <div>
        <h2 id="categories-title" className="text-[20px] font-extrabold tracking-tight">
          {t('categories.title')}
        </h2>
        <p className="mt-1 text-[13px] text-ink-2">{t('categories.hint')}</p>
      </div>
      {cats.isError && <p className="text-danger">{t('common.error')}</p>}
      {error && formFor === null && <p className="text-[13px] font-semibold text-danger">{error}</p>}

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => (
          <div key={g.title}>
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-2">{g.title}</h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((c) => {
                const Icon = categoryIcon(c.key)
                const system = SYSTEM_KEYS.has(c.key)
                if (formFor === c.id) {
                  return (
                    <li key={c.id} className="rounded-card border border-line bg-surface p-4 shadow-raised sm:col-span-2">
                      {form(false)}
                    </li>
                  )
                }
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-field border border-line bg-surface py-1.5 pl-3 pr-1.5">
                    <span className={`flex size-9 flex-none items-center justify-center rounded-icon text-white ${categoryBgClass(c.color)}`}>
                      <Icon size={17} strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold">{c.label}</span>
                      {system && (
                        <span className="flex items-center gap-1 text-[11.5px] text-ink-3">
                          <Lock size={11} strokeWidth={2.4} aria-hidden />
                          {t('categories.system')}
                        </span>
                      )}
                    </span>
                    <button type="button" onClick={() => open(c)} aria-label={`${t('categories.edit')}: ${c.label}`} className={iconBtn}>
                      <Pencil size={16} strokeWidth={2.2} aria-hidden />
                    </button>
                    {!system && (
                      <button
                        type="button"
                        aria-label={`${t('categories.archive')}: ${c.label}`}
                        disabled={archive.isPending}
                        onClick={() => {
                          if (window.confirm(t('categories.archiveConfirm').replace('{name}', c.label))) {
                            archive.mutate({ id: c.id, archived: true })
                          }
                        }}
                        className={iconBtn}
                      >
                        <Archive size={16} strokeWidth={2.2} aria-hidden />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

      {formFor === 'new' ? (
        <div className="rounded-card border border-line bg-surface p-4 shadow-raised sm:max-w-lg">{form(true)}</div>
      ) : (
        <button
          type="button"
          onClick={() => open('new')}
          className="flex h-row items-center justify-center gap-3 rounded-field border border-dashed border-line px-4 text-ink-2 hover:border-ink-3 hover:bg-surface hover:text-ink focus-visible:shadow-focus focus-visible:outline-none sm:max-w-xs"
        >
          <Plus size={18} strokeWidth={2.2} aria-hidden />
          <span className="font-semibold">{t('categories.add')}</span>
        </button>
      )}

      {archived.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="inline-flex min-h-tap items-center text-[13px] font-bold text-accent focus-visible:shadow-focus focus-visible:outline-none"
          >
            {showArchived ? t('categories.hideArchived') : t('categories.showArchived').replace('{n}', String(archived.length))}
          </button>
          {showArchived && (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {archived.map((c) => {
                const Icon = categoryIcon(c.key)
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-field border border-dashed border-line py-1.5 pl-3 pr-1.5 text-ink-2">
                    <span className={`flex size-9 flex-none items-center justify-center rounded-icon text-white opacity-60 ${categoryBgClass(c.color)}`}>
                      <Icon size={17} strokeWidth={2.2} aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{c.label}</span>
                    <button
                      type="button"
                      disabled={archive.isPending}
                      onClick={() => archive.mutate({ id: c.id, archived: false })}
                      className="inline-flex min-h-tap items-center gap-1.5 rounded-pill px-3 text-[13px] font-bold text-accent hover:bg-surface-2 focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      <ArchiveRestore size={15} strokeWidth={2.2} aria-hidden />
                      {t('categories.restore')}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
