/* The Cheviva page with no signal (3 Oct 2026). Built by tools/construir-app-web.py; read its header first. */
var COPIA = 'cheviva-demo-pagina-1', PREFIJO = 'cheviva-demo-pagina-';
var BASICOS = ['./', 'manifest.json', 'icono-180.png', 'icono-512.png'];
var INICIO = new URL('./', self.location.href).href;

function guardar(clave, r) {
  // only a plain answer is kept: never an error page, a redirect, or a door's answer
  if (!r || r.redirected || !(r.ok || r.type === 'opaque')) return;
  var copia = r.clone();
  caches.open(COPIA).then(function (c) { return c.put(clave, copia); }).catch(function () {});
}
function guardado(clave) { return caches.open(COPIA).then(function (c) { return c.match(clave); }); }
var ESPERA = 4000;   // a page the website has not sent in 4 s comes from the kept copy, when there is one

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(COPIA).then(function (c) {
    return Promise.all(BASICOS.map(function (u) {
      var clave = new URL(u, self.location.href).href;
      return fetch(clave, { cache: 'no-cache' }).then(function (r) { if (r.ok && !r.redirected) return c.put(clave, r); }).catch(function () {});
    }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  // only this page's older copies go: the live page and the demo share one store
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf(PREFIJO) === 0 && k !== COPIA; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var q = e.request, u = new URL(q.url);
  if (q.method !== 'GET') return;                                     // the door's calls (POST) pass untouched
  if (u.hostname === 'fonts.gstatic.com') {                           // a font file never changes at its address: the kept one first
    e.respondWith(guardado(q.url).then(function (r) { return r || fetch(q).then(function (n) { guardar(q.url, n); return n; }); }));
    return;
  }
  if (u.hostname === 'fonts.googleapis.com') {                        // the fonts' list holds the page's first paint: the kept one
    var nueva = fetch(q).then(function (n) { guardar(q.url, n); return n; });   // first, refreshed behind it
    e.waitUntil(nueva.catch(function () {}));
    e.respondWith(guardado(q.url).then(function (r) { return r || nueva; }));
    return;
  }
  if (u.origin !== self.location.origin) return;                      // anything else from elsewhere passes untouched
  // the page: from the website; the kept copy when it cannot be reached or is slow. Its manifest and icons: the kept
  // ones first, refreshed behind (4 Oct, the simulated iPhone: a home-screen app paints nothing until its manifest came)
  var clave = u.origin + u.pathname;
  if (q.mode === 'navigate' && (clave === INICIO || clave === INICIO + 'index.html')) clave = INICIO;
  var red = fetch(q).then(function (r) { guardar(clave, r); return r; });
  e.waitUntil(red.catch(function () {}));                             // a late answer still replaces the kept copy
  var deLaCopia = function (falla) { return guardado(clave).then(function (r) { if (r) return r; return red; }); };
  if (q.mode !== 'navigate') { e.respondWith(guardado(clave).then(function (r) { return r || red; })); return; }
  e.respondWith(new Promise(function (listo) {
    var hecho = false, dar = function (p) { if (!hecho) { hecho = true; listo(p); } };
    var reloj = setTimeout(function () { guardado(clave).then(function (r) { if (r) dar(r); }); }, ESPERA);
    red.then(function (r) { clearTimeout(reloj); dar(r); }, function (falla) { clearTimeout(reloj); dar(deLaCopia(falla)); });
  }));
});
