import { BarChart3, Gift, Sparkles } from 'lucide-react'
import type { ExtensionPage } from '../extension'
import { AnalysisPage } from './AnalysisPage'
import { PlanSection } from './PlanSection'
import { tp } from './i18n'
import { legalLinks as legal, legalPublicPages } from './legal/LegalPage'
import { PremiumPage } from './PremiumPage'
import { WrappedPage } from './WrappedPage'

/** Pantallas que pro añade al núcleo (ver `src/extension.ts`). */
export const pages: ExtensionPage[] = [
  { path: 'analysis', label: tp('an.nav'), Icon: BarChart3, Page: AnalysisPage },
  { path: 'wrapped', label: tp('an.wrapped'), Icon: Gift, Page: WrappedPage, nav: false },
  { path: 'premium', label: tp('pro.nav'), Icon: Sparkles, Page: PremiumPage, nav: false },
]

/** Secciones que pro añade al perfil. */
export const profileSections = [PlanSection]

/** Textos legales de savetowin.app: páginas públicas y enlaces (login, registro, perfil). */
export const publicPages = legalPublicPages
export const legalLinks = legal
