// Vesta offline cache. Pages load fresh when online (so updates show right away)
// and fall back to the cached copy offline; icons and fonts come from cache first.
const CACHE = "vesta-v14";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  const isLib = url.hostname === "cdn.jsdelivr.net";   // natural-voice engine code (pinned versions)
  if (url.origin !== self.location.origin && !isFont && !isLib) return;

  const isPage = req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith(".html") || url.pathname.endsWith(".webmanifest");

  if (isPage){
    event.respondWith(
      fetch(req, { cache: "no-store" })
        .then(res => {
          if (res && res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});
