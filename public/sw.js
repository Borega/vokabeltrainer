// Service Worker: hält die Oberfläche auf dem Gerät vor, damit die App ohne Internet startet.
// Daten (Listen, Lernstand) speichert die App selbst (store.js); /api und /auth gehen immer ans Netz.
//
// Strategie „erst Netz, dann Speicher“: Mit Verbindung kommt immer die aktuelle Version (und wird
// gespeichert), ohne Verbindung die zuletzt gespeicherte. Bei sehr langsamem WLAN nach 4 s der Speicher.

const CACHE = 'vokabeltrainer-v1';
// Alles, was die App zum Starten braucht. Neue Dateien in public/ hier ergänzen (ein Test prüft das).
const SHELL = [
  '/',
  '/app.js',
  '/check.js',
  '/csv.js',
  '/exercises.js',
  '/grammar.js',
  '/grammar-editor.js',
  '/grammar-learn.js',
  '/grammar-stats.js',
  '/listfilter.js',
  '/offline.js',
  '/schedule.js',
  '/speech.js',
  '/stats-ui.js',
  '/streak-ui.js',
  '/store.js',
  '/theme.js',
  '/ui.js',
  '/style.css',
  '/fonts/fraunces-latin-wght-normal.woff2',
  '/fonts/fraunces-latin-ext-wght-normal.woff2',
  '/fonts/fraunces-latin-wght-italic.woff2',
  '/fonts/nunito-sans-latin-wght-normal.woff2',
  '/fonts/nunito-sans-latin-ext-wght-normal.woff2',
  '/favicon.svg',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest',
  '/config.json',
  '/vendor/ts-fsrs.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function fromNetwork(request) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), 4000);
    fetch(request).then((res) => { clearTimeout(timer); resolve(res); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname === '/healthz') return;
  // Seitenaufrufe (auch mit #/… oder ?…) liefern immer die eine App-Seite
  const key = request.mode === 'navigate' ? '/' : url.pathname;
  event.respondWith(
    fromNetwork(request)
      .then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(key, copy));
        }
        return res;
      })
      .catch(async () => (await caches.match(key)) ?? Response.error()),
  );
});
