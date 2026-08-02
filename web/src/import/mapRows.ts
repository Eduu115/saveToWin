import { parseAmountToCents } from '@savetowin/shared/money'
import { suggestCategoryKey, FALLBACK_CATEGORY_KEY, type CategoryRule } from '@savetowin/shared/categorize'
import type { ColumnRole, DateFormat, DecimalStyle, ParsedCsv } from './types'

export type ImportDraft = {
  localId: string
  date: string
  /** Título limpio para UI */
  title: string
  /** Texto crudo del banco (concepto) */
  raw: string
  /** Nota persistida (= raw + extra) */
  note: string
  amount: number
  type: 'expense' | 'income'
  categoryId: number | null
  categoryKey: string | null
  autoCategorized: boolean
  accountId: number
  selected: boolean
  duplicate: boolean
}

function roleIndex(roles: ColumnRole[], role: ColumnRole): number {
  return roles.indexOf(role)
}

export function parseImportDate(raw: string, format: DateFormat): string | null {
  const s = raw.trim()
  if (!s) return null
  if (format === 'yyyy-mm-dd') {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    return `${m[1]}-${m[2]}-${m[3]}`
  }
  const sep = format === 'dd-mm-yyyy' ? '-' : '/'
  const m = s.match(new RegExp(`^(\\d{1,2})\\${sep}(\\d{1,2})\\${sep}(\\d{2,4})`))
  if (!m) return null
  let y = Number(m[3])
  if (y < 100) y += 2000
  const month = String(m[2]).padStart(2, '0')
  const day = String(m[1]).padStart(2, '0')
  return `${y}-${month}-${day}`
}

/** Devuelve céntimos con signo (negativo = gasto en CSV firmado). */
export function parseImportAmountSigned(raw: string, decimal: DecimalStyle): number | null {
  let s = raw.trim().replace(/\u00a0/g, ' ').replace(/\s/g, '').replace(/€/g, '')
  if (!s) return null
  let sign = 1
  if (s[0] === '-') {
    sign = -1
    s = s.slice(1)
  } else if (s[0] === '+') {
    s = s.slice(1)
  }
  try {
    if (decimal === 'point') {
      // 1,234.56 o 64.32
      if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '')
      else s = s.replace(/,/g, '')
      const [w, f = ''] = s.split('.')
      if (!/^\d+$/.test(w) || (f && !/^\d{1,2}$/.test(f))) return null
      const cents = Number(w) * 100 + Number(f.padEnd(2, '0') || '0')
      return sign * cents
    }
    return sign * Math.abs(parseAmountToCents(s))
  } catch {
    return null
  }
}

const NOISE =
  /^(compra|recibo|pago|transferencia|traspaso|bizum|tpv|card|tarjeta)\s+/i

export function cleanTitle(raw: string): string {
  let s = raw.trim().replace(/\s+/g, ' ')
  s = s.replace(NOISE, '')
  if (!s) return raw.trim() || '—'
  return s
    .toLowerCase()
    .split(' ')
    .map((w) => (w.length <= 2 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join(' ')
}

export function dupKey(date: string, amount: number, note: string): string {
  return `${date}|${amount}|${note.trim().toLowerCase()}`
}

export function buildImportDrafts(opts: {
  parsed: ParsedCsv
  roles: ColumnRole[]
  accountId: number
  categoriesByKey: Map<string, number>
  otherCategoryId: number
  learned: CategoryRule[]
  existingKeys: Set<string>
}): ImportDraft[] {
  const { parsed, roles, accountId, categoriesByKey, otherCategoryId, learned, existingKeys } =
    opts
  const iDate = roleIndex(roles, 'date')
  const iDesc = roleIndex(roles, 'description')
  const iAmount = roleIndex(roles, 'amount')
  const iNote = roleIndex(roles, 'note')
  if (iDate < 0 || iAmount < 0) return []

  const out: ImportDraft[] = []
  let n = 0
  for (const row of parsed.rows) {
    const date = parseImportDate(row[iDate] ?? '', parsed.detection.dateFormat)
    const signed = parseImportAmountSigned(row[iAmount] ?? '', parsed.detection.decimal)
    if (!date || signed === null || signed === 0) continue

    const rawDesc = (row[iDesc] ?? '').trim()
    const extra = iNote >= 0 ? (row[iNote] ?? '').trim() : ''
    const raw = [rawDesc, extra].filter(Boolean).join(' · ') || '—'
    const amount = Math.abs(signed)
    const type: 'expense' | 'income' = signed < 0 ? 'expense' : 'income'
    const note = raw

    const suggested = suggestCategoryKey(raw, learned)
    const key = suggested ?? FALLBACK_CATEGORY_KEY
    const categoryId = categoriesByKey.get(key) ?? otherCategoryId
    const autoCategorized = suggested !== null

    const duplicate = existingKeys.has(dupKey(date, amount, note))

    out.push({
      localId: `r${n++}`,
      date,
      title: cleanTitle(rawDesc || raw),
      raw,
      note,
      amount,
      type,
      categoryId,
      categoryKey: key,
      autoCategorized,
      accountId,
      selected: !duplicate,
      duplicate,
    })
  }
  return out
}
