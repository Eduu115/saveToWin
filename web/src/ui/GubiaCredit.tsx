import { t } from '../i18n/t'

// ponytail: dominio aún sin web publicada; cambiarlo aquí cuando haya otro.
export const GUBIA_URL = 'https://gubiadigital.es'

/**
 * Crédito «saveToWin by gubia digital» (kit de marca Gubia Digital v1.0).
 * - `lockup`: login, sobre terracota → lockup horizontal en blanco sólido
 *   (el naranja de Gubia no se recolorea y choca con el terracota), ≥120 px.
 * - `inline`: Ajustes / hoja «Más» → isotipo (color en claro, blanco en oscuro) + texto.
 */
export function GubiaCredit({ variant }: { variant: 'lockup' | 'inline' }) {
  if (variant === 'lockup') {
    return (
      <a
        href={GUBIA_URL}
        target="_blank"
        rel="noopener"
        aria-label={t('credit.aria')}
        className="flex flex-none items-center gap-2 rounded-field focus-visible:shadow-focus focus-visible:outline-none"
      >
        <span className="text-xs font-semibold tracking-wide">{t('credit.by')}</span>
        <img
          src="/brand/gubia-lockup-blanco.svg"
          alt="gubia digital"
          width={124}
          height={48}
          className="h-12 w-[124px]"
        />
      </a>
    )
  }
  return (
    <a
      href={GUBIA_URL}
      target="_blank"
      rel="noopener"
      className="inline-flex min-h-tap items-center gap-2 rounded-field text-[12.5px] font-medium text-ink-2 hover:text-ink focus-visible:shadow-focus focus-visible:outline-none"
    >
      {/* Kit: viruta a color sobre claro, variante blanca sobre oscuro. 32 px → símbolo visible ≥24 px. */}
      <img src="/brand/gubia-isotipo.svg" alt="" width={32} height={32} className="size-8 dark:hidden" />
      <img
        src="/brand/gubia-isotipo-blanco.svg"
        alt=""
        width={32}
        height={32}
        className="hidden size-8 dark:block"
      />
      <span>
        {t('app.name')} · {t('credit.madeBy')} <b className="font-semibold text-ink">gubia digital</b>
      </span>
    </a>
  )
}
