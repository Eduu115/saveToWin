import type { LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'

/** Pantalla que aporta una extensión: ruta `/{locale}/{path}` y entrada de navegación. */
export type ExtensionPage = {
  path: string
  label: string
  Icon: LucideIcon
  Page: ComponentType
}

// Extensión opcional: `src/pro/index.ts` no forma parte de este repo. Si no existe,
// el glob no encuentra nada y la app funciona completa sin pantallas extra.
const modules = import.meta.glob<{ pages?: ExtensionPage[] }>('./pro/index.ts', {
  eager: true,
})

export const extensionPages: ExtensionPage[] = Object.values(modules).flatMap(
  (m) => m.pages ?? [],
)
