/* ==========================================================================
   vues/speaking.js — l'onglet Speaking (IELTS).
   - Simulateur de Part 2 : choisir ou tirer au hasard une cue card, 1 minute de
     préparation (compte à rebours), puis 2 minutes de parole, avec un signal à la fin
     de chaque phase. Comme le timer, le temps est recalculé à partir de l'heure de
     départ : il reste juste même si l'écran se met en veille.
   - Liste de mes cue cards (sujet + 3 ou 4 points).
   - Historique des séances de pratique : date, cue card, notes.
   Pas d'enregistrement audio dans cette version.
   Enregistrement : cueCards [{ sujet, points }], pratiquesSpeaking [{ jour, cueCard, notes }]
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, T = P.timer, ui = P.ui;
  P.vues = P.vues || {};

  const PREPA_MS = 60000, PAROLE_MS = 120000;
  let choisie = null; // id de la cue card sélectionnée
  let sim = null;     // simulation en cours : { cueCard, debut, debutParole, fini, signaux: [] }

  const cartes = () => S.liste("cueCards").sort((a, b) => (a.creeLe < b.creeLe ? -1 : 1));
  function montrerErreur(el, message) {
    const p = el.querySelector("[data-erreur]");
    p.textContent = message;
    p.hidden = !message;
  }

  /* ---------- Simulateur ---------- */

  // État du simulateur à l'instant présent, calculé à partir des horodatages.
  function etat() {
    if (!sim) return null;
    const maintenant = Date.now();
    const debutParole = sim.debutParole || sim.debut + PREPA_MS;
    if (maintenant < debutParole) return { phase: "prep", reste: debutParole - maintenant };
    const fin = debutParole + PAROLE_MS;
    if (maintenant < fin && !sim.fini) return { phase: "parole", reste: fin - maintenant, ecoule: maintenant - debutParole };
    return { phase: "fini", reste: 0 };
  }

  function demarrer(id) {
    sim = { cueCard: id, debut: Date.now(), debutParole: null, fini: false, signaux: [] };
    sim.signaux.push(T.signalDans(PREPA_MS / 1000), T.signalDans((PREPA_MS + PAROLE_MS) / 1000));
  }
  function annulerSignaux() {
    if (sim) sim.signaux.forEach(s => T.annulerSignal(s));
  }
  function passerParole() {
    annulerSignaux();
    sim.debutParole = Date.now();
    sim.signaux = [T.signalDans(PAROLE_MS / 1000)];
  }
  function arreter() {
    annulerSignaux();
    sim.fini = true;
    if (!sim.debutParole) sim.debutParole = Date.now();
  }

  function carteCueHTML(c) {
    return '<div class="cue">' +
      '<div class="cue-sujet">' + u.esc(c.sujet) + "</div>" +
      (c.points && c.points.length ? '<p class="cue-consigne">You should say:</p><ul class="cue-points">' + c.points.map(p => "<li>" + u.esc(p) + "</li>").join("") + "</ul>" : "") +
      "</div>";
  }

  function rendreSimulateur() {
    const liste = cartes();
    if (!sim) {
      if (!liste.length) {
        return '<section class="carte"><h2>Simulateur de Part 2</h2><p class="vide">Ajoute d\'abord une cue card à ta liste.</p>' +
          '<button class="btn btn-primaire" data-action="nouvelle-carte">Nouvelle cue card</button></section>';
      }
      if (!choisie || !liste.some(c => c.id === choisie)) choisie = liste[0].id;
      const c = liste.find(x => x.id === choisie);
      return '<section class="carte"><h2>Simulateur de Part 2</h2>' +
        '<div class="grille-2 aligne-bas"><label class="champ"><span>Cue card</span><select data-choix-carte>' +
        liste.map(x => '<option value="' + x.id + '"' + (x.id === choisie ? " selected" : "") + ">" + u.esc(x.sujet) + "</option>").join("") +
        '</select></label><div class="champ"><button class="btn" data-action="hasard"' + (liste.length < 2 ? " disabled" : "") + ">Tirer au hasard</button></div></div>" +
        carteCueHTML(c) +
        '<button class="btn btn-primaire btn-geant mt" data-action="demarrer-sim">Démarrer : 1 min de préparation</button>' +
        '<p class="aide">Puis 2 minutes de parole. Un signal sonore marque la fin de chaque phase.</p></section>';
    }
    const c = S.trouver("cueCards", sim.cueCard) || { sujet: "Cue card supprimée", points: [] };
    const e = etat();
    if (e.phase === "fini") {
      const parole = Math.max(0, Math.min(PAROLE_MS, (sim.finA || Date.now()) - (sim.debutParole || sim.debut)));
      return '<section class="carte"><h2>Simulateur de Part 2</h2>' + carteCueHTML(c) +
        '<div class="sim-etat"><span class="timer-phase">Terminé</span><p class="timer-sous">Temps de parole : ' + u.chrono(parole) + " sur 02:00</p></div>" +
        '<form data-form="pratique" novalidate><label class="champ mt"><span>Notes : ce qui a bien ou mal marché</span>' +
        '<textarea name="notes" rows="4" placeholder="Ex. j\'ai tenu 1 min 40, trop d\'hésitations sur le 3e point"></textarea></label></form>' +
        '<div class="rangee-boutons"><button class="btn btn-primaire" data-action="enregistrer-pratique">Enregistrer la pratique</button>' +
        '<button class="btn" data-action="fermer-sim">Ne pas enregistrer</button></div></section>';
    }
    return '<section class="carte"><h2>Simulateur de Part 2</h2>' + carteCueHTML(c) +
      '<div class="sim-etat"><span class="timer-phase' + (e.phase === "parole" ? " travail" : "") + '" data-sim="phase">' + (e.phase === "prep" ? "Préparation" : "Parole") + "</span>" +
      '<div class="chrono" data-sim="reste" role="timer">' + u.chrono(Math.ceil(e.reste / 1000) * 1000) + "</div>" +
      '<div class="timer-sous" data-sim="sous">' + (e.phase === "prep" ? "Prends des notes, puis parle 2 minutes." : "Parle jusqu'au signal.") + "</div></div>" +
      '<div class="timer-boutons deux">' +
      (e.phase === "prep" ? '<button class="btn btn-primaire btn-geant" data-action="passer">Commencer à parler</button>' : '<button class="btn btn-primaire btn-geant" data-action="arreter">J\'ai fini</button>') +
      '<button class="btn btn-geant" data-action="annuler-sim">Annuler</button></div></section>';
  }

  // Appelée par app.js deux fois par seconde : met à jour le compte à rebours.
  let phaseAffichee = null;
  function tic() {
    if (!sim) return;
    const e = etat();
    const reste = document.querySelector('[data-sim="reste"]');
    if (e.phase === "fini" && !sim.fini) {
      sim.fini = true;
      sim.finA = (sim.debutParole || sim.debut + PREPA_MS) + PAROLE_MS;
    }
    if (!reste) return;
    if (e.phase !== phaseAffichee && phaseAffichee !== null) {
      // Changement de phase : on redessine (et on fait vibrer le téléphone si possible).
      phaseAffichee = e.phase;
      if (navigator.vibrate && document.visibilityState === "visible") { try { navigator.vibrate([200, 100, 200]); } catch (er) { /* rien */ } }
      P.app.rafraichir();
      return;
    }
    phaseAffichee = e.phase;
    reste.textContent = u.chrono(Math.ceil(e.reste / 1000) * 1000);
  }

  /* ---------- Cue cards ---------- */

  function ouvrirCarte(carte) {
    const v = carte || { sujet: "", points: [] };
    const pts = v.points.concat(["", "", "", ""]).slice(0, 4);
    ui.modale({
      titre: carte ? "Modifier la cue card" : "Nouvelle cue card",
      html: '<form novalidate>' +
        '<label class="champ"><span>Sujet <span class="requis">*</span></span><input name="sujet" maxlength="160" autocomplete="off" value="' + u.esc(v.sujet) + '" placeholder="Ex. Describe a book you enjoyed reading"></label>' +
        '<p class="legende" style="margin:0 0 .3rem">Points à aborder (3 ou 4)</p>' +
        pts.map((p, i) => '<label class="champ"><span class="sr">Point ' + (i + 1) + '</span><input name="p' + i + '" maxlength="160" autocomplete="off" value="' + u.esc(p) + '" placeholder="' +
          ["what it is", "when you read it", "why you chose it", "and explain why you enjoyed it"][i] + '"></label>').join("") +
        '<p class="erreur-form" data-erreur hidden></p></form>',
      auMontage: el => el.querySelector("form").addEventListener("submit", ev => ev.preventDefault()),
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const f = el.querySelector("form");
          const sujet = f.sujet.value.trim();
          const points = [0, 1, 2, 3].map(i => f["p" + i].value.trim()).filter(Boolean);
          if (!sujet) { montrerErreur(el, "Écris le sujet de la cue card."); return false; }
          if (carte) S.modifier("cueCards", carte.id, { sujet: sujet, points: points });
          else choisie = S.ajouter("cueCards", { sujet: sujet, points: points }).id;
          P.app.rafraichir();
        } }
      ]
    });
  }

  function ouvrirPratique(p) {
    const c = S.trouver("cueCards", p.cueCard);
    ui.modale({
      titre: "Pratique du " + u.jourCourt(p.jour),
      html: '<form novalidate><p class="aide">' + u.esc(c ? c.sujet : "Cue card supprimée") + "</p>" +
        '<label class="champ"><span>Date</span><input type="date" name="jour" value="' + p.jour + '" max="' + u.aujourdhui() + '"></label>' +
        '<label class="champ"><span>Notes</span><textarea name="notes" rows="4">' + u.esc(p.notes) + "</textarea></label></form>",
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const f = el.querySelector("form");
          S.modifier("pratiquesSpeaking", p.id, { jour: u.estJour(f.jour.value) ? f.jour.value : p.jour, notes: f.notes.value.trim() });
          P.app.rafraichir();
        } }
      ]
    });
  }

  /* ---------- Rendu ---------- */

  function rendre() {
    let h = rendreSimulateur();
    const liste = cartes();
    h += '<section class="carte"><div class="carte-tete"><h2>Mes cue cards</h2><span class="item-meta">' + liste.length + "</span></div>" +
      (liste.length ? '<ul class="liste">' + liste.map(c =>
        '<li class="item"><strong>' + u.esc(c.sujet) + "</strong>" +
        (c.points.length ? '<div class="item-note">' + c.points.map(u.esc).join(" · ") + "</div>" : "") +
        '<div class="item-actions"><button class="btn btn-lien" data-action="modifier-carte" data-id="' + c.id + '">Modifier</button>' +
        '<button class="btn btn-lien danger" data-action="supprimer-carte" data-id="' + c.id + '">Supprimer</button></div></li>').join("") + "</ul>" : "") +
      '<button class="btn mt" data-action="nouvelle-carte">Nouvelle cue card</button></section>';

    const pratiques = S.liste("pratiquesSpeaking").sort((a, b) => (a.jour !== b.jour ? (a.jour < b.jour ? 1 : -1) : (a.creeLe < b.creeLe ? 1 : -1)));
    h += '<section class="carte"><h2>Mes séances de pratique</h2>' +
      (pratiques.length ? '<ul class="liste">' + pratiques.map(p => {
        const c = S.trouver("cueCards", p.cueCard);
        return '<li class="item"><div class="item-tete"><span class="item-meta">' + u.jourLong(p.jour) + "</span></div>" +
          "<strong>" + u.esc(c ? c.sujet : "Cue card supprimée") + "</strong>" +
          (p.notes ? '<div class="item-note">' + u.esc(p.notes) + "</div>" : "") +
          '<div class="item-actions"><button class="btn btn-lien" data-action="modifier-pratique" data-id="' + p.id + '">Modifier</button>' +
          '<button class="btn btn-lien danger" data-action="supprimer-pratique" data-id="' + p.id + '">Supprimer</button></div></li>';
      }).join("") + "</ul>" : '<p class="vide">Aucune pratique enregistrée.</p>') + "</section>";
    return h;
  }

  function monter(el) {
    phaseAffichee = sim ? etat().phase : null;
    el.addEventListener("change", ev => {
      if (ev.target.matches("[data-choix-carte]")) { choisie = ev.target.value; P.app.rafraichir(); }
    });
    el.addEventListener("click", ev => {
      const b = ev.target.closest("[data-action]");
      if (!b) return;
      const a = b.dataset.action, id = b.dataset.id;
      if (a === "hasard") {
        const autres = cartes().filter(c => c.id !== choisie);
        if (autres.length) choisie = autres[Math.floor(Math.random() * autres.length)].id;
        P.app.rafraichir();
      } else if (a === "demarrer-sim") { demarrer(choisie); P.app.rafraichir(); }
      else if (a === "passer") { passerParole(); P.app.rafraichir(); }
      else if (a === "arreter") { arreter(); sim.finA = Date.now(); P.app.rafraichir(); }
      else if (a === "annuler-sim") { annulerSignaux(); sim = null; P.app.rafraichir(); }
      else if (a === "fermer-sim") { sim = null; P.app.rafraichir(); }
      else if (a === "enregistrer-pratique") {
        const notes = el.querySelector('[data-form="pratique"] [name="notes"]').value.trim();
        S.ajouter("pratiquesSpeaking", { jour: u.aujourdhui(), cueCard: sim.cueCard, notes: notes });
        sim = null;
        ui.toast("Pratique enregistrée");
        P.app.rafraichir();
      } else if (a === "nouvelle-carte") ouvrirCarte(null);
      else if (a === "modifier-carte") ouvrirCarte(S.trouver("cueCards", id));
      else if (a === "supprimer-carte") {
        const c = S.trouver("cueCards", id);
        ui.confirmer("« " + c.sujet + " » sera retirée de ta liste. Les pratiques déjà enregistrées restent.", { titre: "Supprimer la cue card ?", ok: "Supprimer", danger: true })
          .then(ok => { if (ok) { S.supprimer("cueCards", id); P.app.rafraichir(); } });
      } else if (a === "modifier-pratique") ouvrirPratique(S.trouver("pratiquesSpeaking", id));
      else if (a === "supprimer-pratique") {
        ui.confirmer("Cette séance de pratique sera supprimée.", { titre: "Supprimer la pratique ?", ok: "Supprimer", danger: true })
          .then(ok => { if (ok) { S.supprimer("pratiquesSpeaking", id); P.app.rafraichir(); } });
      }
    });
  }

  P.vues.speaking = { rendre: rendre, monter: monter, tic: tic, _etat: () => ({ sim: sim, etat: etat() }) };
})(window.Prepa = window.Prepa || {});
