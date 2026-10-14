import { Link, useParams } from 'react-router-dom'
import { extensionLegalLinks } from '../extension'

/** Enlaces legales que aporte la extensión (instancia alojada). Sin extensión: nada. */
export function LegalLinks({ className = '' }: { className?: string }) {
  const { locale = 'es' } = useParams()
  if (extensionLegalLinks.length === 0) return null
  return (
    <nav aria-label="Legal" className={`flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-ink-3 ${className}`}>
      {extensionLegalLinks.map((l) => (
        <Link key={l.path} to={`/${locale}/${l.path}`} className="hover:text-ink-2 hover:underline focus-visible:shadow-focus focus-visible:outline-none">
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
