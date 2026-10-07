// Network first, so every update you push shows up on the next load; the cached copy is used when you're offline, or when
// the network is too slow to answer (a phone on one bar): then the page opens from the cache straight away, the network's
// answer still lands in the cache, and the next load is the new version.
const CACHE = 'halfball-v1', FONTS = 'halfball-fonts';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon-32.png', './favicon.svg', './apple-touch-icon.png', './icon-192-maskable.png', './icon-512-maskable.png', './engine.js', './table3d.js', './music.js', './stats.js', './app.css', './geom.js', './whatsnew.js', './steps.js', './state.js', './perf.js', './audio.js', './grades.js', './deal.js', './shot.js', './view.js', './anim.js', './modes.js', './lessons.js', './ui.js', './main.js', './vendor/three.min.js', './shots.bin'];
const SLOW = 3500;   // ms to wait for the network before opening from the cache (only when there is a cached copy)
let staleUntil = 0;  // after the page itself came from the cache, its files do too for a moment, so they're all one version
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(()=>{})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin && url.pathname.startsWith('/dev/')) return;   // the test copy: never cached, never served from here
  // the web fonts: from the cache at once when we have them (they never change), refreshed in the background
  if (/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; });
      if (hit) { e.waitUntil(net.catch(()=>{})); return hit; }
      return net;
    })));
    return;
  }
  if (url.origin !== location.origin) return;   // anything else from elsewhere: the browser's own way
  const nav = req.mode === 'navigate';
  // always ask the server (GitHub Pages lets browsers reuse a page for 10 minutes otherwise)
  const net = fetch(req.url, {cache: 'no-cache', credentials: 'same-origin'}).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  });
  e.waitUntil(net.catch(()=>{}));   // let the cache update finish even when the cached copy answered first
  const cached = () => caches.match(req).then(r => r || (nav ? caches.match('./index.html') : undefined));
  e.respondWith((async () => {
    if (!nav && Date.now() < staleUntil) { const r = await caches.match(req); if (r) return r; }
    let timer;
    const slow = new Promise(res => { timer = setTimeout(res, SLOW); });
    const first = await Promise.race([net.then(r => ({r}), () => ({fail: true})), slow.then(() => ({slow: true}))]);
    clearTimeout(timer);
    if (first.r) return first.r;
    const r = await cached();
    if (r) { if (nav && first.slow) staleUntil = Date.now() + 30000; return r; }
    return net;   // nothing cached: wait for the network after all (or fail as before)
  })());
});
