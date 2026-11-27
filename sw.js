/* Offline support. When online, the game's files come fresh from the network (and refresh the
   cache), so updates show straight away; when offline, the cached copy is used. Google Fonts are cached the first time they load. */
const VERSION = "owner-1.2.13";
const FILES = ["./", "index.html", "app.css", "owner.css", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png",
  "js/names.js","js/core.js","js/staff.js","js/club.js","js/weather.js","js/match.js","js/events.js","js/cups.js","js/owners.js","js/board.js","js/partners.js","js/legends.js","js/friendlies.js","js/europe.js","js/sale.js","js/season.js","js/market.js","js/appeal.js","js/ui.js","js/ui2.js","js/main.js"];
const FONTS = "owner-fonts";

self.addEventListener("install", e => e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting())));
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== FONTS).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.open(VERSION).then(c => c.match(req, { ignoreSearch: true }))));
  } else if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(FONTS).then(async cache => (await cache.match(req)) || fetch(req).then(res => { cache.put(req, res.clone()); return res; })));
  }
});
