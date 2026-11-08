/* ==========================================================================
   moteur-timer.js — le moteur du timer de révision.

   Principe : on n'additionne JAMAIS des secondes avec un compteur. On enregistre
   des horodatages (début, début et fin de chaque pause, fin) et on RECALCULE le
   temps à chaque affichage à partir de l'heure actuelle. Le timer survit donc à
   un rechargement, à la fermeture de l'onglet et à la mise en veille du
   téléphone : au retour, le calcul donne le bon temps.

   L'état est enregistré dans le localStorage (clé "prepa.timer") à chaque clic.

   État enregistré :
   {
     etat: "en cours" | "en pause" | "termine",
     examen, section, domaine, competence, note,
     mode: "chrono" | "pomodoro",
     travailMin, pauseMin,          // durées Pomodoro, figées au lancement
     debut: 1794061920000,          // horodatage du lancement (millisecondes)
     pauses: [{ debut, fin }],      // pauses manuelles ; fin = null pendant la pause
     fin: null,                     // horodatage de fin quand on a cliqué « Terminer »
     alerte3hVue: false             // l'alerte « As-tu oublié… » a déjà été affichée
   }
   ========================================================================== */
(function (P) {
  "use strict";

  const CLE = "prepa.timer";
  const T = { e: null }; // e = état du timer en cours, ou null s'il n'y en a pas

  /* ---------- Sauvegarde ---------- */

  T.charger = function () {
    try { T.e = JSON.parse(localStorage.getItem(CLE)); } catch (e) { T.e = null; }
    if (!T.e || typeof T.e.debut !== "number" || !Array.isArray(T.e.pauses)) T.e = null;
    return T.e;
  };
  T.sauver = function () {
    try {
      if (T.e) localStorage.setItem(CLE, JSON.stringify(T.e));
      else localStorage.removeItem(CLE);
    } catch (e) { /* stockage indisponible : le timer continue en mémoire */ }
  };

  /* ---------- Commandes ---------- */

  T.demarrer = function (cfg) {
    const pomodoro = cfg.mode === "pomodoro";
    T.e = {
      etat: "en cours",
      examen: cfg.examen,
      section: cfg.section || null,
      domaine: cfg.domaine || null,
      competence: cfg.competence || null,
      note: cfg.note || "",
      mode: pomodoro ? "pomodoro" : "chrono",
      travailMin: pomodoro ? cfg.travailMin : null,
      pauseMin: pomodoro ? cfg.pauseMin : null,
      debut: Date.now(),
      pauses: [],
      fin: null,
      alerte3hVue: false
    };
    T.sauver();
    return T.e;
  };

  T.pause = function () {
    if (!T.e || T.e.etat !== "en cours") return;
    T.e.pauses.push({ debut: Date.now(), fin: null });
    T.e.etat = "en pause";
    T.sauver();
  };

  T.reprendre = function () {
    if (!T.e) return;
    const maintenant = Date.now();
    if (T.e.etat === "en pause") {
      const p = T.e.pauses[T.e.pauses.length - 1];
      if (p && p.fin === null) p.fin = maintenant;
    } else if (T.e.etat === "termine") {
      // Reprise après « Terminer » : le temps passé depuis compte comme une pause.
      T.e.pauses.push({ debut: T.e.fin, fin: maintenant });
      T.e.fin = null;
    }
    T.e.etat = "en cours";
    T.sauver();
  };

  // Arrête le timer à l'instant donné (par défaut maintenant). La séance n'est pas
  // encore enregistrée : la fenêtre récapitulative s'en charge.
  T.terminer = function (finMs) {
    if (!T.e) return;
    const fin = Math.max(T.e.debut, finMs || Date.now());
    const p = T.e.pauses[T.e.pauses.length - 1];
    if (p && p.fin === null) p.fin = Math.max(p.debut, fin);
    T.e.fin = fin;
    T.e.etat = "termine";
    T.sauver();
  };

  T.effacer = function () {
    T.e = null;
    T.sauver();
    annulerSon();
  };

  /* ---------- Calcul du temps ---------- */

  // Temps « actif » entre le début et l'instant t : on retire les pauses manuelles.
  function actifMs(e, t) {
    let pauses = 0;
    e.pauses.forEach(p => {
      const d = Math.min(p.debut, t);
      const f = Math.min(p.fin === null ? t : p.fin, t);
      if (f > d) pauses += f - d;
    });
    return Math.max(0, t - e.debut - pauses);
  }

  /* Renvoie tout ce qu'il faut afficher, recalculé à partir des horodatages :
     - actif   : temps écoulé hors pauses manuelles (ms)
     - compte  : temps de travail comptabilisé (ms) — c'est lui qui s'ajoute au total
     - Pomodoro uniquement : phase ("travail" | "pause"), cycle (n° du cycle en cours),
       resteDansPhase (ms avant le prochain changement de phase).

     Pomodoro : un cycle = travail + pause. Après n cycles complets et un reste r,
       compte = n × travail + min(r, travail)
     Exemple 25/5, 40 min d'activité : 1 cycle complet (25 min) + 10 min du 2e = 35 min. */
  T.calcul = function (e, t) {
    e = e || T.e;
    if (!e) return null;
    if (e.fin !== null && e.fin !== undefined) t = e.fin;
    else if (t === undefined) t = Date.now();

    const actif = actifMs(e, t);
    const r = { actif: actif, compte: actif, phase: null, cycle: 0, resteDansPhase: null };
    if (e.mode === "pomodoro") {
      const travail = e.travailMin * 60000;
      const pause = e.pauseMin * 60000;
      const cycle = travail + pause;
      const n = Math.floor(actif / cycle);
      const reste = actif - n * cycle;
      r.cycle = n + 1;
      r.compte = n * travail + Math.min(reste, travail);
      r.phase = reste < travail ? "travail" : "pause";
      r.resteDansPhase = reste < travail ? travail - reste : cycle - reste;
    }
    return r;
  };

  /* ---------- Signal sonore ----------
     Le son est produit par le navigateur (Web Audio), sans fichier audio.
     Le prochain changement de phase est programmé directement sur l'horloge audio,
     qui reste précise même quand l'onglet est en arrière-plan (les minuteries
     JavaScript, elles, y sont ralenties). Un téléphone en veille ne garantit pas
     le son : c'est accepté, le temps compté reste juste dans tous les cas. */

  let ctx = null;        // contexte audio, créé lors d'un clic (exigence des navigateurs)
  let programme = null;  // { a: horodatage prévu, noeuds: [oscillateurs] }

  T.debloquerSon = function () {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
      }
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) { /* pas de son possible : sans gravité */ }
  };

  function bip(quand, frequence) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = frequence;
    g.gain.setValueAtTime(0.0001, quand);
    g.gain.exponentialRampToValueAtTime(0.35, quand + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, quand + 0.35);
    o.connect(g);
    g.connect(ctx.destination);
    o.start(quand);
    o.stop(quand + 0.4);
    return o;
  }
  // Trois bips, dans « dansSec » secondes.
  function signal(dansSec) {
    const t0 = ctx.currentTime + Math.max(0, dansSec);
    return [bip(t0, 880), bip(t0 + 0.45, 880), bip(t0 + 0.9, 1175)];
  }
  function annulerSon() {
    if (!programme) return;
    // On n'interrompt pas un signal déjà en train de sonner.
    if (programme.a > Date.now() + 100) {
      programme.noeuds.forEach(n => { try { n.stop(); } catch (e) { /* déjà arrêté */ } });
    }
    programme = null;
  }

  T.testerSon = function () {
    T.debloquerSon();
    if (ctx) signal(0.05);
  };

  // Programme un signal dans « sec » secondes (utilisé par le simulateur de Speaking).
  // Renvoie de quoi l'annuler, ou null si le son est coupé ou indisponible.
  T.signalDans = function (sec) {
    T.debloquerSon();
    if (!ctx || !P.store.d.parametres.son) return null;
    return { a: Date.now() + sec * 1000, noeuds: signal(sec) };
  };
  T.annulerSignal = function (s) {
    if (!s || s.a <= Date.now() + 100) return; // déjà en train de sonner : on le laisse finir
    s.noeuds.forEach(n => { try { n.stop(); } catch (e) { /* déjà arrêté */ } });
  };

  // Appelée régulièrement : programme le signal du prochain changement de phase.
  T.planifierSon = function () {
    const e = T.e;
    const actif = ctx && ctx.state === "running" && e && e.mode === "pomodoro" &&
      e.etat === "en cours" && P.store.d.parametres.son;
    if (!actif) { annulerSon(); return; }
    const c = T.calcul(e);
    const cible = Date.now() + c.resteDansPhase;
    if (programme && Math.abs(programme.a - cible) < 1500) return; // déjà programmé
    annulerSon();
    programme = { a: cible, noeuds: signal(c.resteDansPhase / 1000) };
  };

  P.timer = T;
})(window.Prepa = window.Prepa || {});
