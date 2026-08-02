/** Anillo de marca (versión simple; el generativo completo llega en P5.2). */
export function BrandMark({
  size = 30,
  className = '',
}: {
  size?: number
  className?: string
}) {
  const stroke = Math.max(2.5, size * 0.12)
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const progress = 0.7
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        opacity={0.28}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${c * progress} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  )
}
