/* ==========================================================================
   vues/timer.js — l'onglet Timer : lancement d'une séance, séance en cours,
   fenêtre récapitulative, ajout manuel, historique des séances, alerte 3 h.
   Le calcul du temps lui-même est dans moteur-timer.js.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, T = P.timer, st = P.stats, ui = P.ui;
  P.vues = P.vues || {};

  const ORIGINES = { chrono: "Chrono", pomodoro: "Pomodoro", manuelle: "Ajoutée à la main" };
  let limite = 30; // nombre de séances affichées dans l'historique
  let focus = true; // mode focus : plein écran épuré pendant une séance (activé au lancement)

  /* ---------- Derniers choix (propres à l'appareil) ---------- */

  function derniers(examen) {
    const a = S.appareil();
    return (a.derniers && a.derniers[examen]) || {};
  }
  function memoriser(examen, choix) {
    const a = S.appareil();
    const tous = Object.assign({}, a.derniers);
    tous[examen] = Object.assign({}, tous[examen], choix);
    S.majAppareil({ derniers: tous, dernierExamen: examen });
  }

  function resume(examen, v) {
    const chemin = P.prog.chemin(Object.assign({ examen: examen }, v));
    return P.PROGRAMME[examen].nom + (chemin ? " › " + chemin : " · sujet libre");
  }

  /* ---------- Champs de durée (heures + minutes) ---------- */

  function champsDuree(sec) {
    let h = "", m = "";
    if (sec !== null && sec !== undefined) {
      const min = Math.round(sec / 60);
      h = Math.floor(min / 60);
      m = min % 60;
    }
    return '<div class="grille-2">' +
      '<label class="champ"><span>Durée : heures</span><input type="number" name="dureeH" min="0" max="24" step="1" inputmode="numeric" value="' + h + '"></label>' +
      '<label class="champ"><span>minutes</span><input type="number" name="dureeM" min="0" step="1" inputmode="numeric" value="' + m + '"></label>' +
      "</div>";
  }
  // Renvoie la durée en secondes, ou null si la saisie est invalide.
  // Si l'affichage n'a pas été modifié, on garde la valeur exacte à la seconde près.
  function lireDuree(form, secOrigine) {
    const h = u.lireNombre(form.dureeH.value) || 0;
    const m = u.lireNombre(form.dureeM.value) || 0;
    if (h < 0 || m < 0 || !Number.isInteger(h) || !Number.isInteger(m)) return null;
    const min = h * 60 + m;
    if (secOrigine !== undefined && secOrigine !== null && min === Math.round(secOrigine / 60)) return secOrigine;
    return min * 60;
  }
  function verifierDuree(sec) {
    if (sec === null) return "Durée invalide : utilise des nombres entiers.";
    if (sec <= 0) return "Indique une durée supérieure à zéro.";
    if (sec > 24 * 3600) return "Durée trop longue (24 h au maximum).";
    return null;
  }
  function montrerErreur(el, message) {
    const p = el.querySelector("[data-erreur]");
    p.textContent = message;
    p.hidden = !message;
  }

  /* ---------- Rendu : avant le lancement ---------- */

  /* ---------- Cadran : anneau de progression autour du chrono ----------
     En Pomodoro, l'anneau montre l'avancée dans la phase en cours (travail ou pause).
     En chrono, il montre l'objectif du jour (temps déjà fait aujourd'hui + séance en cours). */
  const CIRC = 2 * Math.PI * 45; // circonférence de l'anneau (rayon 45 dans un carré de 100)
  const decalage = pct => (CIRC * (1 - Math.max(0, Math.min(100, pct || 0)) / 100)).toFixed(2);

  function cadranHTML(contenu, pct, repos) {
    return '<div class="cadran"><svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="cadran-fond" cx="50" cy="50" r="45" stroke-width="5"/>' +
      '<circle class="cadran-val' + (repos ? " repos" : "") + '" data-t="anneau" cx="50" cy="50" r="45" stroke-width="5" stroke-dasharray="' + CIRC.toFixed(2) +
      '" stroke-dashoffset="' + decalage(pct) + '"' + (pct > 0.5 ? "" : ' style="opacity:0"') + "/>" +
      '</svg><div class="cadran-centre">' + contenu + "</div></div>";
  }

  function progressionAnneau(e, c) {
    const repos = e.etat === "en pause" || c.phase === "pause";
    if (e.mode === "pomodoro") {
      const total = (c.phase === "travail" ? e.travailMin : e.pauseMin) * 60000;
      return { pct: total > 0 ? (1 - c.resteDansPhase / total) * 100 : 0, repos: repos };
    }
    const obj = st.objectifDuJour(e.examen, c.compte / 1000);
    return { pct: obj ? obj.pct : ((c.compte / 1000) % 3600) / 36, repos: repos };
  }

  // « Objectif du jour : 1 h 20 / 4 h 50 » (vide si l'objectif ou la date d'examen manque).
  function texteObjectif(examen, enCoursSec) {
    const obj = st.objectifDuJour(examen, enCoursSec);
    if (!obj) return "";
    if (obj.cibleSec <= 0) return "Objectif d'heures atteint";
    return "Objectif du jour : <strong>" + u.duree(obj.faitSec) + "</strong> / " + u.duree(obj.cibleSec);
  }

  function rendreLancement(examen) {
    const d = derniers(examen);
    const reglages = S.d.parametres.pomodoro;
    const mode = d.mode === "pomodoro" ? "pomodoro" : "chrono";
    const tr = d.travailMin || reglages.travailMin;
    const pa = (d.pauseMin !== undefined && d.pauseMin !== null) ? d.pauseMin : reglages.pauseMin;
    const obj = st.objectifDuJour(examen, 0);

    return '<section class="carte carte-timer">' +
      '<div class="timer-contexte" data-resume>' + u.esc(resume(examen, d)) + "</div>" +
      cadranHTML('<div class="chrono attente" data-apercu>' + (mode === "pomodoro" ? u.chrono(tr * 60000) : "00:00") + "</div>" +
        '<div class="timer-sous" data-apercu-sous>' + (mode === "pomodoro" ? "Pomodoro " + tr + " / " + pa : "Chrono") + "</div>", obj ? obj.pct : 0, false) +
      (obj ? '<p class="timer-objectif">' + texteObjectif(examen, 0) + "</p>" : "") +
      '<div class="timer-boutons"><button class="btn btn-primaire btn-geant" data-action="demarrer">' + P.icone("play") + "Démarrer</button></div>" +
      "</section>" +

      '<section class="carte"><h2>Ce que je travaille</h2>' +
      '<form data-form="lancement" novalidate>' +
      '<div class="champ"><span class="legende">Examen</span><div class="segment">' +
      '<a href="#/sat/timer"' + (examen === "sat" ? ' class="actif"' : "") + ">SAT</a>" +
      '<a href="#/ielts/timer"' + (examen === "ielts" ? ' class="actif"' : "") + ">IELTS</a>" +
      "</div></div>" +
      ui.cascadeHTML(examen, d) +
      '<label class="champ"><span>Note (facultatif)</span><input name="note" maxlength="300" autocomplete="off" placeholder="Ex. Bluebook Test 7, module 2"></label>' +
      '<div class="champ"><span class="legende">Mode</span><div class="segment">' +
      '<label><input type="radio" name="mode" value="chrono"' + (mode === "chrono" ? " checked" : "") + "><span>Chrono</span></label>" +
      '<label><input type="radio" name="mode" value="pomodoro"' + (mode === "pomodoro" ? " checked" : "") + "><span>Pomodoro</span></label>" +
      "</div></div>" +
      '<div class="reglages-pomodoro" data-pomodoro' + (mode === "pomodoro" ? "" : " hidden") + ">" +
      '<div class="grille-2">' +
      '<label class="champ"><span>Travail (min)</span><input type="number" name="travailMin" min="1" max="240" step="1" inputmode="numeric" value="' + tr + '"></label>' +
      '<label class="champ"><span>Pause (min)</span><input type="number" name="pauseMin" min="0" max="120" step="1" inputmode="numeric" value="' + pa + '"></label>' +
      "</div>" +
      '<div class="puces"><button type="button" class="puce" data-preset="25-5">25 / 5</button><button type="button" class="puce" data-preset="50-10">50 / 10</button></div>' +
      '<p class="aide">Seul le temps de travail est compté, jamais les pauses.</p>' +
      "</div>" +
      "</form></section>" +
      '<div data-methode-zone>' + carteMethode(examen, d) + "</div>";
  }

  /* ---------- Ta méthode (SAT) : l'étape en cours pour la compétence choisie ---------- */

  function idCours(examen, v) {
    if (examen !== "sat" || !v || !v.section || !v.domaine || !v.competence) return null;
    const id = v.section + "." + v.domaine + "." + v.competence;
    return P.cours && P.cours.pages().comp[id] ? id : null;
  }
  function carteMethode(examen, v) {
    const id = idCours(examen, v);
    return id ? P.cours.carteHTML(id, { compacte: true }) : "";
  }
  let methodeOuverte = false; // panneau « Ta méthode » de la séance en cours

  function monterLancement(el, r) {
    const form = el.querySelector('[data-form="lancement"]');
    const cascade = ui.lierCascade(form);

    function apercu() {
      const pomodoro = form.mode.value === "pomodoro";
      const tr = u.lireNombre(form.travailMin.value) || 0;
      const pa = u.lireNombre(form.pauseMin.value) || 0;
      el.querySelector("[data-pomodoro]").hidden = !pomodoro;
      el.querySelector("[data-apercu]").textContent = pomodoro ? u.chrono(tr * 60000) : "00:00";
      el.querySelector("[data-apercu-sous]").textContent = pomodoro ? "Pomodoro " + tr + " / " + pa : "Chrono";
      el.querySelector("[data-resume]").textContent = resume(r.examen, cascade.valeurs());
      // La carte de la méthode suit la compétence choisie.
      const zone = el.querySelector("[data-methode-zone]");
      const id = idCours(r.examen, cascade.valeurs());
      if (zone.dataset.id !== (id || "")) { zone.dataset.id = id || ""; zone.innerHTML = carteMethode(r.examen, cascade.valeurs()); }
    }

    function lancer() {
      const mode = form.mode.value === "pomodoro" ? "pomodoro" : "chrono";
      let tr = null, pa = null;
      if (mode === "pomodoro") {
        tr = u.lireNombre(form.travailMin.value);
        pa = u.lireNombre(form.pauseMin.value);
        if (!(tr >= 1 && tr <= 240) || !(pa >= 0 && pa <= 120)) {
          ui.toast("Durées Pomodoro invalides : travail de 1 à 240 min, pause de 0 à 120 min.", 4000);
          return;
        }
        tr = Math.round(tr);
        pa = Math.round(pa);
      }
      const v = cascade.valeurs();
      T.debloquerSon();
      focus = true;
      T.demarrer({ examen: r.examen, section: v.section, domaine: v.domaine, competence: v.competence, note: form.note.value.trim(), mode: mode, travailMin: tr, pauseMin: pa });
      const choix = { section: v.section, domaine: v.domaine, competence: v.competence, mode: mode };
      if (mode === "pomodoro") { choix.travailMin = tr; choix.pauseMin = pa; }
      memoriser(r.examen, choix);
      P.app.rafraichir();
    }

    form.addEventListener("change", apercu);
    form.addEventListener("input", apercu);
    form.addEventListener("submit", ev => { ev.preventDefault(); lancer(); });
    el.querySelectorAll("[data-preset]").forEach(b => b.addEventListener("click", () => {
      const [a, c] = b.dataset.preset.split("-");
      form.travailMin.value = a;
      form.pauseMin.value = c;
      apercu();
    }));
    el.querySelector('[data-action="demarrer"]').addEventListener("click", lancer);
  }

  /* ---------- Rendu : séance en cours ou terminée ---------- */

  function rendreEnCours(e, r) {
    const c = T.calcul(e);
    const contexte = resume(e.examen, e);
    const autreEspace = e.examen !== r.examen
      ? '<p class="aide">Cette séance concerne l\'examen ' + P.PROGRAMME[e.examen].nom + ".</p>" : "";

    const prog = progressionAnneau(e, c);
    if (e.etat === "termine") {
      return '<section class="carte carte-timer">' +
        '<div class="timer-contexte">' + u.esc(contexte) + "</div>" + autreEspace +
        cadranHTML('<div class="timer-phase">Séance terminée</div>' +
          '<div class="chrono">' + u.chrono(c.compte) + "</div>" +
          '<div class="timer-sous">Pas encore enregistrée</div>', prog.pct, true) +
        '<div class="timer-boutons"><button class="btn btn-primaire btn-geant" data-action="recap">Ouvrir le récapitulatif</button></div>' +
        "</section>";
    }

    const enPause = e.etat === "en pause";
    const debut = u.jour(e.debut) === u.aujourdhui() ? "Démarrée à " + u.heureMin(e.debut) : "Démarrée le " + u.jourCourt(u.jour(e.debut)) + " à " + u.heureMin(e.debut);
    return '<section class="carte carte-timer">' +
      (focus ? '<div class="focus-barre"><button class="rond" data-action="focus-quitter" aria-label="Quitter le mode focus">' + P.icone("fermer") + '</button><span class="puce-info"><i></i>Mode focus</span><span style="width:44px"></span></div>' : "") +
      '<div class="timer-contexte">' + u.esc(contexte) + "</div>" + autreEspace +
      cadranHTML('<div class="timer-phase" data-t="phase"></div>' +
        '<div class="chrono" data-t="compte" role="timer">' + u.chrono(c.compte) + "</div>" +
        '<div class="timer-sous" data-t="sous"></div>', prog.pct, prog.repos) +
      '<p class="respire-texte" data-t="respire" aria-live="polite" hidden></p>' +
      '<p class="timer-objectif" data-t="objectif">' + texteObjectif(e.examen, c.compte / 1000) + "</p>" +
      '<div class="timer-boutons deux">' +
      (enPause
        ? '<button class="btn btn-primaire btn-geant" data-action="reprendre">' + P.icone("play") + "Reprendre</button>"
        : '<button class="btn btn-primaire btn-geant" data-action="pause">' + P.icone("pause") + "Pause</button>") +
      '<button class="btn btn-geant" data-action="terminer">' + P.icone("stop") + "Terminer</button>" +
      "</div>" +
      '<button class="btn btn-lien-fort mt-petit" data-action="noter-erreur">' + P.icone("plus") + "Noter une erreur</button>" +
      (focus ? "" : '<button class="btn btn-lien-fort focus-entree" data-action="focus-entrer">' + P.icone("timer") + "Mode focus</button>") +
      '<p class="timer-note">' + debut + (e.mode === "pomodoro" ? " · Pomodoro " + e.travailMin + " / " + e.pauseMin : " · Chrono") +
      (e.note ? " · " + u.esc(e.note) : "") + "</p>" +
      (idCours(e.examen, e) ? '<details class="seance-methode" data-seance-methode' + (methodeOuverte ? " open" : "") + '><summary><span class="puce-info"><i></i>Ta méthode · ' +
        P.cours.resume(idCours(e.examen, e)) + "</span></summary>" + carteMethode(e.examen, e) + "</details>" : "") +
      "</section>";
  }

  // Mise à jour de l'affichage en place, appelée par app.js deux fois par seconde.
  function majDirect(c) {
    const e = T.e;
    const compte = document.querySelector('[data-t="compte"]');
    if (!e || !compte) return;
    const phase = document.querySelector('[data-t="phase"]');
    const sous = document.querySelector('[data-t="sous"]');
    compte.textContent = u.chrono(c.compte);
    if (e.etat === "en pause") {
      phase.textContent = "En pause";
      phase.className = "timer-phase";
      sous.textContent = "Le temps ne compte pas";
    } else if (e.mode === "pomodoro") {
      const travail = c.phase === "travail";
      phase.textContent = (travail ? "Travail" : "Pause") + " · cycle " + c.cycle;
      phase.className = "timer-phase" + (travail ? " travail" : "");
      const prochain = travail ? (e.pauseMin > 0 ? "Pause dans " : "Fin du cycle dans ") : "Reprise dans ";
      sous.textContent = prochain + u.chrono(c.resteDansPhase);
    } else {
      phase.textContent = "Chrono";
      phase.className = "timer-phase travail";
      sous.textContent = "Temps compté";
    }
    // Anneau et objectif du jour
    const anneau = document.querySelector('[data-t="anneau"]');
    if (anneau) {
      const prog = progressionAnneau(e, c);
      anneau.setAttribute("stroke-dashoffset", decalage(prog.pct));
      anneau.style.opacity = prog.pct > 0.5 ? "" : "0";
      anneau.classList.toggle("repos", prog.repos);
    }
    const objectif = document.querySelector('[data-t="objectif"]');
    if (objectif) objectif.innerHTML = texteObjectif(e.examen, c.compte / 1000);
    respiration(e, c);
  }

  // Pause Pomodoro : un halo respire derrière le cadran (4 s inspire, 6 s expire).
  const CYCLE_RESPIRE = 10000, INSPIRE = 4000;
  function respiration(e, c) {
    const cadran = document.querySelector(".carte-timer .cadran");
    const texte = document.querySelector('[data-t="respire"]');
    if (!cadran || !texte) return;
    const oui = e.mode === "pomodoro" && e.etat !== "en pause" && c.phase === "pause" &&
      S.appareil().respiration !== false && !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (oui && !cadran.classList.contains("respire")) {
      // Le halo démarre en phase avec l'horloge, comme le texte.
      cadran.style.setProperty("--respire-decalage", -(Date.now() % CYCLE_RESPIRE) + "ms");
      cadran.classList.add("respire");
    } else if (!oui && cadran.classList.contains("respire")) {
      cadran.classList.remove("respire");
    }
    texte.hidden = !oui;
    if (oui) texte.textContent = Date.now() % CYCLE_RESPIRE < INSPIRE ? "Inspire" : "Expire";
  }

  /* ---------- Fenêtre récapitulative (après « Terminer ») ---------- */

  function ouvrirRecap() {
    const e = T.e;
    if (!e || e.etat !== "termine" || ui.modaleOuverte("recap")) return;
    const c = T.calcul(e);
    const secOrigine = Math.floor(c.compte / 1000); // comme l'affichage du chronomètre
    let cascade;

    const html = '<p class="aide">' + P.PROGRAMME[e.examen].nom + " · " + u.jourLong(u.jour(e.debut)) +
      ", de " + u.heureMin(e.debut) + " à " + u.heureMin(e.fin) +
      (e.mode === "pomodoro" ? " · Pomodoro " + e.travailMin + " / " + e.pauseMin : " · Chrono") + "</p>" +
      '<form novalidate>' + champsDuree(secOrigine) +
      ui.cascadeHTML(e.examen, e) +
      '<label class="champ"><span>Note</span><textarea name="note" rows="2" maxlength="500">' + u.esc(e.note) + "</textarea></label>" +
      '<p class="erreur-form" data-erreur hidden></p></form>';

    const m = ui.modale({
      id: "recap",
      titre: "Séance terminée",
      html: html,
      fermable: false,
      auMontage: el => {
        cascade = ui.lierCascade(el);
        el.querySelector("form").addEventListener("submit", ev => ev.preventDefault());
      },
      boutons: [
        { texte: "Abandonner", classe: "btn-danger", action: () => {
          ui.confirmer("Cette séance ne sera pas ajoutée à ton total.", { titre: "Abandonner la séance ?", ok: "Abandonner", danger: true })
            .then(ok => {
              if (!ok) return;
              T.effacer();
              m.fermer();
              ui.toast("Séance abandonnée");
              P.app.rafraichir();
            });
          return false;
        } },
        { texte: "Reprendre le timer", action: () => {
          if (!T.e) return;
          T.debloquerSon();
          T.reprendre();
          P.app.rafraichir();
        } },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          if (!T.e) return;
          const form = el.querySelector("form");
          const sec = lireDuree(form, secOrigine);
          const pb = verifierDuree(sec);
          if (pb) { montrerErreur(el, pb); return false; }
          const v = cascade.valeurs();
          const avant = P.finSeance.instantane(e.examen); // chiffres d'avant, pour l'écran de fin
          const seance = S.ajouter("seances", {
            examen: e.examen, section: v.section, domaine: v.domaine, competence: v.competence,
            note: form.note.value.trim(), jour: u.jour(e.debut),
            debut: u.iso(e.debut), fin: u.iso(e.fin), dureeSec: sec, origine: e.mode
          });
          T.effacer();
          if (sec >= P.finSeance.DUREE_MIN) P.finSeance.ouvrir(e.examen, avant, seance);
          else ui.toast("Séance enregistrée : " + u.duree(sec));
          P.app.rafraichir();
        } }
      ]
    });
  }

  /* ---------- Ajout manuel et modification d'une séance ---------- */

  function ouvrirFormSeance(examen, seance) {
    const v = seance || Object.assign({ jour: u.aujourdhui(), dureeSec: null, note: "" }, derniers(examen));
    let cascade;
    const html = '<form novalidate>' +
      '<label class="champ"><span>Date</span><input type="date" name="jour" value="' + u.esc(v.jour) + '" max="' + u.aujourdhui() + '"></label>' +
      champsDuree(v.dureeSec) +
      ui.cascadeHTML(examen, v) +
      '<label class="champ"><span>Note</span><textarea name="note" rows="2" maxlength="500">' + u.esc(v.note) + "</textarea></label>" +
      '<p class="erreur-form" data-erreur hidden></p></form>';

    ui.modale({
      titre: seance ? "Modifier la séance" : "Ajouter une séance à la main",
      html: html,
      auMontage: el => {
        cascade = ui.lierCascade(el);
        el.querySelector("form").addEventListener("submit", ev => ev.preventDefault());
      },
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const form = el.querySelector("form");
          const jour = form.jour.value;
          if (!u.estJour(jour)) { montrerErreur(el, "Indique une date."); return false; }
          if (jour > u.aujourdhui()) { montrerErreur(el, "La date ne peut pas être dans le futur."); return false; }
          const sec = lireDuree(form, seance ? seance.dureeSec : undefined);
          const pb = verifierDuree(sec);
          if (pb) { montrerErreur(el, pb); return false; }
          const c = cascade.valeurs();
          const champs = { section: c.section, domaine: c.domaine, competence: c.competence, note: form.note.value.trim(), jour: jour, dureeSec: sec };
          if (seance) {
            S.modifier("seances", seance.id, champs);
            ui.toast("Séance modifiée");
          } else {
            S.ajouter("seances", Object.assign({ examen: examen }, {
              section: champs.section, domaine: champs.domaine, competence: champs.competence,
              note: champs.note, jour: jour, debut: null, fin: null, dureeSec: sec, origine: "manuelle"
            }));
            ui.toast("Séance ajoutée : " + u.duree(sec));
          }
          P.app.rafraichir();
        } }
      ]
    });
  }

  function supprimerSeance(id) {
    const s = S.trouver("seances", id);
    if (!s) return;
    ui.confirmer("La séance de " + u.duree(s.dureeSec) + " du " + u.jourLong(s.jour) + " sera retirée de ton total.", { titre: "Supprimer la séance ?", ok: "Supprimer", danger: true })
      .then(ok => {
        if (!ok) return;
        S.supprimer("seances", id);
        ui.toast("Séance supprimée");
        P.app.rafraichir();
      });
  }

  /* ---------- Historique des séances ---------- */

  function rendreHistorique(examen) {
    const nom = P.PROGRAMME[examen].nom;
    const cle = s => s.debut || s.creeLe;
    const seances = S.liste("seances", examen).sort((a, b) =>
      a.jour !== b.jour ? (a.jour < b.jour ? 1 : -1) : (cle(a) < cle(b) ? 1 : cle(a) > cle(b) ? -1 : 0));

    let h = '<section class="carte"><h2>Séances ' + nom + "</h2>" +
      '<div class="rangee-boutons"><button class="btn" data-action="ajouter-seance">Ajouter une séance à la main</button></div>';
    if (!seances.length) return h + '<p class="vide">Aucune séance pour l\'instant.</p></section>';

    const parJour = st.secondesParJour(examen);
    let jourCourant = null;
    h += '<ul class="liste">';
    seances.slice(0, limite).forEach(s => {
      if (s.jour !== jourCourant) {
        jourCourant = s.jour;
        h += '<li class="jour-titre"><span>' + u.esc(u.jourLong(s.jour)) + "</span><span>" + u.duree(parJour.get(s.jour) || 0) + "</span></li>";
      }
      const chemin = P.prog.chemin(s);
      const heures = s.debut ? u.heureMin(Date.parse(s.debut)) + (s.fin ? " – " + u.heureMin(Date.parse(s.fin)) : "") : "";
      h += '<li class="item">' +
        '<div class="item-tete"><strong>' + u.duree(s.dureeSec) + "</strong>" +
        '<span class="badge">' + (ORIGINES[s.origine] || "") + "</span>" +
        (heures ? '<span class="item-meta">' + heures + "</span>" : "") + "</div>" +
        (chemin ? '<div class="item-chemin">' + u.esc(chemin) + "</div>" : "") +
        (s.note ? '<div class="item-note">' + u.esc(s.note) + "</div>" : "") +
        '<div class="item-actions">' +
        '<button class="btn btn-lien" data-action="modifier-seance" data-id="' + s.id + '">Modifier</button>' +
        '<button class="btn btn-lien danger" data-action="supprimer-seance" data-id="' + s.id + '">Supprimer</button>' +
        "</div></li>";
    });
    h += "</ul>";
    if (seances.length > limite) h += '<button class="btn btn-petit mt" data-action="plus">Afficher plus</button>';
    return h + "</section>";
  }

  /* ---------- Alerte « As-tu oublié d'arrêter le timer ? » ---------- */

  function alerte3h() {
    const e = T.e;
    if (!e || ui.modaleOuverte("alerte3h") || ui.modaleOuverte("recap")) return;
    const c = T.calcul(e);
    const maintenant = Date.now();
    ui.modale({
      id: "alerte3h",
      titre: "As-tu oublié d'arrêter le timer ?",
      fermable: false,
      html: "<p>Le timer tourne depuis plus de 3 heures (" + u.duree(c.actif / 1000) + " sans compter les pauses manuelles).</p>" +
        '<label class="champ"><span>Heure de fin réelle</span><input type="datetime-local" name="fin" value="' + u.versDateHeureLocale(maintenant) +
        '" min="' + u.versDateHeureLocale(e.debut) + '" max="' + u.versDateHeureLocale(maintenant) + '"></label>' +
        '<p class="aide">Si tu as arrêté de travailler plus tôt, indique l\'heure réelle et termine la séance. Sinon, continue.</p>' +
        '<p class="erreur-form" data-erreur hidden></p>',
      boutons: [
        { texte: "Non, je continue", action: () => {
          if (!T.e) return;
          T.e.alerte3hVue = true;
          T.sauver();
        } },
        { texte: "Terminer à cette heure", classe: "btn-primaire", action: (fermer, el) => {
          if (!T.e) return;
          const ms = u.depuisDateHeureLocale(el.querySelector('[name="fin"]').value);
          if (!ms || ms <= T.e.debut || ms > Date.now() + 60000) {
            montrerErreur(el, "Choisis une heure comprise entre le début de la séance et maintenant.");
            return false;
          }
          T.terminer(Math.min(ms, Date.now()));
          P.app.aller("#/" + T.e.examen + "/timer");
        } }
      ]
    });
  }

  /* ---------- La vue ---------- */

  P.vues.timer = {
    rendre: function (r) {
      return (T.e ? rendreEnCours(T.e, r) : rendreLancement(r.examen)) + rendreHistorique(r.examen);
    },

    monter: function (el, r) {
      if (!T.e) monterLancement(el, r);
      if (P.cours) P.cours.lier(el); // cases et boutons de « Ta méthode »
      el.addEventListener("toggle", ev => { if (ev.target.dataset && ev.target.dataset.seanceMethode !== undefined) methodeOuverte = ev.target.open; }, true);
      // Mode focus : seulement pendant une séance en cours ou en pause.
      document.body.classList.toggle("mode-focus", !!T.e && T.e.etat !== "termine" && focus);
      el.addEventListener("click", ev => {
        const b = ev.target.closest("[data-action]");
        if (!b) return;
        const a = b.dataset.action, id = b.dataset.id;
        if (a === "pause") { T.pause(); P.app.rafraichir(); }
        else if (a === "reprendre") { T.debloquerSon(); T.reprendre(); P.app.rafraichir(); }
        else if (a === "terminer") { T.terminer(); P.app.rafraichir(); }
        else if (a === "recap") ouvrirRecap();
        else if (a === "ajouter-seance") ouvrirFormSeance(r.examen, null);
        else if (a === "modifier-seance") ouvrirFormSeance(r.examen, S.trouver("seances", id));
        else if (a === "supprimer-seance") supprimerSeance(id);
        else if (a === "plus") { limite += 30; P.app.rafraichir(); }
        else if (a === "focus-quitter") { focus = false; P.app.rafraichir(); }
        else if (a === "focus-entrer") { focus = true; P.app.rafraichir(); window.scrollTo(0, 0); }
        else if (a === "noter-erreur" && T.e) {
          // Formulaire du journal, pré-rempli avec ce qui est travaillé ; le timer continue.
          P.vues.journal.ouvrirFormulaire(T.e.examen, null, { section: T.e.section, domaine: T.e.domaine, competence: T.e.competence });
        }
      });
      // Une séance terminée mais pas enregistrée : on rouvre le récapitulatif.
      if (T.e && T.e.etat === "termine") ouvrirRecap();
    },

    majDirect: majDirect,
    alerte3h: alerte3h
  };
})(window.Prepa = window.Prepa || {});
