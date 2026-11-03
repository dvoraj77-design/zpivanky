// Service worker: přednačte všechny soubory aplikace, pak běží úplně offline (cache-first).
importScripts('./precache.js');
const CACHE = 'zpivanky-' + self.PRECACHE.version;
const FILES = self.PRECACHE.files;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));
    const clients = await self.clients.matchAll();
    // první instalace: hned převzít; aktualizace čeká na „Aktualizovat“
    if (!clients.length || !(await self.registration.active)) self.skipWaiting();
  })());
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('zpivanky-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data && e.data.type === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // cizí servery aplikace nepoužívá
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const hit = await c.match('./index.html');
      if (hit) return hit;
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && url.pathname.startsWith(new URL('./', location).pathname)) c.put(req, res.clone());
      return res;
    } catch {
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
