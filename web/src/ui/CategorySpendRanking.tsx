import { formatCents } from '@savetowin/shared/money'
import type { CategorySpend } from '../api/stats'
import { categoryBgClass, categoryCssVar, categoryIcon } from './categoryMeta'

/** Directions 1b / 11a — ranking horizontal (mejor que donut con nombres largos). */
export function CategorySpendRanking({
  items,
  maxItems = 5,
}: {
  items: CategorySpend[]
  maxItems?: number
}) {
  const top = items.slice(0, maxItems)
  const max = top[0]?.expenseCents ?? 0
  if (top.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {top.map((row) => {
        const Icon = categoryIcon(row.key)
        const pct = max > 0 ? Math.round((row.expenseCents * 100) / max) : 0
        return (
          <div key={row.key} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2.5 text-[12.5px] font-medium">
              <span
                className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] text-white ${categoryBgClass(row.color)}`}
              >
                <Icon size={13} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="flex-1 truncate">{row.label}</span>
              <span className="font-bold tabular-nums">{formatCents(row.expenseCents)}</span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-pill bg-track">
              <div
                className="h-full rounded-pill"
                style={{
                  width: `${pct}%`,
                  background: categoryCssVar(row.color),
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
