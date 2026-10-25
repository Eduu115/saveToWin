import { formatCents } from '@savetowin/shared/money'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  CircleHelp,
  CirclePlus,
  Copy,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { createTransactionsBatch } from '../api/transactions'
import type { Account, Category } from '../domain'
import { rowWillImport, type DuplicatePolicy } from '../import/duplicatePolicy'
import type { ImportDraft } from '../import/mapRows'
import { learnRule } from '../import/rulesStore'
import { t } from '../i18n/t'
import { categoryBgClass, categoryIcon, sortCategoriesByDisplayOrder } from '../ui/categoryMeta'

type Filter = 'all' | 'review' | 'duplicates' | 'uncategorized'

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  const months = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ]
  return `${d} ${months[(m ?? 1) - 1]}`
}

export function ImportReview(props: {
  drafts: ImportDraft[]
  setDrafts: (next: ImportDraft[] | ((prev: ImportDraft[]) => ImportDraft[])) => void
  categories: Category[]
  accounts: Account[]
  learn: boolean
  setLearn: (v: boolean) => void
  onBack: () => void
  onCancel: () => void
  onDone: (result: { inserted: number; replaced: number }) => void
}) {
  const {
    drafts,
    setDrafts,
    categories,
    accounts,
    learn,
    setLearn,
    onBack,
    onCancel,
    onDone,
  } = props
  const qc = useQueryClient()
  const [filter, setFilter] = useState<Filter>('all')
  const [error, setError] = useState<string | null>(null)
  /** null = aún no ha elegido y hay duplicados. Sin duplicados no hace falta. */
  const [policy, setPolicy] = useState<DuplicatePolicy | null>(null)

  const otherId = categories.find((c) => c.key === 'Other')?.id

  const stats = useMemo(() => {
    const duplicates = drafts.filter((d) => d.duplicate).length
    const needsReview = drafts.filter(
      (d) => !d.duplicate && (d.categoryId === null || d.categoryId === otherId) && !d.autoCategorized,
    ).length
    const uncategorized = drafts.filter(
      (d) => !d.duplicate && (d.categoryId === null || d.categoryId === otherId),
    ).length
    const auto = drafts.filter((d) => !d.duplicate && d.autoCategorized).length
    const selected = drafts.filter((d) => d.selected && !d.duplicate).length
    return { duplicates, needsReview, uncategorized, auto, selected, total: drafts.length }
  }, [drafts, otherId])

  const mustChoose = stats.duplicates > 0
  const effective: DuplicatePolicy | null = mustChoose ? policy : 'skip'
  const willImport =
    effective === null ? 0 : drafts.filter((d) => rowWillImport(d, effective)).length
  const importCount = effective === null ? stats.selected : willImport

  const dupLabel =
    effective === 'replace'
      ? t('import.stat.dupesReplace')
      : effective === 'keep'
        ? t('import.stat.dupesKeep')
        : effective === 'abort'
          ? t('import.stat.dupesAbort')
          : effective === null
            ? t('import.stat.dupesFound')
            : t('import.stat.dupes')

  const visible = drafts.filter((d) => {
    if (filter === 'duplicates') return d.duplicate
    if (filter === 'review') {
      return !d.duplicate && (d.categoryId === null || (d.categoryId === otherId && !d.autoCategorized))
    }
    if (filter === 'uncategorized') {
      return !d.duplicate && (d.categoryId === null || d.categoryId === otherId)
    }
    return true
  })

  const importMut = useMutation({
    mutationFn: async () => {
      const chosen = effective
      if (!chosen || chosen === 'abort') throw new Error('EMPTY')
      const rows = drafts.filter((d) => rowWillImport(d, chosen))
      const items = rows.map((d) => ({
        date: d.date,
        amount: d.amount,
        type: d.type,
        categoryId: d.categoryId!,
        accountId: d.accountId,
        note: d.note,
      }))
      if (items.length === 0) throw new Error('EMPTY')
      return createTransactionsBatch({
        items,
        onDuplicate: chosen === 'keep' || chosen === 'replace' ? chosen : 'skip',
        skipDuplicates: chosen === 'skip',
      })
    },
    onSuccess: async (res) => {
      if (learn && effective && effective !== 'abort') {
        for (const d of drafts) {
          if (!rowWillImport(d, effective) || !d.categoryId) continue
          const cat = categories.find((c) => c.id === d.categoryId)
          if (cat) learnRule(d.raw, cat.key)
        }
      }
      await qc.invalidateQueries({ queryKey: ['transactions'] })
      await qc.invalidateQueries({ queryKey: ['stats'] })
      onDone({ inserted: res.inserted, replaced: res.replaced })
    },
    onError: () => setError(t('import.error.batch')),
  })

  function setCategory(localId: string, categoryId: number) {
    const cat = categories.find((c) => c.id === categoryId)
    setDrafts((prev) =>
      prev.map((d) =>
        d.localId === localId
          ? {
              ...d,
              categoryId,
              categoryKey: cat?.key ?? null,
              autoCategorized: false,
            }
          : d,
      ),
    )
  }

  function toggle(localId: string) {
    setDrafts((prev) =>
      prev.map((d) =>
        d.localId === localId && !d.duplicate ? { ...d, selected: !d.selected } : d,
      ),
    )
  }

  const accountLabel = (id: number) => accounts.find((a) => a.id === id)?.name ?? '—'

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-[12.5px] font-semibold text-ink-2"
        >
          {t('import.cancel')}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<CirclePlus className="size-[19px]" strokeWidth={2.2} />}
          iconClass="bg-savings-weak text-savings"
          value={String(importCount)}
          label={mustChoose ? t('import.stat.willImport') : t('import.stat.new')}
        />
        <StatCard
          icon={<Copy className="size-[19px]" strokeWidth={2.2} />}
          iconClass="bg-surface-2 text-ink-2"
          value={String(stats.duplicates)}
          label={dupLabel}
        />
        <StatCard
          icon={<TriangleAlert className="size-[19px]" strokeWidth={2.2} />}
          iconClass="bg-warn-weak text-warn"
          value={String(stats.needsReview)}
          label={t('import.stat.review')}
          warn
        />
        <StatCard
          icon={<WandSparkles className="size-[19px]" strokeWidth={2.2} />}
          iconClass="bg-accent-weak text-accent"
          value={`${stats.auto}`}
          suffix={` ${t('import.stat.of')} ${stats.total - stats.duplicates}`}
          label={t('import.stat.auto')}
        />
      </div>

      {mustChoose && (
        <div className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface px-5 py-4">
          <h2 id="dup-policy-title" className="text-[15px] font-bold">
            {t('import.dup.title')}
          </h2>
          <p className="text-[12.5px] leading-relaxed text-ink-2">{t('import.dup.hint')}</p>
          <div role="radiogroup" aria-labelledby="dup-policy-title" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['skip', t('import.dup.skip'), t('import.dup.skipHint')],
                ['replace', t('import.dup.replace'), t('import.dup.replaceHint')],
                ['keep', t('import.dup.keep'), t('import.dup.keepHint')],
                ['abort', t('import.dup.abort'), t('import.dup.abortHint')],
              ] as const
            ).map(([id, title, hint]) => {
              const on = policy === id
              const aborting = id === 'abort'
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPolicy(id)}
                  className={[
                    'flex min-h-tap flex-col items-start gap-0.5 rounded-2xl border px-3.5 py-3 text-left',
                    on
                      ? aborting
                        ? 'border-2 border-danger bg-danger-weak'
                        : 'border-2 border-accent bg-accent-weak'
                      : 'border-line bg-bg',
                  ].join(' ')}
                >
                  <span className={`text-[13.5px] font-bold ${on && aborting ? 'text-danger' : ''}`}>
                    {title}
                  </span>
                  <span className="text-[12px] leading-snug text-ink-2">{hint}</span>
                </button>
              )
            })}
          </div>
          {effective === 'skip' && willImport === 0 && stats.duplicates === stats.total && (
            <p className="text-[12.5px] font-semibold text-warn">{t('import.dup.allSkip')}</p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-[20px] border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3.5">
          <span className="text-[15px] font-bold">{t('import.preview')}</span>
          <div className="flex-1" />
          {(
            [
              ['all', `${t('import.filter.all')} ${stats.total}`],
              ['review', `${t('import.filter.review')} ${stats.needsReview}`],
              ['duplicates', `${t('import.filter.dupes')} ${stats.duplicates}`],
              ['uncategorized', `${t('import.filter.uncat')} ${stats.uncategorized}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={[
                'rounded-full px-3 py-2 text-[11.5px] font-bold',
                filter === key
                  ? key === 'review'
                    ? 'bg-warn-weak text-warn'
                    : 'bg-ink text-accent-fg'
                  : 'bg-surface-2 font-semibold text-ink-2',
              ].join(' ')}
            >
              {key === 'review' && filter !== 'review' ? (
                <span className="inline-flex items-center gap-1">
                  <TriangleAlert className="size-[13px]" strokeWidth={2.6} />
                  {label}
                </span>
              ) : key === 'duplicates' && filter !== 'duplicates' ? (
                <span className="inline-flex items-center gap-1">
                  <Copy className="size-[13px]" strokeWidth={2.6} />
                  {label}
                </span>
              ) : key === 'uncategorized' && filter !== 'uncategorized' ? (
                <span className="inline-flex items-center gap-1">
                  <CircleHelp className="size-[13px]" strokeWidth={2.6} />
                  {label}
                </span>
              ) : (
                label
              )}
            </button>
          ))}
        </div>

        <div className="hidden grid-cols-[44px_92px_1fr_210px_150px_130px] items-center border-b border-line px-5 text-[10.5px] font-semibold tracking-[0.07em] text-ink-3 md:grid md:h-[42px]">
          <span />
          <span>{t('import.col.date')}</span>
          <span>{t('import.col.desc')}</span>
          <span>{t('import.col.cat')}</span>
          <span>{t('import.col.account')}</span>
          <span className="text-right">{t('import.col.amount')}</span>
        </div>

        <div className="max-h-[min(60vh,520px)] overflow-auto">
          {visible.map((d) => {
            const cat = categories.find((c) => c.id === d.categoryId)
            const Icon = cat ? categoryIcon(cat.key) : null
            const needsEyes =
              !d.duplicate && (d.categoryId === null || (d.categoryId === otherId && !d.autoCategorized))
            const faded =
              d.duplicate && (effective === 'skip' || effective === 'abort' || effective === null)
            const showCheck =
              effective === 'abort'
                ? false
                : d.duplicate
                  ? effective === 'replace' || effective === 'keep'
                  : d.selected
            const dupText =
              effective === 'replace'
                ? t('import.dup.badge.replace')
                : effective === 'keep'
                  ? t('import.dup.badge.keep')
                  : effective === 'abort'
                    ? t('import.dup.badge.abort')
                    : effective === 'skip'
                      ? t('import.dup.badge.skip')
                      : t('import.alreadyExists')
            return (
              <div
                key={d.localId}
                className={[
                  'grid grid-cols-1 items-center gap-2 border-b border-line-grid px-5 py-3 md:grid-cols-[44px_92px_1fr_210px_150px_130px] md:gap-0 md:py-0 md:h-14',
                  faded ? 'opacity-50' : '',
                  needsEyes ? 'bg-warn-weak' : d.type === 'income' ? 'bg-income-weak' : '',
                ].join(' ')}
              >
                <button
                  type="button"
                  disabled={d.duplicate}
                  onClick={() => toggle(d.localId)}
                  className={[
                    'flex size-[18px] items-center justify-center rounded-[5px] disabled:opacity-100',
                    !showCheck
                      ? 'border-[1.5px] border-line'
                      : needsEyes
                        ? 'bg-warn text-white'
                        : d.type === 'income'
                          ? 'bg-income text-white'
                          : 'bg-accent text-accent-fg',
                  ].join(' ')}
                  aria-label={t('import.toggleRow')}
                >
                  {showCheck && <Check className="size-3" strokeWidth={3} />}
                </button>
                <span className="text-[13px] tabular-nums text-ink-2">{formatShortDate(d.date)}</span>
                <div className="flex min-w-0 flex-col gap-0.5 pr-2">
                  <span
                    className={`truncate text-[13px] font-semibold ${faded ? 'line-through' : ''}`}
                  >
                    {d.title}
                  </span>
                  {d.duplicate ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-ink-2">
                      <Copy className="size-[11px]" strokeWidth={2.8} />
                      {dupText}
                    </span>
                  ) : needsEyes ? (
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-warn">
                      <TriangleAlert className="size-[11px]" strokeWidth={2.8} />
                      {t('import.neverSeen')}
                    </span>
                  ) : (
                    <span className="truncate font-mono text-[10.5px] text-ink-3">{d.raw}</span>
                  )}
                </div>
                {faded && cat ? (
                  <span className="flex items-center gap-2 text-[12.5px]">
                    <span
                      className={`flex size-[22px] items-center justify-center rounded-[7px] text-white ${categoryBgClass(cat.color)}`}
                    >
                      {Icon && <Icon className="size-3" strokeWidth={2.4} />}
                    </span>
                    {cat.label}
                  </span>
                ) : (
                  <label
                    className={[
                      'relative mr-3 flex h-[38px] items-center gap-2 rounded-[11px] px-2.5',
                      needsEyes
                        ? 'border-2 border-warn bg-surface'
                        : 'border border-line bg-bg',
                    ].join(' ')}
                  >
                    {cat && Icon && (
                      <span
                        className={`flex size-[22px] shrink-0 items-center justify-center rounded-[7px] text-white ${categoryBgClass(cat.color)}`}
                      >
                        <Icon className="size-3" strokeWidth={2.4} />
                      </span>
                    )}
                    <select
                      className={`h-full w-full appearance-none bg-transparent text-[12.5px] outline-none ${needsEyes ? 'font-semibold text-warn' : ''}`}
                      value={d.categoryId ?? ''}
                      onChange={(e) => setCategory(d.localId, Number(e.target.value))}
                    >
                      <option value="">{t('import.pickCategory')}</option>
                      {sortCategoriesByDisplayOrder(
                        categories.filter((c) => !c.archived && c.type === 'expense'),
                      ).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <span className="text-[13px] text-ink-2">{accountLabel(d.accountId)}</span>
                <span
                  className={[
                    'text-right text-[13px] font-bold tabular-nums',
                    faded ? 'line-through' : '',
                    d.type === 'income' ? 'text-income' : '',
                  ].join(' ')}
                >
                  {d.type === 'income' ? '+ ' : '− '}
                  {formatCents(d.amount)}
                </span>
              </div>
            )
          })}
          {visible.length === 0 && (
            <p className="px-5 py-8 text-center text-[13px] text-ink-3">{t('import.emptyFilter')}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => setLearn(!learn)}
          className="flex items-center gap-2.5 text-left"
          aria-pressed={learn}
        >
          <span
            className={[
              'flex h-[26px] w-11 shrink-0 items-center rounded-full p-[3px]',
              learn ? 'justify-end bg-accent' : 'justify-start bg-surface-2',
            ].join(' ')}
          >
            <span className="size-5 rounded-full bg-surface" />
          </span>
          <span className="text-[13px] font-semibold">{t('import.learn')}</span>
          <span className="hidden text-[12px] text-ink-2 md:inline">{t('import.learnHint')}</span>
        </button>
        <div className="flex-1" />
        {error && (
          <p className="text-[13px] font-medium text-danger" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={onBack}
          className="flex h-[52px] items-center justify-center rounded-[15px] border border-line bg-surface px-5 text-[13.5px] font-semibold text-ink-2"
        >
          {t('import.back')}
        </button>
        <button
          type="button"
          disabled={
            importMut.isPending ||
            effective === null ||
            (effective !== 'abort' && willImport === 0)
          }
          onClick={() => {
            setError(null)
            if (effective === 'abort') {
              onCancel()
              return
            }
            importMut.mutate()
          }}
          className={[
            'inline-flex h-[52px] items-center justify-center gap-2 rounded-[15px] px-6 text-[14px] font-bold disabled:opacity-40',
            effective === 'abort'
              ? 'bg-danger text-white'
              : 'bg-accent text-accent-fg shadow-accent',
          ].join(' ')}
        >
          {effective === 'abort' ? (
            t('import.confirmAbort')
          ) : effective === null ? (
            t('import.dup.choose')
          ) : (
            <>
              <Check className="size-[18px]" strokeWidth={2.6} />
              {t('import.confirm')} {willImport} {t('import.confirmSuffix')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function StatCard(props: {
  icon: ReactNode
  iconClass: string
  value: string
  suffix?: string
  label: string
  warn?: boolean
}) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-2xl border px-[18px] py-4',
        props.warn ? 'border-[color:var(--warn-border)] bg-warn-weak' : 'border-line bg-surface',
      ].join(' ')}
    >
      <span
        className={`flex size-[38px] shrink-0 items-center justify-center rounded-xl ${props.iconClass}`}
      >
        {props.icon}
      </span>
      <div className="flex flex-col gap-1">
        <span
          className={`text-[22px] font-extrabold tabular-nums ${props.warn ? 'text-warn' : ''}`}
        >
          {props.value}
          {props.suffix && (
            <span className="text-[13px] font-semibold text-ink-2">{props.suffix}</span>
          )}
        </span>
        <span className={`text-xs font-medium ${props.warn ? 'text-warn' : 'text-ink-2'}`}>
          {props.label}
        </span>
      </div>
    </div>
  )
}
