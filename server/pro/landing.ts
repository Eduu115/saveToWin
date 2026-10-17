import { existsSync, readFileSync } from 'node:fs'
import type { Hono } from 'hono'
import { readAuthCookie } from '../src/lib/cookies.js'

/**
 * savetowin.app: landing estática en `/` (HTML sin JavaScript, rápida e indexable),
 * robots.txt y sitemap. Con sesión, `/` lleva directo al dashboard.
 * El HTML vive en web/public/landing/ y el build lo deja en ./public/landing/.
 */
const SITE = 'https://savetowin.app'
const PUBLIC_PATHS = ['/', '/es/register', '/es/login', '/es/legal/privacy', '/es/legal/cookies', '/es/legal/notice', '/es/legal/terms']

let landing: string | null | undefined
const landingHtml = () => {
  if (landing === undefined) {
    const file = './public/landing/index.html'
    landing = existsSync(file) ? readFileSync(file, 'utf8') : null
  }
  return landing
}

export function registerLanding(app: Hono) {
  app.get('/', (c) => {
    if (readAuthCookie(c)) return c.redirect('/es/dashboard', 302)
    const html = landingHtml()
    if (!html) return c.redirect('/es', 302)
    c.header('Cache-Control', 'no-cache')
    return c.html(html)
  })

  app.get('/robots.txt', (c) => {
    c.header('Cache-Control', 'public, max-age=3600')
    return c.text(`User-agent: *\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`)
  })

  app.get('/sitemap.xml', (c) => {
    const urls = PUBLIC_PATHS.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n')
    c.header('Content-Type', 'application/xml; charset=utf-8')
    c.header('Cache-Control', 'public, max-age=3600')
    return c.body(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`)
  })
}
