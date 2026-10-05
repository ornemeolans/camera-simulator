/* Service worker del simulador (PWA).
 *
 * Estrategia, a propósito simple y sin librerías:
 * - Navegación (el HTML): red primero, y si no hay conexión, la última
 *   versión guardada → la app abre aunque estés offline.
 * - /assets/* (archivos con hash en el nombre, nunca cambian): caché primero.
 * - Todo lo que NO sea de este mismo origen (Firebase, fuentes, fotos
 *   remotas) se deja pasar sin tocar: no cacheamos tráfico de Firestore.
 * Al subir de versión CACHE se borran las cachés viejas en `activate`.
 */
const CACHE = 'camera-sim-v1'
const BASE = new URL(self.registration.scope).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll([BASE, `${BASE}manifest.webmanifest`, `${BASE}icon-192.png`])),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(BASE, copy))
          return res
        })
        .catch(() => caches.match(BASE)),
    )
    return
  }

  if (url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
            return res
          }),
      ),
    )
  }
})
