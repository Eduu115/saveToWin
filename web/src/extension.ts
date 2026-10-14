import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

/** Pantalla que aporta una extensión: ruta `/{locale}/{path}` y entrada de navegación. */
export type ExtensionPage = {
  path: string
  label: string
  Icon: LucideIcon
  Page: ComponentType
  /** `false` = ruta sin entrada en la navegación (se enlaza desde otra pantalla). */
  nav?: boolean
}

// Extensión opcional: `src/pro/index.ts` no forma parte de este repo. Si no existe,
// el glob no encuentra nada y la app funciona completa sin pantallas extra.
/** Enlace a una página pública (p. ej. textos legales de una instancia alojada). */
export type ExtensionLink = { path: string; label: string }

const modules = import.meta.glob<{
  pages?: ExtensionPage[]
  /** Secciones extra al final del perfil (p. ej. «Tu plan»). */
  profileSections?: ComponentType[]
  /** Páginas accesibles sin sesión (`/{locale}/{path}`). */
  publicPages?: { path: string; Page: ComponentType }[]
  /** Enlaces legales que se muestran en el login, el registro y el perfil. */
  legalLinks?: ExtensionLink[]
}>('./pro/index.ts', {
  eager: true,
})

export const extensionPages: ExtensionPage[] = Object.values(modules).flatMap(
  (m) => m.pages ?? [],
)

export const extensionProfileSections: ComponentType[] = Object.values(modules).flatMap(
  (m) => m.profileSections ?? [],
)

export const extensionPublicPages = Object.values(modules).flatMap((m) => m.publicPages ?? [])

export const extensionLegalLinks: ExtensionLink[] = Object.values(modules).flatMap(
  (m) => m.legalLinks ?? [],
)
