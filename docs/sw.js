// Service worker: přednačte všechny soubory aplikace, pak běží úplně offline (cache-first).
// Model pro přesné oddělení zpěvu (models/, vendor/ort/) se stahuje až na vyžádání do zvláštní cache 'zp-models-v1'.
// Odpovědi dostanou hlavičky izolace (COOP/COEP), aby výpočet mohl běžet ve více vláknech.
importScripts('./precache.js');
const CACHE = 'zpivanky-' + self.PRECACHE.version;
const MODELS = 'zp-models-v1';
const FILES = self.PRECACHE.files;
const ONDEMAND = /\/(models|vendor\/ort)\//;

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

function isolate(res) {
  if (!res || res.type === 'opaque' || res.status === 0) return res;
  const h = new Headers(res.headers);
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Embedder-Policy', 'require-corp');
  h.set('Cross-Origin-Resource-Policy', 'same-origin');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // cizí servery aplikace nepoužívá (kromě dohledání textu, to jde mimo SW)
  e.respondWith((async () => {
    if (ONDEMAND.test(url.pathname)) {
      const m = await caches.open(MODELS);
      const hit = await m.match(req, { ignoreSearch: true });
      if (hit) return isolate(hit);
      try { return isolate(await fetch(req)); } catch { return new Response('Offline', { status: 503 }); }
    }
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const hit = await c.match('./index.html');
      if (hit) return isolate(hit);
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return isolate(hit);
    try {
      const res = await fetch(req);
      if (res.ok && url.pathname.startsWith(new URL('./', location).pathname)) c.put(req, res.clone());
      return isolate(res);
    } catch {
      return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
