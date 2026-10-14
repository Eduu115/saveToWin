import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BrandMark } from '../../ui/BrandMark'
import { GubiaCredit } from '../../ui/GubiaCredit'
import { LEGAL_DOCS, UPDATED, type LegalDoc } from './documents'

const LABELS: Record<LegalDoc['slug'], string> = {
  privacy: 'Privacidad',
  cookies: 'Cookies',
  notice: 'Aviso legal',
  terms: 'Condiciones',
}

/** Página pública (sin sesión) con un texto legal de savetowin.app. */
function LegalPage({ doc }: { doc: LegalDoc }) {
  const { locale = 'es' } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    document.title = `${doc.title} · saveToWin`
    window.scrollTo(0, 0)
  }, [doc])
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-line bg-surface px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to={`/${locale}`} className="flex items-center gap-2.5 focus-visible:shadow-focus focus-visible:outline-none">
            <BrandMark percent={70} size={24} />
            <span className="text-base font-bold tracking-tight">saveToWin</span>
          </Link>
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/${locale}`))}
            className="inline-flex h-tap items-center gap-2 rounded-pill bg-surface-2 px-4 text-sm font-semibold text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
          >
            <ArrowLeft size={16} strokeWidth={2.2} aria-hidden />
            Volver
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <nav aria-label="Textos legales" className="mb-6 flex flex-wrap gap-2">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d.slug}
              to={`/${locale}/legal/${d.slug}`}
              aria-current={d.slug === doc.slug ? 'page' : undefined}
              className={`inline-flex h-9 items-center rounded-pill px-3.5 text-[13px] font-semibold focus-visible:shadow-focus focus-visible:outline-none ${
                d.slug === doc.slug ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-ink-2'
              }`}
            >
              {LABELS[d.slug]}
            </Link>
          ))}
        </nav>

        <article className="rounded-card border border-line bg-surface p-6 shadow-raised sm:p-8">
          <h1 className="text-[28px] font-extrabold tracking-tight">{doc.title}</h1>
          <p className="mt-1 text-[12.5px] text-ink-3">Última actualización: {UPDATED}</p>
          <p className="mt-5 text-[14.5px] leading-relaxed text-ink-2">{doc.intro}</p>
          {doc.sections.map((s) => (
            <section key={s.heading} className="mt-7">
              <h2 className="text-[17px] font-bold">{s.heading}</h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-2.5 text-[14.5px] leading-relaxed text-ink-2">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5 text-[14.5px] leading-relaxed text-ink-2 marker:text-accent">
                  {s.list.map((li) => (
                    <li key={li}>{li}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </article>

        <footer className="mt-6 flex justify-center">
          <GubiaCredit variant="inline" />
        </footer>
      </main>
    </div>
  )
}

export const legalPublicPages = LEGAL_DOCS.map((doc) => ({
  path: `legal/${doc.slug}`,
  Page: () => <LegalPage doc={doc} />,
}))

export const legalLinks = LEGAL_DOCS.map((doc) => ({ path: `legal/${doc.slug}`, label: LABELS[doc.slug] }))
