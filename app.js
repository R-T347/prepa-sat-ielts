/* ==========================================================================
   app.js — démarrage de l'appli, navigation entre les pages, et mise à jour
   régulière du timer en cours (barre en haut, titre de l'onglet, son).

   Les adresses des pages sont de la forme :
     #/                      Accueil
     #/sat/timer             onglet Timer de l'espace SAT
     #/ielts/journal         onglet Journal d'erreurs de l'espace IELTS
     #/sat/journal/reprises  reprises du jour (journal d'erreurs)
     #/parametres            Paramètres
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, T = P.timer;
  const TITRE = "Prépa SAT · IELTS";

  // Onglets de chaque espace (dans l'ordre d'affichage). L'espace IELTS en a trois de plus.
  const ONGLETS_COMMUNS = [
    { id: "timer", nom: "Timer" },
    { id: "progression", nom: "Progression" },
    { id: "programme", nom: "Programme" },
    { id: "plan", nom: "Plan" },
    { id: "tests", nom: "Tests blancs" },
    { id: "journal", nom: "Journal d'erreurs" },
    { id: "taches", nom: "Tâches & ressources" }
  ];
  const ONGLETS = {
    sat: ONGLETS_COMMUNS.slice(0, 3).concat([{ id: "cours", nom: "Cours" }], ONGLETS_COMMUNS.slice(3)),
    ielts: ONGLETS_COMMUNS.concat([
      { id: "vocabulaire", nom: "Vocabulaire" },
      { id: "writing", nom: "Writing" },
      { id: "speaking", nom: "Speaking" }
    ])
  };

  /* ---------- Navigation ---------- */

  function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "parametres") return { page: "parametres" };
    if (parts[0] === "glossaire") return { page: "glossaire" };
    if (parts[0] === "sat" || parts[0] === "ielts") {
      const onglet = ONGLETS[parts[0]].some(o => o.id === parts[1]) ? parts[1] : "timer";
      return { page: onglet, examen: parts[0], onglet: onglet, sous: parts[2] || null, chemin: parts.slice(2) };
    }
    return { page: "accueil" };
  }

  // Barre d'onglets d'un espace. Le bouton « Format » ouvre le résumé du format de l'examen.
  function ongletsHTML(r) {
    const nom = P.PROGRAMME[r.examen].nom;
    return '<nav class="onglets" aria-label="Onglets ' + nom + '"><span class="onglets-titre">' + nom + "</span>" +
      '<button type="button" class="onglets-format" data-format aria-label="Format de l\'examen ' + nom + '">' + P.icone("info") + "Format</button>" +
      ONGLETS[r.examen].map(o => '<a href="#/' + r.examen + "/" + o.id + '"' +
        (o.id === r.onglet ? ' class="actif" aria-current="page"' : "") + ">" + u.esc(o.nom) + "</a>").join("") +
      "</nav>";
  }

  // Fenêtre « Format de l'examen » (contenu tiré de programme.js).
  function ouvrirFormat(examen) {
    const ex = P.PROGRAMME[examen];
    P.ui.modale({
      titre: "Format de l'examen " + ex.nom,
      html: '<ul class="format-liste">' + ex.format.map(l => "<li>" + u.esc(l) + "</li>").join("") + "</ul>" +
        '<ul class="liste">' + P.prog.sections(examen).map(s => '<li class="item"><strong>' + u.esc(s.nom) + "</strong>" +
          (s.info ? '<div class="item-note">' + u.esc(s.info) + "</div>" : "") +
          (s.fr ? '<div class="aide">' + u.esc(s.fr) + "</div>" : "") + "</li>").join("") + "</ul>",
      boutons: [{ texte: "Fermer", classe: "btn-primaire" }]
    });
  }

  function majNav(r) {
    const memo = S.appareil().onglets || {};
    document.querySelectorAll(".nav-principale a").forEach(l => {
      const cle = l.dataset.nav;
      const actif = cle === "accueil" ? r.page === "accueil" : (cle === "parametres" || cle === "glossaire") ? r.page === cle : r.examen === cle;
      l.classList.toggle("actif", actif);
      if (actif) l.setAttribute("aria-current", "page"); else l.removeAttribute("aria-current");
      // SAT et IELTS rouvrent le dernier onglet utilisé dans l'espace.
      if (cle === "sat" || cle === "ielts") l.setAttribute("href", "#/" + cle + "/" + (memo[cle] || "timer"));
    });
  }

  let routePrecedente = null;
  let routeAvant = null; // la route affichée juste avant (pour le sens de la transition)
  const memoOnglets = new Map(); // position de défilement de la barre d'onglets, par espace

  /* ---------- Transition entre les pages : glissement selon le sens + cartes en cascade ----------
     Les pages sont rangées de gauche à droite : Accueil, SAT, IELTS, Glossaire, Paramètres ;
     dans un espace, les onglets dans leur ordre ; et plus on entre dans le cours, plus on va
     « vers la droite ». Aller vers la droite fait arriver la page par la droite, et inversement.
     Seulement quand on change de page (jamais quand on coche une case ou que le chrono avance),
     et jamais si le téléphone demande de réduire les animations. */
  const ORDRE_NAV = { accueil: 0, sat: 1, ielts: 2, glossaire: 3, parametres: 4 };
  function position(r) {
    const espace = r.examen || r.page;
    return [
      ORDRE_NAV[espace] !== undefined ? ORDRE_NAV[espace] : 0,
      r.examen ? ONGLETS[r.examen].findIndex(o => o.id === r.onglet) : 0,
      r.chemin ? r.chemin.length : 0
    ];
  }
  function sens(a, b) {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    return 0;
  }
  function animerEntree(el, r, avant) {
    if (!el.animate || document.hidden || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches)) return;
    const s = avant ? sens(position(r), position(avant)) : 0;
    const memeEspace = avant && avant.examen && avant.examen === r.examen;
    // Dans un même espace, la barre d'onglets reste en place : seul le contenu bouge.
    const blocs = Array.from(el.children).filter(c => !(memeEspace && c.classList.contains("onglets")));
    blocs.slice(0, 8).forEach((c, k) => c.animate(
      [{ opacity: 0, transform: "translate(" + (s * 28) + "px, " + (s ? 6 : 14) + "px)" }, { opacity: 1, transform: "none" }],
      { duration: 380, delay: k * 45, easing: "cubic-bezier(.2, .8, .2, 1)", fill: "backwards" }
    ));
  }

  // Affiche la page correspondant à l'adresse. garder = conserver la position de défilement.
  function afficher(garder) {
    const r = route();
    const vue = P.vues[r.page] || P.vues.accueil;
    const y = window.scrollY;

    if (r.examen) {
      const memo = S.appareil().onglets || {};
      if (memo[r.examen] !== r.onglet) S.majAppareil({ onglets: Object.assign({}, memo, { [r.examen]: r.onglet }) });
    }
    majNav(r);

    const el = document.createElement("div");
    el.className = "vue vue-" + r.page;
    document.body.classList.remove("mode-focus"); // la vue Timer le remet si besoin
    el.innerHTML = (r.examen ? ongletsHTML(r) : "") + vue.rendre(r);
    document.getElementById("contenu").replaceChildren(el);
    const boutonFormat = el.querySelector("[data-format]");
    if (boutonFormat) boutonFormat.addEventListener("click", () => ouvrirFormat(r.examen));
    if (vue.monter) vue.monter(el, r);

    const cle = location.hash;
    const nouvellePage = cle !== routePrecedente;
    window.scrollTo(0, (garder || !nouvellePage) ? y : 0);
    if (nouvellePage) animerEntree(el, r, routeAvant);
    const memeEspace = routeAvant && routeAvant.examen && routeAvant.examen === r.examen;
    routePrecedente = cle;
    routeAvant = r;

    const actif = el.querySelector(".onglets a.actif");
    if (actif && actif.parentNode.scrollTo) {
      const nav = actif.parentNode;
      // Dans un même espace, la barre d'onglets glisse doucement jusqu'à l'onglet choisi.
      if (memeEspace && nouvellePage && memoOnglets.has(r.examen)) nav.scrollLeft = memoOnglets.get(r.examen);
      nav.scrollTo({ left: actif.offsetLeft - (nav.clientWidth - actif.offsetWidth) / 2, behavior: memeEspace && nouvellePage ? "smooth" : "auto" });
      if (r.examen) memoOnglets.set(r.examen, actif.offsetLeft - (nav.clientWidth - actif.offsetWidth) / 2);
    }
    tic();
    // Un palier d'heures vient d'être franchi ? (célébration une seule fois par palier)
    if (P.paliers && !T.e) P.paliers.verifier();
  }

  /* ---------- Timer en cours : mise à jour régulière ---------- */

  function libelleEtat(e, c) {
    if (e.etat === "termine") return "Terminée, à enregistrer";
    if (e.etat === "en pause") return "En pause";
    if (e.mode === "pomodoro") return c.phase === "pause" ? "Pause" : "Travail";
    return "En cours";
  }

  let phasePrecedente = null;

  // Appelée deux fois par seconde. Comme le temps est recalculé à partir des
  // horodatages, peu importe que le navigateur ralentisse cet appel en arrière-plan.
  /* ---------- Écran allumé pendant une séance ----------
     Si l'option est active (Paramètres, réglage propre à l'appareil), on demande au
     navigateur de ne pas mettre l'écran en veille tant qu'un timer est lancé.
     Le navigateur lève cette demande quand l'appli passe en arrière-plan : on la
     renouvelle au retour. Sans prise en charge, rien ne se passe. */
  let verrouEcran = null, demandeVerrou = false, verrouRefuseJusqua = 0;
  function majVerrouEcran() {
    if (!("wakeLock" in navigator)) return;
    const voulu = !!T.e && T.e.etat !== "termine" && S.appareil().ecranAllume !== false && document.visibilityState === "visible";
    if (voulu && !verrouEcran && !demandeVerrou && Date.now() > verrouRefuseJusqua) {
      demandeVerrou = true;
      navigator.wakeLock.request("screen")
        .then(v => { verrouEcran = v; v.addEventListener("release", () => { verrouEcran = null; }); })
        .catch(() => { verrouRefuseJusqua = Date.now() + 60000; }) // refusé (économie de batterie…) : on réessaie dans 1 min
        .finally(() => { demandeVerrou = false; });
    } else if (!voulu && verrouEcran) {
      const v = verrouEcran;
      verrouEcran = null;
      v.release().catch(() => {});
    }
  }

  function tic() {
    if (P.vues.speaking && P.vues.speaking.tic) P.vues.speaking.tic(); // simulateur de Speaking
    majVerrouEcran();
    const e = T.e;
    const barre = document.getElementById("barre-timer");
    if (!e) {
      if (!barre.hidden) { barre.hidden = true; document.body.classList.remove("avec-timer"); }
      if (document.title !== TITRE) document.title = TITRE;
      phasePrecedente = null;
      T.planifierSon();
      return;
    }
    const c = T.calcul(e);
    const nomEx = P.PROGRAMME[e.examen] ? P.PROGRAMME[e.examen].nom : e.examen;
    const lib = libelleEtat(e, c);
    const repos = e.etat !== "en cours" || c.phase === "pause";
    barre.className = "barre-timer " + (e.etat === "termine" ? "etat-termine" : repos ? "etat-pause" : "etat-cours");
    barre.setAttribute("href", "#/" + e.examen + "/timer");
    barre.innerHTML = "<span>" + u.esc(nomEx) + '</span><span class="sep"></span><span>' + u.esc(lib) + "</span><strong>" + u.chrono(c.compte) + "</strong>";
    if (barre.hidden) { barre.hidden = false; document.body.classList.add("avec-timer"); }
    document.title = u.chrono(c.compte) + " · " + lib + " · " + nomEx;

    if (P.vues.timer && P.vues.timer.majDirect) P.vues.timer.majDirect(c);

    // Vibration au changement de phase Pomodoro, si l'appli est à l'écran.
    if (e.mode === "pomodoro" && e.etat === "en cours") {
      if (phasePrecedente && phasePrecedente !== c.phase && document.visibilityState === "visible" && navigator.vibrate) {
        try { navigator.vibrate([200, 100, 200]); } catch (er) { /* sans gravité */ }
      }
      phasePrecedente = c.phase;
    } else {
      phasePrecedente = null;
    }

    // Plus de 3 heures sans arrêt : « As-tu oublié d'arrêter le timer ? »
    if (e.etat === "en cours" && !e.alerte3hVue && c.actif > 3 * 3600000 && P.vues.timer) P.vues.timer.alerte3h();

    T.planifierSon();
  }

  /* ---------- Thème ---------- */

  // Couleurs proposées dans les Paramètres (la première est celle par défaut).
  const COULEURS = [
    ["#ff7a3d", "Orange"], ["#6ea8ff", "Bleu"], ["#5fd39b", "Vert"], ["#b58cff", "Violet"],
    ["#ff6b8a", "Rose"], ["#f2c14e", "Or"], ["#4fd1d9", "Turquoise"]
  ];

  // Thème (clair, sombre, automatique) et couleur d'accent, propres à l'appareil.
  function appliquerTheme() {
    const a = S.appareil();
    const t = a.theme;
    const racine = document.documentElement;
    if (t === "clair" || t === "sombre") racine.setAttribute("data-theme", t);
    else racine.removeAttribute("data-theme");
    const accent = /^#[0-9a-f]{6}$/i.test(a.accent || "") ? a.accent : COULEURS[0][0];
    const [r, g, b] = [1, 3, 5].map(i => parseInt(accent.slice(i, i + 2), 16));
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    racine.style.setProperty("--accent", accent);
    racine.style.setProperty("--accent-doux", "rgba(" + r + "," + g + "," + b + ",.22)");
    racine.style.setProperty("--accent-texte", luminance > 0.45 ? "#14100d" : "#ffffff");
    if (P.fond) P.fond.dessiner();
  }

  /* ---------- Démarrage ---------- */

  function demarrer() {
    S.charger();
    T.charger();
    if (!S.appareil().premierLancement) S.majAppareil({ premierLancement: u.iso() });
    appliquerTheme();

    // Demande au navigateur de ne pas effacer les données en cas de manque de place.
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* non pris en charge */ }

    window.addEventListener("hashchange", () => afficher(false));

    // Une autre fenêtre de l'appli a modifié les données ou le timer : on se met à jour.
    window.addEventListener("storage", ev => {
      if (ev.key === S.CLES.timer) { T.charger(); afficher(true); }
      else if (ev.key === S.CLES.donnees) { S.charger(); afficher(true); }
      else if (ev.key === S.CLES.appareil) appliquerTheme();
    });

    // Retour sur l'onglet (ou réveil du téléphone) : recalcul immédiat.
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") tic(); });
    window.addEventListener("pageshow", () => tic());

    // Les navigateurs n'autorisent le son qu'après un geste de l'utilisateur.
    document.addEventListener("pointerdown", () => T.debloquerSon(), { passive: true });
    document.addEventListener("keydown", () => T.debloquerSon());

    // Redessine la page si la largeur change (graphiques).
    let largeur = window.innerWidth, attente = null;
    window.addEventListener("resize", () => {
      clearTimeout(attente);
      attente = setTimeout(() => {
        if (window.innerWidth !== largeur) { largeur = window.innerWidth; afficher(true); }
      }, 250);
    });

    installable();

    // Synchronisation Google Drive : l'écran se met à jour quand son état change.
    P.synchro.demarrer();
    document.addEventListener("synchro", () => { const p = route().page; if ((p === "parametres" || p === "accueil") && !document.querySelector(".modale-fond")) afficher(true); });

    afficher(false);
    setInterval(tic, 500);
  }

  /* ---------- Version installable (PWA) ----------
     Uniquement quand l'appli est en ligne (adresse http ou https) : un fichier ouvert en
     double-clic ne peut pas être installé. Le « service worker » (sw.js) garde une copie
     des fichiers pour que l'appli s'ouvre même sans connexion. */
  let invitation = null; // proposition d'installation de Chrome / Edge (Android, ordinateur)

  function installable() {
    if (!/^https?:$/.test(location.protocol)) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => { /* hors ligne impossible, l'appli marche quand même */ });
    }
    window.addEventListener("beforeinstallprompt", ev => {
      ev.preventDefault();
      invitation = ev;
      if (route().page === "parametres") afficher(true);
    });
    window.addEventListener("appinstalled", () => {
      invitation = null;
      P.ui.toast("Appli installée");
    });
  }

  // Informations pour la carte « Installer l'appli » des Paramètres.
  function etatInstallation() {
    const ua = navigator.userAgent;
    return {
      enLigne: /^https?:$/.test(location.protocol),
      installee: window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
      ios: /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1),
      invitation: !!invitation
    };
  }
  function proposerInstallation() {
    if (!invitation) return;
    invitation.prompt();
    invitation.userChoice.finally(() => { invitation = null; afficher(true); });
  }

  P.app = {
    rafraichir: () => afficher(true),
    aller: function (hash) { if (location.hash === hash) afficher(false); else location.hash = hash; },
    appliquerTheme: appliquerTheme,
    COULEURS: COULEURS,
    libelleEtat: libelleEtat,
    etatInstallation: etatInstallation,
    proposerInstallation: proposerInstallation
  };

  demarrer();
})(window.Prepa = window.Prepa || {});
