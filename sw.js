const CACHE = 'health-v1';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
];

// ── Install: cache app shell ──────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(APP_ASSETS)));
  self.skipWaiting();
});

// ── Activate: remove old caches ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Generate PWA icons dynamically via OffscreenCanvas
  if (url.includes('/icons/icon-')) {
    const size = url.includes('512') ? 512 : 192;
    e.respondWith(generateIcon(size));
    return;
  }

  // CDN resources (Chart.js): network-first, cache fallback
  if (url.startsWith('https://cdn.')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // App assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Icon generator ────────────────────────────────────────
async function generateIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  const r      = size * 0.18; // corner radius

  // Rounded square background (#6a9a6b)
  ctx.fillStyle = '#6a9a6b';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(size - r, 0);
  ctx.quadraticCurveTo(size, 0, size, r);
  ctx.lineTo(size, size - r);
  ctx.quadraticCurveTo(size, size, size - r, size);
  ctx.lineTo(r, size);
  ctx.quadraticCurveTo(0, size, 0, size - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();

  // Leaf emoji centered
  const fs = Math.round(size * 0.52);
  ctx.font          = `${fs}px serif`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.fillText('🌿', size / 2, size / 2 + size * 0.03);

  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Response(blob, { headers: { 'Content-Type': 'image/png' } });
}
