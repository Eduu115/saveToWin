import { es, type MessageKey } from './es'

export function t(key: MessageKey): string {
  return es[key]
}

export type { MessageKey }
