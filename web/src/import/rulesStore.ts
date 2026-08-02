import type { CategoryRule } from '@savetowin/shared/categorize'

const KEY = 'savetowin.categoryRules'

export function loadLearnedRules(): CategoryRule[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CategoryRule[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Guarda patrón (minúsculas) → categoryKey; el más reciente gana al buscar. */
export function learnRule(pattern: string, categoryKey: string): void {
  const p = pattern.trim().toLowerCase()
  if (p.length < 3) return
  const list = loadLearnedRules().filter((r) => r.pattern.toLowerCase() !== p)
  list.unshift({ pattern: p, categoryKey })
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200)))
}
