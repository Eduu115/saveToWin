import Papa from 'papaparse'
import {
  detectDateFormat,
  detectDecimal,
  detectDelimiter,
  firstValues,
  guessRoles,
  looksLikeHeaderRow,
} from './guess'
import type {
  CsvDelimiter,
  CsvEncoding,
  ParsedCsv,
} from './types'

const MAX_BYTES = 10 * 1024 * 1024

export type ParseOverrides = Partial<{
  delimiter: CsvDelimiter
  encoding: CsvEncoding
  skipRows: number
}>

function splitLine(line: string, delimiter: string): string[] {
  // PapaParse por línea es más fiable con comillas; aquí solo para detectar cabecera
  const result = Papa.parse<string[]>(line, { delimiter, header: false })
  const row = result.data[0]
  return Array.isArray(row) ? row.map((c) => String(c ?? '').trim()) : []
}

function decodeBuffer(buf: ArrayBuffer): { text: string; encoding: CsvEncoding } {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  if (utf8.includes('\uFFFD')) {
    return {
      text: new TextDecoder('iso-8859-1').decode(buf),
      encoding: 'ISO-8859-1',
    }
  }
  // Heurística: "Ã" + vocal / "Â" típico de UTF-8 leído como Latin-1 al revés
  // Aquí el archivo ya es UTF-8 válido; si hay mojibake raro de Latin-1 mal etiquetado, forzar Latin-1
  const latin1Hits = (utf8.match(/Ã[\x80-\xBF]/g) ?? []).length
  if (latin1Hits >= 2) {
    return {
      text: new TextDecoder('iso-8859-1').decode(buf),
      encoding: 'ISO-8859-1',
    }
  }
  return { text: utf8, encoding: 'UTF-8' }
}

function findHeaderRowIndex(lines: string[], delimiter: string): number {
  const limit = Math.min(lines.length, 40)
  for (let i = 0; i < limit; i++) {
    const line = lines[i]?.trim()
    if (!line) continue
    const cells = splitLine(line, delimiter)
    if (looksLikeHeaderRow(cells, delimiter as ';' | ',' | '\t')) return i
  }
  // Primera línea no vacía con ≥2 celdas
  for (let i = 0; i < limit; i++) {
    const line = lines[i]?.trim()
    if (!line) continue
    if (splitLine(line, delimiter).length >= 2) return i
  }
  return 0
}

/**
 * Lee un CSV bancario: detecta encoding, separador, filas basura y mapeo inicial.
 * ponytail: solo CSV (PapaParse); XLS/XLSX cuando haga falta un parser aparte.
 */
export async function parseBankCsv(
  file: File,
  overrides: ParseOverrides = {},
): Promise<ParsedCsv> {
  if (file.size > MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }
  const name = file.name.toLowerCase()
  if (!name.endsWith('.csv') && file.type !== 'text/csv' && file.type !== 'text/plain') {
    throw new Error('NOT_CSV')
  }

  const buf = await file.arrayBuffer()
  const decoded =
    overrides.encoding === 'ISO-8859-1'
      ? { text: new TextDecoder('iso-8859-1').decode(buf), encoding: 'ISO-8859-1' as const }
      : overrides.encoding === 'UTF-8'
        ? { text: new TextDecoder('utf-8').decode(buf), encoding: 'UTF-8' as const }
        : decodeBuffer(buf)
  const { text, encoding } = decoded
  const delimiter = overrides.delimiter ?? detectDelimiter(text)
  const rawLines = text.split(/\r?\n/)
  const headerIndex =
    overrides.skipRows !== undefined
      ? Math.max(0, Math.min(overrides.skipRows, rawLines.length - 1))
      : findHeaderRowIndex(rawLines, delimiter)
  const bodyText = rawLines.slice(headerIndex).join('\n')

  const parsed = Papa.parse<string[]>(bodyText, {
    delimiter,
    header: false,
    skipEmptyLines: 'greedy',
  })

  if (parsed.errors.length > 0 && (!parsed.data || parsed.data.length === 0)) {
    throw new Error('PARSE_FAILED')
  }

  const matrix = parsed.data.filter((row) => Array.isArray(row) && row.some((c) => String(c).trim()))
  if (matrix.length < 2) throw new Error('NO_DATA')

  const headers = matrix[0]!.map((h) => String(h ?? '').trim())
  const rows = matrix.slice(1).map((row) => {
    const cells = headers.map((_, i) => String(row[i] ?? '').trim())
    return cells
  })

  let roles = guessRoles(headers)

  const dateIdx = roles.indexOf('date')
  const amountIdx = roles.indexOf('amount')
  const dateSamples = dateIdx >= 0 ? firstValues(rows, dateIdx, 8) : []
  const amountSamples = amountIdx >= 0 ? firstValues(rows, amountIdx, 8) : []

  return {
    fileName: file.name,
    fileSize: file.size,
    detection: {
      delimiter,
      encoding,
      dateFormat: detectDateFormat(dateSamples),
      decimal: detectDecimal(amountSamples),
      skipRows: headerIndex,
    },
    headers,
    rows,
    roles,
  }
}

export { MAX_BYTES }
