/*
 * Páginas (index.html) → red primero: tras desplegar, la versión nueva se ve a
 * la primera; sin red, la última guardada. Lo demás → caché primero.
 * ponytail: sin precache de hashes; offline solo sirve lo ya visitado.
 */
const CACHE = 'savetowin-v3'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/manifest.webmanifest'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

function save(request, res) {
  if (res.ok) {
    const copy = res.clone()
    void caches.open(CACHE).then((c) => c.put(request, copy))
  }
  return res
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  // La app sirve el mismo index.html en todas sus rutas: se guarda bajo '/app'.
  // '/' va aparte (en una instancia alojada puede ser una landing).
  if (request.mode === 'navigate') {
    const key = url.pathname === '/' ? '/' : '/app'
    event.respondWith(
      fetch(request)
        .then((res) => save(key, res))
        .catch(() => caches.match(key).then((hit) => hit || caches.match('/'))),
    )
    return
  }

  // Resto: caché primero y se refresca por detrás (los /assets/ salen del caché
  // HTTP «immutable», sin tocar la red).
  const fresh = fetch(request).then((res) => save(request, res))
  event.respondWith(caches.match(request).then((hit) => hit || fresh))
  event.waitUntil(fresh.catch(() => {}))
})
