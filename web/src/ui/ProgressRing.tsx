/** Anillo generativo Directions 14a — un SVG, arco = progreso %. */

export type ProgressRingTone = 'brand' | 'savings' | 'onAccent' | 'mono'

const TONE: Record<
  ProgressRingTone,
  { track: string; progress: string }
> = {
  brand: { track: 'var(--border)', progress: 'var(--accent)' },
  savings: { track: 'var(--track)', progress: 'var(--savings)' },
  onAccent: {
    track: 'color-mix(in srgb, var(--on-accent) 30%, transparent)',
    progress: 'var(--on-accent)',
  },
  mono: { track: 'var(--border)', progress: 'var(--fg)' },
}

export function ProgressRing({
  percent,
  size = 34,
  strokeWidth = 7,
  tone = 'brand',
  className = '',
  'aria-label': ariaLabel,
}: {
  /** 0–100+ (enteros). Se pinta clamp 0–100. */
  percent: number
  size?: number
  strokeWidth?: number
  tone?: ProgressRingTone
  className?: string
  'aria-label'?: string
}) {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  const colors = TONE[tone]
  const decorative = !ariaLabel

  return (
    <svg
      viewBox="0 0 42 42"
      width={size}
      height={size}
      className={className}
      style={{ transform: 'rotate(-90deg)' }}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={ariaLabel}
    >
      <circle
        cx="21"
        cy="21"
        r="16"
        fill="none"
        stroke={colors.track}
        strokeWidth={strokeWidth}
      />
      <circle
        cx="21"
        cy="21"
        r="16"
        fill="none"
        stroke={colors.progress}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${p} ${100 - p}`}
        pathLength={100}
      />
    </svg>
  )
}

/** Favicon: anillo blanco sobre terracota (Directions 14d). */
export function faviconSvgForPercent(percent: number): string {
  const p = Math.max(0, Math.min(100, Math.round(percent)))
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#A8471C"/><g transform="translate(11 11) rotate(-90 21 21)"><circle cx="21" cy="21" r="16" fill="none" stroke="#FFFFFF4D" stroke-width="8"/><circle cx="21" cy="21" r="16" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round" stroke-dasharray="${p} ${100 - p}" pathLength="100"/></g></svg>`
}

export function setFaviconPercent(percent: number) {
  const href = `data:image/svg+xml,${encodeURIComponent(faviconSvgForPercent(percent))}`
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']")
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.type = 'image/svg+xml'
  link.href = href
}
