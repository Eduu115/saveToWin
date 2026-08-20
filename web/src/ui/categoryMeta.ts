import type { ColorToken } from '@savetowin/shared/types'
import {
  Bus,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  House,
  type LucideIcon,
  MoreHorizontal,
  PiggyBank,
  Plane,
  Repeat,
  Shirt,
  ShoppingCart,
  Utensils,
  Wine,
} from 'lucide-react'

/** Directions 10a — icono Lucide por clave de categoría. */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Groceries: ShoppingCart,
  'Dining out': Utensils,
  Transport: Bus,
  Leisure: Wine,
  Subscriptions: Repeat,
  'Digital & games': Gamepad2,
  Clothing: Shirt,
  'Home & bills': House,
  Health: HeartPulse,
  Education: GraduationCap,
  Travel: Plane,
  Other: MoreHorizontal,
  'Savings transfer': PiggyBank,
  // archivadas (por si se muestran en histórico)
  Tech: Gamepad2,
  Shopping: Shirt,
}

export function categoryIcon(key: string): LucideIcon {
  return CATEGORY_ICONS[key] ?? MoreHorizontal
}

/**
 * Orden del desplegable: grupos afines juntos; Other siempre al final.
 * Claves desconocidas van antes de Other (orden alfabético por label).
 */
const CATEGORY_DISPLAY_ORDER: Record<string, number> = {
  Groceries: 10,
  'Dining out': 20,
  Transport: 30,
  'Home & bills': 40,
  Health: 50,
  Clothing: 60,
  Leisure: 70,
  Travel: 80,
  Subscriptions: 90,
  'Digital & games': 100,
  Education: 110,
  'Savings transfer': 200,
  Other: 999,
}

export function sortCategoriesByDisplayOrder<T extends { key: string; label: string }>(
  cats: T[],
): T[] {
  return [...cats].sort((a, b) => {
    const ao = CATEGORY_DISPLAY_ORDER[a.key] ?? 500
    const bo = CATEGORY_DISPLAY_ORDER[b.key] ?? 500
    if (ao !== bo) return ao - bo
    return a.label.localeCompare(b.label, 'es')
  })
}

const BG: Record<ColorToken, string> = {
  c1: 'bg-cat-1',
  c2: 'bg-cat-2',
  c3: 'bg-cat-3',
  c4: 'bg-cat-4',
  c5: 'bg-cat-5',
  c6: 'bg-cat-6',
  c7: 'bg-cat-7',
  c8: 'bg-cat-8',
  c9: 'bg-cat-9',
  c10: 'bg-cat-10',
  c11: 'bg-cat-11',
  c12: 'bg-cat-12',
}

export function categoryBgClass(color: ColorToken): string {
  return BG[color]
}

export function categoryCssVar(color: ColorToken): string {
  return `var(--${color})`
}
