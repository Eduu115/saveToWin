export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="min-h-dvh bg-bg p-6 text-ink">
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-2">saveToWin</p>
    </div>
  )
}
