/* Service Worker – macht den Trainingsplan offline verfügbar.
   Nach JEDER Änderung an Dateien (plan.json, Bilder, app.js, style.css …) VERSION erhöhen,
   sonst behält das iPhone die alte Fassung. */
const VERSION = 'tp-6';
const STATIC = ['./', 'index.html', 'app.js', 'style.css', 'plan.json', 'icon.png', 'nosleep.mp4', 'manifest.json', 'README.md'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(STATIC.map(u => new Request(u, { cache: 'reload' })));
    // alle Bilder, die in plan.json vorkommen, gleich mitspeichern
    const plan = await (await c.match('plan.json')).json();
    const imgs = new Set();
    JSON.stringify(plan).replace(/"img"\s*:\s*"([^"]+)"/g, (_, p) => imgs.add(p));
    await c.addAll([...imgs].map(u => new Request(u, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Zuerst aus dem Speicher, nur wenn nicht vorhanden aus dem Netz (und dann mitspeichern)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok && res.status === 200) c.put(e.request, res.clone());
    return res;
  })());
});
