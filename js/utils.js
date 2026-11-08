/* ==========================================================================
   utils.js — petits outils partagés par toute l'appli :
   identifiants, dates (toujours en heure locale), formats d'affichage,
   et accès au contenu de programme.js.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = {};
  const p2 = n => String(n).padStart(2, "0");

  /* ---------- Identifiants ---------- */

  // Identifiant unique au format UUID. crypto.randomUUID n'existe pas partout,
  // on prévoit donc une solution de secours.
  u.uuid = function () {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (e) { /* on passe à la suite */ }
    }
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
    return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20);
  };

  /* ---------- Dates ----------
     Deux sortes de dates dans l'appli :
     - les instants, au format ISO : "2026-11-07T14:32:05.120Z" ;
     - les jours, au format "AAAA-MM-JJ", calculés à l'heure de l'appareil.
       Une erreur saisie à 0 h 30 tombe donc bien le jour même. */

  u.iso = ms => new Date(ms === undefined ? Date.now() : ms).toISOString();

  // Jour local "AAAA-MM-JJ" d'une date (ou d'aujourd'hui).
  u.jour = function (d) {
    if (d === undefined) d = new Date();
    else if (!(d instanceof Date)) d = new Date(d);
    return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
  };
  u.aujourdhui = () => u.jour();
  u.estJour = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

  // "2026-11-07" → objet Date à minuit, heure locale.
  u.dateDuJour = function (j) {
    const [a, m, d] = j.split("-").map(Number);
    return new Date(a, m - 1, d);
  };
  u.ajouterJours = function (j, n) {
    const d = u.dateDuJour(j);
    d.setDate(d.getDate() + n);
    return u.jour(d);
  };
  // Nombre de jours de a à b (positif si b est après a). Insensible aux changements d'heure.
  u.ecartJours = function (a, b) {
    const [a1, m1, d1] = a.split("-").map(Number);
    const [a2, m2, d2] = b.split("-").map(Number);
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
  };
  // Lundi de la semaine qui contient ce jour (semaines du lundi au dimanche).
  u.lundi = function (j) {
    const d = u.dateDuJour(j);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return u.jour(d);
  };

  // Pour les champs <input type="datetime-local"> : ms → "AAAA-MM-JJTHH:MM" et inversement.
  u.versDateHeureLocale = function (ms) {
    const d = new Date(ms);
    return u.jour(d) + "T" + p2(d.getHours()) + ":" + p2(d.getMinutes());
  };
  u.depuisDateHeureLocale = function (s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || "");
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]).getTime();
  };

  /* ---------- Formats d'affichage ---------- */

  const fmtLong = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const fmtLongAnnee = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const fmtCourt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
  const fmtCourtAnnee = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const anneeEnCours = () => new Date().getFullYear();

  // "samedi 7 novembre" (l'année n'est ajoutée que si ce n'est pas l'année en cours)
  u.jourLong = j => { const d = u.dateDuJour(j); return (d.getFullYear() === anneeEnCours() ? fmtLong : fmtLongAnnee).format(d); };
  // "7 nov."
  u.jourCourt = j => { const d = u.dateDuJour(j); return (d.getFullYear() === anneeEnCours() ? fmtCourt : fmtCourtAnnee).format(d); };
  // "14:32"
  u.heureMin = ms => { const d = new Date(ms); return p2(d.getHours()) + ":" + p2(d.getMinutes()); };

  // Durée lisible : 3725 s → "1 h 02" ; 300 s → "5 min"
  u.duree = function (sec) {
    const min = Math.round(Math.max(0, sec) / 60);
    const h = Math.floor(min / 60), m = min % 60;
    return h === 0 ? m + " min" : h + " h " + p2(m);
  };
  // Affichage chronomètre : ms → "1:02:05" ou "25:00"
  u.chrono = function (ms) {
    const t = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    return h > 0 ? h + ":" + p2(m) + ":" + p2(s) : p2(m) + ":" + p2(s);
  };
  // Nombre à la française : 12.5 → "12,5" ; 1500 → "1 500"
  u.nombre = (n, dec = 1) => Number(n).toLocaleString("fr-FR", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
  // Heures avec une décimale : 134 400 s → "37,3"
  u.heures = sec => u.nombre(Math.floor(sec / 360) / 10, 1);
  // Même chose arrondi au dixième supérieur, pour ce qu'il reste à faire (« encore 12,7 h »).
  u.heuresReste = sec => u.nombre(Math.ceil(Math.max(0, sec) / 360) / 10, 1);
  // Accord : 0 ou 1 → singulier (règle française), 2 et plus → pluriel
  u.accord = (n, sing, plur) => Math.abs(n) >= 2 ? (plur || sing + "s") : sing;

  // Lecture d'un nombre saisi (accepte la virgule). Renvoie null si vide ou invalide.
  u.lireNombre = function (v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().replace(",", ".");
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  // Adresse web saisie : "khanacademy.org/x" → "https://khanacademy.org/x" ; null si invalide.
  u.normaliserUrl = function (texte) {
    let s = (texte || "").trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    try {
      const url = new URL(s);
      return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".") ? url.href : null;
    } catch (e) { return null; }
  };

  // Nombre de mots d'un texte (un mot = une suite de caractères contenant au moins une lettre ou un chiffre).
  u.compterMots = texte => String(texte || "").trim().split(/\s+/).filter(m => /[\p{L}\p{N}]/u.test(m)).length;

  // Texte simplifié pour comparer des noms : minuscules, sans accents ni ponctuation.
  u.simplifier = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

  // Échappe le texte avant de l'insérer dans du HTML (protège contre le code injecté).
  u.esc = s => String(s === null || s === undefined ? "" : s)
    .replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  P.u = u;

  /* ---------- Accès au programme (programme.js) ---------- */

  const prog = {};

  // Variante IELTS choisie dans les Paramètres ("academic" ou "general").
  prog.variante = () => (P.store && P.store.d) ? P.store.d.parametres.ielts.variante : "academic";

  // Sections affichées pour un examen (selon la variante IELTS).
  prog.sections = function (examen) {
    const ex = P.PROGRAMME[examen];
    if (!ex) return [];
    const v = prog.variante();
    return ex.sections.filter(s => !s.variante || s.variante === v);
  };
  // Toutes les sections portant cet id, la variante active en premier.
  function sectionsId(examen, sId) {
    const ex = P.PROGRAMME[examen];
    if (!ex || !sId) return [];
    const v = prog.variante();
    const autre = s => (s.variante && s.variante !== v) ? 1 : 0;
    return ex.sections.filter(s => s.id === sId).sort((a, b) => autre(a) - autre(b));
  }
  prog.section = (examen, sId) => sectionsId(examen, sId)[0] || null;
  prog.domaines = (examen, sId) => { const s = prog.section(examen, sId); return s ? s.domaines : []; };
  prog.domaine = function (examen, sId, dId) {
    if (!dId) return null;
    for (const s of sectionsId(examen, sId)) {
      const d = s.domaines.find(x => x.id === dId);
      if (d) return d;
    }
    return null;
  };
  prog.competences = (examen, sId, dId) => { const d = prog.domaine(examen, sId, dId); return d ? d.competences : []; };
  prog.competence = function (examen, sId, dId, cId) {
    if (!cId) return null;
    for (const s of sectionsId(examen, sId)) {
      const d = s.domaines.find(x => x.id === dId);
      const c = d && d.competences.find(x => x.id === cId);
      if (c) return c;
    }
    return null;
  };

  // Libellé lisible : "Math › Advanced Math › Nonlinear functions".
  // Un id qui n'existe plus dans programme.js est signalé au lieu de disparaître.
  prog.chemin = function (o) {
    const parts = [];
    if (o.section) { const s = prog.section(o.examen, o.section); parts.push(s ? s.nom : "Section inconnue (" + o.section + ")"); }
    if (o.domaine) { const d = prog.domaine(o.examen, o.section, o.domaine); parts.push(d ? d.nom : "Domaine inconnu (" + o.domaine + ")"); }
    if (o.competence) { const c = prog.competence(o.examen, o.section, o.domaine, o.competence); parts.push(c ? c.nom : "Compétence inconnue (" + o.competence + ")"); }
    return parts.join(" › ");
  };

  P.prog = prog;
})(window.Prepa = window.Prepa || {});
