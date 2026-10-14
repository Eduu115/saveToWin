import { Sparkles } from 'lucide-react'
import type { ExtensionPage } from '../extension'
import { tp } from './i18n'
import { PremiumPage } from './PremiumPage'

/** Pantallas que pro añade al núcleo (ver `src/extension.ts`). */
export const pages: ExtensionPage[] = [
  { path: 'premium', label: tp('pro.nav'), Icon: Sparkles, Page: PremiumPage },
]
