import { existsSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Extensión opcional: `src/pro/head.html` (no forma parte de este repo) añade etiquetas
// al <head> de una instancia alojada (Open Graph, datos estructurados…).
const extensionHead = (): Plugin => ({
  name: 'extension-head',
  transformIndexHtml(html) {
    const file = new URL('./src/pro/head.html', import.meta.url)
    return existsSync(file) ? html.replace('</head>', `${readFileSync(file, 'utf8')}\n  </head>`) : html
  },
})

export default defineConfig({
  plugins: [react(), extensionHead()],
  server: {
    proxy: {
      '/api': 'http://localhost:3010',
    },
  },
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
  },
})
