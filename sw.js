/* ==========================================================================
   sw.js — le « service worker » : il garde une copie de tous les fichiers de
   l'appli pour qu'elle s'ouvre même sans connexion (une fois mise en ligne et
   ouverte au moins une fois).

   Fonctionnement : l'appli s'ouvre toujours tout de suite avec la copie gardée,
   et le service worker vérifie en arrière-plan s'il existe une version plus récente.
   Après une mise à jour en ligne, la nouvelle version apparaît donc à la
   DEUXIÈME ouverture de l'appli.

   Si tu ajoutes un fichier à l'appli, ajoute-le aussi à la liste FICHIERS, et
   change le numéro de VERSION pour forcer une copie complète et propre.
   Tes données (localStorage) ne sont jamais touchées par ce fichier.
   ========================================================================== */
const VERSION = "prepa-v13";
const FICHIERS = [
  "./",
  "index.html",
  "style.css",
  "programme.js",
  "app.js",
  "manifest.webmanifest",
  "js/utils.js",
  "js/store.js",
  "js/synchro.js",
  "js/moteur-timer.js",
  "js/stats.js",
  "js/icones.js",
  "js/ui.js",
  "js/fond.js",
  "js/graphiques.js",
  "js/paliers.js",
  "js/fin-seance.js",
  "js/cours-sat.js",
  "js/cours.js",
  "js/import-csv.js",
  "js/vues/accueil.js",
  "js/vues/timer.js",
  "js/vues/progression.js",
  "js/vues/onglet-programme.js",
  "js/vues/plan.js",
  "js/vues/tests.js",
  "js/vues/journal.js",
  "js/vues/taches.js",
  "js/vues/vocabulaire.js",
  "js/vues/cours.js",
  "js/vues/glossaire.js",
  "js/vues/writing.js",
  "js/vues/speaking.js",
  "js/vues/parametres.js",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/icone-maskable-512.png",
  "icones/apple-touch-icon.png",
  "icones/favicon-32.png"
];

// Installation : copie de tous les fichiers.
self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(VERSION)
      .then(cache => cache.addAll(FICHIERS.map(f => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

// Activation : suppression des copies des versions précédentes.
self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles.filter(c => c.startsWith("prepa-") && c !== VERSION).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

// Chaque demande de fichier : on répond avec la copie gardée (rapide, et marche hors
// ligne), et on met cette copie à jour en arrière-plan si le réseau répond.
self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  const cle = req.mode === "navigate" ? "index.html" : req;
  ev.respondWith(caches.open(VERSION).then(async cache => {
    const copie = await cache.match(cle, { ignoreSearch: true });
    const reseau = fetch(req.url, { cache: "no-cache" })
      .then(rep => { if (rep && rep.ok) cache.put(cle, rep.clone()); return rep; })
      .catch(() => null);
    if (copie) {
      ev.waitUntil(reseau);
      return copie;
    }
    const rep = await reseau;
    return rep || new Response("Hors ligne : ce fichier n'a pas encore été enregistré sur cet appareil.", {
      status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }));
});
