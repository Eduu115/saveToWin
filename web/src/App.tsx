import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

function readTheme(): Theme {
  const stored = localStorage.getItem('theme')
  return stored === 'dark' ? 'dark' : 'light'
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const next = theme === 'dark' ? 'light' : 'dark'
  const label = theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro'

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setTheme(next)}
      className="inline-flex h-tap w-tap items-center justify-center rounded-pill bg-surface-2 text-ink-2 focus-visible:shadow-focus focus-visible:outline-none"
    >
      {theme === 'dark' ? <Sun size={17} strokeWidth={2} aria-hidden /> : <Moon size={17} strokeWidth={2} aria-hidden />}
    </button>
  )
}

export function App() {
  const [health, setHealth] = useState('…')

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => setHealth(JSON.stringify(data)))
      .catch((err) => setHealth(String(err)))
  }, [])

  return (
    <div className="min-h-dvh bg-bg p-6 text-ink">
      <header className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight">saveToWin</h1>
        <ThemeToggle />
      </header>
      <section className="rounded-card bg-surface p-5 text-ink shadow-raised">
        <p className="text-ink-2">/api/health → {health}</p>
      </section>
    </div>
  )
}
