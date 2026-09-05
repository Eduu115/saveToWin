// tailwind.config.js — los tokens mandan, Tailwind solo los expone
export default {
    darkMode: ['class', '[data-theme="dark"]'],
    theme: {
      extend: {
        colors: {
          bg: 'var(--bg)',
          surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
          ink:     { DEFAULT: 'var(--fg)', 2: 'var(--fg-2)', 3: 'var(--fg-3)' },
          line:    { DEFAULT: 'var(--border)', grid: 'var(--grid)' },
          track:   'var(--track)',
          accent:  { DEFAULT: 'var(--accent)', weak: 'var(--accent-weak)',
                     hover: 'var(--accent-hover)', fg: 'var(--on-accent)' },
          income:  { DEFAULT: 'var(--income)',  weak: 'var(--income-weak)' },
          expense: 'var(--expense)',
          savings: { DEFAULT: 'var(--savings)', weak: 'var(--savings-weak)' },
          warn:    { DEFAULT: 'var(--warn)',    weak: 'var(--warn-weak)' },
          danger:  { DEFAULT: 'var(--danger)',  weak: 'var(--danger-weak)' },
          cat: Object.fromEntries(
            Array.from({ length: 12 }, (_, i) => [i + 1, `var(--c${i + 1})`])
          ),
          seq: Object.fromEntries(
            Array.from({ length: 6 }, (_, i) => [i + 1, `var(--s${i + 1})`])
          ),
        },
        borderRadius: {
          icon: 'var(--r-icon)',  tile: 'var(--r-tile)',
          field:'var(--r-field)', card: 'var(--r-card)',
          sheet:'var(--r-sheet)', pill: 'var(--r-pill)',
        },
        boxShadow: {
          raised: 'var(--sh-raised)',
          accent: 'var(--sh-accent)',
          focus:  'var(--sh-focus)',
        },
        fontFamily: { sans: 'var(--font-sans)' },
        height: { row: 'var(--h-row)', field: 'var(--h-field)', tap: 'var(--h-tap)' },
        width: { tap: 'var(--h-tap)' },
        minHeight: { tap: 'var(--h-tap)' },
        minWidth: { tap: 'var(--h-tap)' },
        size: { tap: 'var(--h-tap)' },
      },
    },
  }
  
  // uso:  class="bg-surface text-ink-2 rounded-card shadow-raised"
  //       class="focus-visible:shadow-focus focus-visible:outline-none"
  //       class="bg-cat-4"   →  Tech