import { es, type MessageKey } from './es'

// Extensión opcional: `src/pro/messages.ts` (no forma parte de este repo) puede
// sustituir textos, p. ej. los de «self-hosted» en una instancia alojada.
const overrides = Object.assign(
  {},
  ...Object.values(
    import.meta.glob<{ default: Partial<Record<MessageKey, string>> }>('../pro/messages.ts', {
      eager: true,
    }),
  ).map((m) => m.default),
) as Partial<Record<MessageKey, string>>

export function t(key: MessageKey): string {
  return overrides[key] ?? es[key]
}

export type { MessageKey }
