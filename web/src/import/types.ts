/** Roles de columna que la app sabe mapear. */
export type ColumnRole = 'date' | 'description' | 'amount' | 'note' | 'ignore'

export type DateFormat = 'dd/mm/yyyy' | 'yyyy-mm-dd' | 'dd-mm-yyyy'
export type DecimalStyle = 'comma' | 'point'
export type CsvEncoding = 'UTF-8' | 'ISO-8859-1'
export type CsvDelimiter = ';' | ',' | '\t'

export type CsvDetection = {
  delimiter: CsvDelimiter
  encoding: CsvEncoding
  dateFormat: DateFormat
  decimal: DecimalStyle
  skipRows: number
}

export type ParsedCsv = {
  fileName: string
  fileSize: number
  detection: CsvDetection
  headers: string[]
  /** Filas de datos (sin cabecera), valores en bruto. */
  rows: string[][]
  /** Roles iniciales por índice de columna. */
  roles: ColumnRole[]
}

export type SavedMapping = {
  id: string
  name: string
  /** Cabeceras → rol (por nombre normalizado). */
  rolesByHeader: Record<string, ColumnRole>
  delimiter: CsvDelimiter
  encoding: CsvEncoding
  dateFormat: DateFormat
  decimal: DecimalStyle
  skipRows: number
  useCount: number
  updatedAt: string
}
