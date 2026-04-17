// Basic app-shell service worker.
// Bump CACHE on every deploy to invalidate old caches.
const CACHE = 'intellix-shell-v1'
const SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Never intercept API calls — they must always go to the network.
  if (url.pathname.startsWith('/api')) return

  // SPA navigations: try network first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets: cache-first, populate on miss.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached
      return fetch(req).then(resp => {
        if (resp.ok && url.origin === self.location.origin) {
          const clone = resp.clone()
          caches.open(CACHE).then(c => c.put(req, clone))
        }
        return resp
      })
    })
  )
})
