/** Qué hacer con todo el lote cuando el archivo repite movimientos ya guardados. */
export type DuplicatePolicy = 'skip' | 'replace' | 'keep' | 'abort'

export function rowWillImport(
  row: { duplicate: boolean; selected: boolean; categoryId: number | null },
  policy: DuplicatePolicy,
): boolean {
  if (policy === 'abort') return false
  if (row.categoryId == null) return false
  if (row.duplicate) return policy === 'replace' || policy === 'keep'
  return row.selected
}
