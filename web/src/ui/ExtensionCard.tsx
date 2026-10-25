import { Download, Puzzle } from 'lucide-react'
import { t } from '../i18n/t'

/** Descarga de la extensión de gasto rápido (Chrome y Firefox). */
export function ExtensionCard() {
  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5 shadow-raised">
      <h2 className="flex items-center gap-2.5 text-[15px] font-bold">
        <span className="flex size-8 items-center justify-center rounded-icon bg-surface-2 text-ink-2">
          <Puzzle size={16} strokeWidth={2.2} aria-hidden />
        </span>
        {t('profile.extension.title')}
      </h2>
      <p className="text-[13px] leading-relaxed text-ink-2">{t('profile.extension.lead')}</p>
      <a
        href="/savetowin-extension.zip?v=2"
        download="savetowin-extension.zip"
        className="inline-flex h-tap items-center gap-2 self-start rounded-pill bg-accent px-4 text-sm font-bold text-accent-fg shadow-accent focus-visible:shadow-focus focus-visible:outline-none"
      >
        <Download className="size-4" strokeWidth={2.2} aria-hidden />
        {t('profile.extension.download')}
      </a>
      <p className="text-[12.5px] leading-relaxed text-ink-2">{t('profile.extension.how')}</p>
      <p className="text-[12.5px] leading-relaxed text-ink-3">{t('profile.extension.session')}</p>
      <p className="text-[12.5px] leading-relaxed text-ink-2">{t('profile.extension.store')}</p>
      <p className="text-[12.5px] leading-relaxed text-ink-2">{t('profile.extension.pwa')}</p>
    </section>
  )
}
