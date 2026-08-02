/** Reglas estáticas: patrón en concepto → clave de categoría (seed EN). */
export type CategoryRule = { pattern: string; categoryKey: string }

/** ponytail: lista corta ES; ampliar cuando fallen imports reales. */
export const BUILTIN_CATEGORY_RULES: CategoryRule[] = [
  { pattern: 'mercadona', categoryKey: 'Groceries' },
  { pattern: 'lidl', categoryKey: 'Groceries' },
  { pattern: 'carrefour', categoryKey: 'Groceries' },
  { pattern: 'aldi', categoryKey: 'Groceries' },
  { pattern: 'dia ', categoryKey: 'Groceries' },
  { pattern: 'consum', categoryKey: 'Groceries' },
  { pattern: 'restaurante', categoryKey: 'Dining out' },
  { pattern: 'mcdonald', categoryKey: 'Dining out' },
  { pattern: 'burger', categoryKey: 'Dining out' },
  { pattern: 'starbucks', categoryKey: 'Dining out' },
  { pattern: 'glovo', categoryKey: 'Dining out' },
  { pattern: 'uber eats', categoryKey: 'Dining out' },
  { pattern: 'just eat', categoryKey: 'Dining out' },
  { pattern: 'renfe', categoryKey: 'Transport' },
  { pattern: 'metro', categoryKey: 'Transport' },
  { pattern: 'uber', categoryKey: 'Transport' },
  { pattern: 'cabify', categoryKey: 'Transport' },
  { pattern: 'repsol', categoryKey: 'Transport' },
  { pattern: 'cepsa', categoryKey: 'Transport' },
  { pattern: 'shell', categoryKey: 'Transport' },
  { pattern: 'amazon', categoryKey: 'Shopping' },
  { pattern: 'zara', categoryKey: 'Shopping' },
  { pattern: 'apple.com', categoryKey: 'Tech' },
  { pattern: 'media markt', categoryKey: 'Tech' },
  { pattern: 'pccomponentes', categoryKey: 'Tech' },
  { pattern: 'netflix', categoryKey: 'Subscriptions' },
  { pattern: 'spotify', categoryKey: 'Subscriptions' },
  { pattern: 'disney', categoryKey: 'Subscriptions' },
  { pattern: 'hbo', categoryKey: 'Subscriptions' },
  { pattern: 'prime video', categoryKey: 'Subscriptions' },
  { pattern: 'steam', categoryKey: 'Digital & games' },
  { pattern: 'playstation', categoryKey: 'Digital & games' },
  { pattern: 'xbox', categoryKey: 'Digital & games' },
  { pattern: 'nintendo', categoryKey: 'Digital & games' },
  { pattern: 'iberdrola', categoryKey: 'Home & bills' },
  { pattern: 'endesa', categoryKey: 'Home & bills' },
  { pattern: 'naturgy', categoryKey: 'Home & bills' },
  { pattern: 'vodafone', categoryKey: 'Home & bills' },
  { pattern: 'movistar', categoryKey: 'Home & bills' },
  { pattern: 'orange', categoryKey: 'Home & bills' },
  { pattern: 'digi', categoryKey: 'Home & bills' },
  { pattern: 'comunidad', categoryKey: 'Home & bills' },
  { pattern: 'farmacia', categoryKey: 'Health' },
  { pattern: 'clinic', categoryKey: 'Health' },
  { pattern: 'nomina', categoryKey: 'Other' },
  { pattern: 'nómina', categoryKey: 'Other' },
  { pattern: 'payroll', categoryKey: 'Other' },
  { pattern: 'salary', categoryKey: 'Other' },
]

export const FALLBACK_CATEGORY_KEY = 'Other'

/**
 * Devuelve la clave de categoría sugerida, o null si no hay match
 * (el caller aplica Other). `learned` gana sobre builtin.
 */
export function suggestCategoryKey(
  text: string,
  learned: CategoryRule[] = [],
): string | null {
  const hay = text.toLowerCase()
  for (const rule of learned) {
    if (rule.pattern && hay.includes(rule.pattern.toLowerCase())) {
      return rule.categoryKey
    }
  }
  for (const rule of BUILTIN_CATEGORY_RULES) {
    if (hay.includes(rule.pattern.toLowerCase())) return rule.categoryKey
  }
  return null
}
