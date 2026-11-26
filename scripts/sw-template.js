/* Service worker do DMTabata (gerado por scripts/generate-sw.mjs — não editar em dist/). */
const VERSION = '__VERSION__';
const PRECACHE = `dmtabata-app-${VERSION}`;
const PRECACHE_URLS = __PRECACHE_URLS__;
// Sons importados/gravados pelo usuário (ver expoSoundImporter.web.ts): nunca apagar.
const USER_CACHES = ['dmtabata-user-sounds'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== PRECACHE && !USER_CACHES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Páginas: rede primeiro (pega versão nova), cache se estiver offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(PRECACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html', { cacheName: PRECACHE })),
    );
    return;
  }

  // Arquivos do app (com hash no nome) e sons: cache primeiro.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then(
      (cached) =>
        cached ??
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(PRECACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
