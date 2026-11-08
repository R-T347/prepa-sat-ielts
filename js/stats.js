/* ==========================================================================
   stats.js — tous les calculs : heures cumulées, pourcentage, paliers,
   séries de jours, rythme, cycle de reprise du journal d'erreurs, scores.
   Rien de ce qui est calculé ici n'est enregistré : tout est recalculé à
   chaque affichage, donc toujours à jour.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u;
  const S = P.store;
  const st = {};
  const params = examen => S.d.parametres[examen];
  const somme = seances => seances.reduce((a, s) => a + (Number(s.dureeSec) || 0), 0);

  /* ---------- Heures ---------- */

  // Secondes révisées par jour : Map "AAAA-MM-JJ" → secondes.
  st.secondesParJour = function (examen) {
    const m = new Map();
    S.liste("seances", examen).forEach(s => m.set(s.jour, (m.get(s.jour) || 0) + (Number(s.dureeSec) || 0)));
    return m;
  };
  st.heuresAnterieuresSec = examen => (Number(params(examen).heuresAnterieures) || 0) * 3600;
  st.totalSeancesSec = examen => somme(S.liste("seances", examen));
  // Total = séances + heures faites avant l'appli (réglage).
  st.totalSec = examen => st.totalSeancesSec(examen) + st.heuresAnterieuresSec(examen);
  // Total entre deux jours inclus (heures antérieures non comprises).
  st.periodeSec = (examen, debut, fin) => somme(S.liste("seances", examen).filter(s => s.jour >= debut && s.jour <= fin));

  st.objectifH = examen => { const o = Number(params(examen).objectifHeures); return o > 0 ? o : null; };
  st.pourcentage = examen => { const o = st.objectifH(examen); return o ? st.totalSec(examen) / 3600 / o * 100 : null; };

  st.paliers = examen => (params(examen).paliers || []).filter(n => Number(n) > 0).map(Number).sort((a, b) => a - b);
  st.prochainPalier = function (examen) {
    const h = st.totalSec(examen) / 3600;
    const p = st.paliers(examen).find(x => x > h);
    return p === undefined ? null : p;
  };

  // Jours restants avant l'examen (0 = aujourd'hui), ou null si pas de date.
  st.joursAvantExamen = function (examen) {
    const d = params(examen).dateExamen;
    return u.estJour(d) ? u.ecartJours(u.aujourdhui(), d) : null;
  };

  /* ---------- Séries de jours consécutifs ----------
     Un jour compte si on y a révisé au moins le seuil réglé (15 min par défaut).
     La série actuelle reste valable jusqu'à la fin de la journée : si aujourd'hui
     n'est pas encore validé, on compte à partir d'hier. */
  st.series = function (examen) {
    const seuil = (Number(S.d.parametres.seuilSerieMin) || 0) * 60;
    const valides = new Set();
    st.secondesParJour(examen).forEach((sec, jour) => { if (sec > 0 && sec >= seuil) valides.add(jour); });

    let record = 0, courant = 0, precedent = null;
    Array.from(valides).sort().forEach(j => {
      courant = (precedent && u.ecartJours(precedent, j) === 1) ? courant + 1 : 1;
      record = Math.max(record, courant);
      precedent = j;
    });

    const auj = u.aujourdhui();
    let j = valides.has(auj) ? auj : u.ajouterJours(auj, -1);
    let actuelle = 0;
    while (valides.has(j)) { actuelle++; j = u.ajouterJours(j, -1); }
    return { actuelle: actuelle, record: record, aujourdhuiValide: valides.has(auj) };
  };

  /* ---------- Rythme ----------
     - nécessaire : heures par semaine à faire pour atteindre l'objectif avant l'examen ;
     - réel : moyenne par semaine sur les 28 derniers jours, ou depuis la première
       séance si elle date de moins de 4 semaines (au moins 7 jours pris en compte,
       pour éviter qu'une seule journée donne un chiffre absurde). */
  st.rythme = function (examen) {
    const auj = u.aujourdhui();
    const res = { necessaire: null, reel: null, jours: 0, depuis: null, resteH: null };
    const objectif = st.objectifH(examen);
    const jours = st.joursAvantExamen(examen);
    if (objectif) res.resteH = Math.max(0, objectif - st.totalSec(examen) / 3600);
    if (objectif && jours !== null && jours > 0) res.necessaire = res.resteH / (jours / 7);

    const seances = S.liste("seances", examen);
    if (seances.length) {
      const premier = seances.reduce((m, s) => (s.jour < m ? s.jour : m), auj);
      const ecoules = u.ecartJours(premier, auj) + 1;
      const periode = Math.min(28, ecoules);
      const debut = u.ajouterJours(auj, -(periode - 1));
      res.reel = st.periodeSec(examen, debut, auj) / 3600 / (Math.max(7, periode) / 7);
      res.jours = periode;
      res.depuis = debut;
    }
    return res;
  };

  /* ---------- Objectif du jour ----------
     Temps à faire aujourd'hui pour atteindre l'objectif avant l'examen :
     (heures qui restaient ce matin) ÷ (jours restants, aujourd'hui compris, jour de l'examen exclu).
     enCoursSec : temps de la séance en cours, ajouté à ce qui est déjà fait aujourd'hui.
     Renvoie null si l'objectif d'heures ou la date d'examen manque. */
  st.objectifDuJour = function (examen, enCoursSec) {
    const objectif = st.objectifH(examen);
    const jours = st.joursAvantExamen(examen);
    if (!objectif || jours === null || jours <= 0) return null;
    const auj = u.aujourdhui();
    const dejaAujourdhui = st.periodeSec(examen, auj, auj);
    const resteCeMatin = Math.max(0, objectif * 3600 - (st.totalSec(examen) - dejaAujourdhui));
    const cibleSec = resteCeMatin / jours;
    const faitSec = dejaAujourdhui + (enCoursSec || 0);
    return { cibleSec: cibleSec, faitSec: faitSec, pct: cibleSec > 0 ? Math.min(100, (faitSec / cibleSec) * 100) : 100 };
  };

  /* ---------- Journal d'erreurs ---------- */

  // Une erreur est reprise 3 jours après la date où elle a été faite.
  st.premiereReprise = jour => u.ajouterJours(jour, 3);

  // "a-refaire" (date de reprise arrivée ou dépassée), "en-attente" ou "archivee".
  st.statutErreur = function (e, auj) {
    if (e.archivee) return "archivee";
    return (e.aRefaireLe && e.aRefaireLe <= (auj || u.aujourdhui())) ? "a-refaire" : "en-attente";
  };
  st.erreursARefaire = examen => S.liste("erreurs", examen)
    .filter(e => st.statutErreur(e) === "a-refaire")
    .sort((a, b) => (a.aRefaireLe < b.aRefaireLe ? -1 : a.aRefaireLe > b.aRefaireLe ? 1 : (a.jour < b.jour ? -1 : 1)));

  /* Cycle de reprise, à partir du jour où la question est vraiment refaite :
     - Juste une 1re fois  → nouvelle reprise à J+7 ;
     - Juste une 2e fois de suite → archivée ;
     - Faux → nouvelle reprise à J+3, et le compteur repart de zéro.
     Renvoie les champs à modifier. */
  st.apresReprise = function (e, juste, auj) {
    auj = auj || u.aujourdhui();
    const reprises = (e.reprises || []).concat([{ jour: auj, resultat: juste ? "juste" : "faux" }]);
    if (!juste) return { justesDeSuite: 0, aRefaireLe: u.ajouterJours(auj, 3), archivee: false, reprises: reprises };
    if ((e.justesDeSuite || 0) >= 1) return { justesDeSuite: 2, archivee: true, reprises: reprises };
    return { justesDeSuite: 1, aRefaireLe: u.ajouterJours(auj, 7), archivee: false, reprises: reprises };
  };

  /* ---------- Vocabulaire : révision espacée ----------
     Un mot revient à J+1, puis J+3, puis J+7, puis J+21, à compter du jour de la révision.
     « Je savais » fait passer à l'intervalle suivant ; après J+21 réussi, le mot est acquis.
     « Je ne savais pas » le fait revenir le lendemain et reprendre le cycle au début. */
  st.INTERVALLES_VOCAB = [1, 3, 7, 21];
  st.premiereRevisionMot = jour => u.ajouterJours(jour, st.INTERVALLES_VOCAB[0]);
  st.apresRevisionMot = function (m, savait, auj) {
    auj = auj || u.aujourdhui();
    const I = st.INTERVALLES_VOCAB;
    if (!savait) return { etape: 0, aReviserLe: u.ajouterJours(auj, I[0]), statut: "en cours" };
    const etape = (Number(m.etape) || 0) + 1;
    if (etape >= I.length) return { etape: I.length, aReviserLe: null, statut: "acquis" };
    return { etape: etape, aReviserLe: u.ajouterJours(auj, I[etape]), statut: "en cours" };
  };
  st.motsAReviser = function (auj) {
    auj = auj || u.aujourdhui();
    return S.liste("vocabulaire").filter(m => m.statut !== "acquis" && m.aReviserLe && m.aReviserLe <= auj)
      .sort((a, b) => (a.aReviserLe < b.aReviserLe ? -1 : a.aReviserLe > b.aReviserLe ? 1 : (a.creeLe < b.creeLe ? -1 : 1)));
  };

  /* ---------- Scores ---------- */

  // IELTS : moyenne des 4 épreuves arrondie au demi-band le plus proche
  // (.25 et .75 sont arrondis vers le haut). Ex. 6,25 → 6,5 ; 6,75 → 7 ; 6,125 → 6.
  st.bandGlobal = (l, r, w, s) => Math.round(((l + r + w + s) / 4) * 2) / 2;
  st.totalSat = t => (Number(t.rw) || 0) + (Number(t.math) || 0);
  st.scoreTest = t => t.examen === "sat" ? st.totalSat(t) : st.bandGlobal(t.listening, t.reading, t.writing, t.speaking);
  st.scoreValideSat = n => Number.isInteger(n) && n >= 200 && n <= 800 && n % 10 === 0;
  st.bandValide = n => typeof n === "number" && n >= 0 && n <= 9 && Number.isInteger(n * 2);

  P.stats = st;
})(window.Prepa = window.Prepa || {});
