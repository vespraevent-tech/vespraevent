/* Vidéobooth : l'appli s'ouvre même sans réseau (les vidéos, elles, vivent dans la tablette jusqu'à leur envoi). */
const V = 'vb-20';
const FICHIERS = ['/videobooth/', '/videobooth/index.html', '/videobooth/app.js?v=21', '/videobooth/app.css?v=21', '/polices.css?v=1', '/favicon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => Promise.all(FICHIERS.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(fetch(r).then((rep) => { if (rep.ok) { const cp = rep.clone(); caches.open(V).then((c) => c.put(r, cp)); } return rep; }).catch(() => caches.match(r, { ignoreSearch: false }).then((m) => m || caches.match('/videobooth/'))));
});
