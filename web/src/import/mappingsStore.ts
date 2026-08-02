import type { SavedMapping } from './types'

const KEY = 'savetowin.importMappings'

export function loadSavedMappings(): SavedMapping[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedMapping[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveMapping(mapping: Omit<SavedMapping, 'id' | 'useCount' | 'updatedAt'> & { id?: string }): SavedMapping {
  const list = loadSavedMappings()
  const now = new Date().toISOString()
  const existing = mapping.id ? list.find((m) => m.id === mapping.id) : undefined
  const saved: SavedMapping = {
    id: existing?.id ?? crypto.randomUUID(),
    name: mapping.name,
    rolesByHeader: mapping.rolesByHeader,
    delimiter: mapping.delimiter,
    encoding: mapping.encoding,
    dateFormat: mapping.dateFormat,
    decimal: mapping.decimal,
    skipRows: mapping.skipRows,
    useCount: (existing?.useCount ?? 0) + 1,
    updatedAt: now,
  }
  const next = [saved, ...list.filter((m) => m.id !== saved.id)]
  localStorage.setItem(KEY, JSON.stringify(next))
  return saved
}

export function bumpMappingUse(id: string): void {
  const list = loadSavedMappings()
  const next = list.map((m) =>
    m.id === id ? { ...m, useCount: m.useCount + 1, updatedAt: new Date().toISOString() } : m,
  )
  localStorage.setItem(KEY, JSON.stringify(next))
}

export function deleteSavedMapping(id: string): void {
  localStorage.setItem(
    KEY,
    JSON.stringify(loadSavedMappings().filter((m) => m.id !== id)),
  )
}
