import { ProgressRing, type ProgressRingTone } from './ProgressRing'

/** Marca = anillo generativo (Directions 14a). El arco es el % del objetivo. */
export function BrandMark({
  percent = 70,
  size = 30,
  strokeWidth,
  tone = 'brand',
  className = '',
}: {
  /** % del objetivo de ahorro (entero). Default 70 = dataset canónico en login. */
  percent?: number
  size?: number
  strokeWidth?: number
  tone?: ProgressRingTone
  className?: string
}) {
  const sw =
    strokeWidth ??
    (size >= 40 ? 8 : size >= 28 ? 7 : size >= 20 ? 9 : 10)

  return (
    <ProgressRing
      percent={percent}
      size={size}
      strokeWidth={sw}
      tone={tone}
      className={className}
    />
  )
}
