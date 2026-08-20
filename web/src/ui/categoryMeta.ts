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
