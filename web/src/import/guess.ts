import type { ColumnRole, CsvDelimiter, DateFormat, DecimalStyle } from './types'

export function normalizeHeader(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function includesAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => hay.includes(n))
}

/** Adivina el rol de una cabecera (ES/EN bancos). */
export function guessRole(header: string): ColumnRole {
  const h = normalizeHeader(header)

  if (includesAny(h, ['saldo', 'balance', 'disponib'])) return 'ignore'
  // Fecha valor suele ser secundaria frente a fecha operación
  if (includesAny(h, ['fecha valor', 'value date', 'f. valor', 'f valor'])) return 'ignore'

  if (
    includesAny(h, [
      'fecha oper',
      'fecha',
      'date',
      'booking',
      'f.oper',
      'f oper',
      'valuedate',
    ])
  ) {
    return 'date'
  }

  if (
    includesAny(h, [
      'importe',
      'amount',
      'cantidad',
      'euros',
      'cargo',
      'abono',
      'debe',
      'haber',
    ])
  ) {
    return 'amount'
  }

  if (
    includesAny(h, [
      'concepto',
      'descrip',
      'detalle',
      'movimiento',
      'narrat',
      'merchant',
      'beneficiar',
    ])
  ) {
    return 'description'
  }

  if (
    includesAny(h, [
      'nota',
      'note',
      'mas datos',
      'observ',
      'referenc',
      'comentario',
      'info adic',
    ])
  ) {
    return 'note'
  }

  return 'ignore'
}

/** Asegura un solo date/amount/description/note (el primero gana; resto → ignore). */
export function uniquifyRoles(roles: ColumnRole[]): ColumnRole[] {
  const seen = new Set<ColumnRole>()
  return roles.map((role) => {
    if (role === 'ignore') return role
    if (seen.has(role)) return 'ignore'
    seen.add(role)
    return role
  })
}

export function guessRoles(headers: string[]): ColumnRole[] {
  return uniquifyRoles(headers.map(guessRole))
}

export function detectDelimiter(sample: string): CsvDelimiter {
  let semi = 0
  let comma = 0
  let tab = 0
  for (const line of sample.split(/\r?\n/).slice(0, 25)) {
    if (!line.trim()) continue
    semi += (line.match(/;/g) ?? []).length
    tab += (line.match(/\t/g) ?? []).length
    // comas fuera de posibles decimales: aproximar por total
    comma += (line.match(/,/g) ?? []).length
  }
  if (tab >= semi && tab >= comma && tab > 0) return '\t'
  if (semi >= comma) return ';'
  return ','
}

/** Línea que parece cabecera de movimientos bancarios. */
export function looksLikeHeaderRow(cells: string[], delimiter: CsvDelimiter): boolean {
  if (cells.length < 2) return false
  const joined = cells.map(normalizeHeader).join(' ')
  const hasDate = includesAny(joined, ['fecha', 'date', 'booking'])
  const hasAmount = includesAny(joined, ['importe', 'amount', 'cantidad', 'cargo', 'abono'])
  const hasDesc = includesAny(joined, ['concepto', 'descrip', 'detalle', 'narrat'])
  // Al menos dos señales de columna típica
  const score = Number(hasDate) + Number(hasAmount) + Number(hasDesc)
  if (score >= 2) return true
  // Fallback: muchas columnas y alguna palabra clave
  return cells.length >= 3 && score >= 1 && delimiter !== '\t'
}

export function detectDateFormat(samples: string[]): DateFormat {
  let dmy = 0
  let iso = 0
  let dmyDash = 0
  for (const raw of samples) {
    const s = raw.trim()
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) iso++
    else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) dmy++
    else if (/^\d{1,2}-\d{1,2}-\d{2,4}/.test(s)) dmyDash++
  }
  if (iso >= dmy && iso >= dmyDash && iso > 0) return 'yyyy-mm-dd'
  if (dmyDash > dmy) return 'dd-mm-yyyy'
  return 'dd/mm/yyyy'
}

export function detectDecimal(samples: string[]): DecimalStyle {
  let comma = 0
  let point = 0
  for (const raw of samples) {
    const s = raw.trim().replace(/\s/g, '').replace(/€/g, '')
    if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s) || /^-?\d+,\d{1,2}$/.test(s)) comma++
    else if (/^-?\d{1,3}(,\d{3})*\.\d{1,2}$/.test(s) || /^-?\d+\.\d{1,2}$/.test(s)) point++
  }
  return point > comma ? 'point' : 'comma'
}

export function firstValues(rows: string[][], colIndex: number, n = 3): string[] {
  const out: string[] = []
  for (const row of rows) {
    const v = (row[colIndex] ?? '').trim()
    if (!v) continue
    out.push(v)
    if (out.length >= n) break
  }
  return out
}
