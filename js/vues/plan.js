/* ==========================================================================
   vues/plan.js — l'onglet Plan : un cadre VIDE à remplir soi-même.
   Ligne du temps d'aujourd'hui à la date de l'examen, découpée en semaines
   (lundi → dimanche). Pour chaque semaine : objectifs (texte libre), compétences
   ciblées, heures prévues (saisies) et heures réelles (calculées par le timer),
   avec un code couleur : atteint (≥ 100 %), presque (≥ 75 %), pas atteint.
   Les semaines peuvent être regroupées en phases nommées.

   Enregistrement :
     planSemaines : { id: "sat:2026-11-09", examen, lundi, objectifs, competencesCiblees, heuresPrevues }
     planPhases   : { examen, nom, du (lundi), au (dimanche) }
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats, ui = P.ui;
  P.vues = P.vues || {};

  const idSemaine = (ex, lundi) => ex + ":" + lundi;
  function semaine(ex, lundi) {
    const w = S.trouver("planSemaines", idSemaine(ex, lundi));
    const ok = w && !w.supprimeLe;
    return {
      objectifs: ok ? (w.objectifs || "") : "",
      competencesCiblees: ok && Array.isArray(w.competencesCiblees) ? w.competencesCiblees : [],
      heuresPrevues: ok && w.heuresPrevues !== null && w.heuresPrevues !== undefined ? Number(w.heuresPrevues) : null
    };
  }
  function enregistrer(ex, lundi, champs) {
    S.definir("planSemaines", idSemaine(ex, lundi), Object.assign({ examen: ex, lundi: lundi }, champs));
  }
  const phases = ex => S.liste("planPhases", ex).sort((a, b) => (a.du < b.du ? -1 : 1));
  const phaseDe = (ex, lundi) => phases(ex).find(p => lundi >= p.du && lundi <= p.au) || null;

  // Liste des lundis affichés : de la plus ancienne semaine déjà planifiée (ou de cette
  // semaine) jusqu'à la semaine de l'examen. Une semaine planifiée reste donc visible
  // une fois passée, avec sa couleur.
  function lundis(ex) {
    const dateExamen = S.d.parametres[ex].dateExamen;
    let debut = u.lundi(u.aujourdhui());
    S.liste("planSemaines", ex).forEach(w => { if (w.lundi < debut) debut = w.lundi; });
    phases(ex).forEach(p => { if (p.du < debut) debut = u.lundi(p.du); });
    const fin = u.lundi(dateExamen);
    const liste = [];
    for (let l = debut; l <= fin && liste.length < 120; l = u.ajouterJours(l, 7)) liste.push(l);
    return liste;
  }

  // Statut d'une semaine : à venir, en cours, atteint, presque ou pas atteint.
  function statut(lundi, prevues, reellesH) {
    const auj = u.aujourdhui();
    const pct = prevues ? reellesH / prevues : null;
    if (lundi > auj) return { cle: "avenir", lib: "À venir", classe: "", pct: pct };
    if (!prevues) return { cle: "libre", lib: "Heures prévues à saisir", classe: "", pct: null };
    const pctTxt = Math.round(pct * 100) + " %";
    if (u.ajouterJours(lundi, 6) >= auj) return { cle: "encours", lib: "En cours · " + pctTxt, classe: "badge-accent", pct: pct };
    if (pct >= 1) return { cle: "atteint", lib: "Atteint · " + pctTxt, classe: "badge-succes", pct: pct };
    if (pct >= 0.75) return { cle: "presque", lib: "Presque · " + pctTxt, classe: "badge-alerte", pct: pct };
    return { cle: "rate", lib: "Pas atteint · " + pctTxt, classe: "badge-danger", pct: pct };
  }

  const titreSemaine = lundi => "Semaine du " + u.jourCourt(lundi) + " au " + u.jourCourt(u.ajouterJours(lundi, 6));
  const reelles = (ex, lundi) => st.periodeSec(ex, lundi, u.ajouterJours(lundi, 6)) / 3600;

  function libelleCible(id) {
    const [ex, section, domaine, competence] = id.split(".");
    return P.prog.chemin({ examen: ex, section: section, domaine: domaine, competence: competence }) || id;
  }

  function carteSemaine(ex, lundi) {
    const w = semaine(ex, lundi);
    const r = reelles(ex, lundi);
    const s = statut(lundi, w.heuresPrevues, r);
    const largeur = s.pct === null ? 0 : Math.min(100, s.pct * 100);
    const cibles = w.competencesCiblees.map((id, i) =>
      '<span class="puce">' + u.esc(libelleCible(id)) +
      '<button type="button" data-action="retirer-cible" data-lundi="' + lundi + '" data-i="' + i + '" aria-label="Retirer">×</button></span>').join("");
    return '<section class="carte semaine semaine-' + s.cle + '" data-semaine="' + lundi + '">' +
      '<div class="carte-tete"><h3>' + titreSemaine(lundi) + '</h3><span class="badge ' + s.classe + '" data-statut>' + s.lib + "</span></div>" +
      '<div class="semaine-heures">' +
      '<label class="champ"><span>Heures prévues</span><input type="number" min="0" max="168" step="0.5" inputmode="decimal" data-prevues="' + lundi + '" value="' + (w.heuresPrevues === null ? "" : w.heuresPrevues) + '"></label>' +
      '<div class="champ"><span class="legende">Heures réelles</span><b class="semaine-reelles">' + u.nombre(Math.floor(r * 10) / 10) + " h</b></div>" +
      "</div>" +
      '<div class="jauge jauge-' + s.cle + '" data-jauge><i style="width:' + largeur.toFixed(1) + '%"></i></div>' +
      '<label class="champ mt"><span>Objectifs de la semaine</span><textarea rows="2" data-objectifs="' + lundi + '" placeholder="Ce que je veux faire cette semaine">' + u.esc(w.objectifs) + "</textarea></label>" +
      '<div class="champ"><span class="legende">Compétences ciblées</span><div class="puces">' + cibles +
      '<button type="button" class="puce puce-ajout" data-action="cibler" data-lundi="' + lundi + '">+ Ajouter</button></div></div>' +
      "</section>";
  }

  function resumeHTML(ex, liste) {
    const auj = u.aujourdhui();
    let prevuesFutures = 0, prevuesTotal = 0, reellesTotal = 0;
    liste.forEach(l => {
      const w = semaine(ex, l);
      prevuesTotal += w.heuresPrevues || 0;
      reellesTotal += reelles(ex, l);
      if (u.ajouterJours(l, 6) >= auj) prevuesFutures += Math.max(0, (w.heuresPrevues || 0) - (l <= auj ? reelles(ex, l) : 0));
    });
    const objectif = st.objectifH(ex);
    const reste = objectif ? Math.max(0, objectif - st.totalSec(ex) / 3600) : null;
    let bilan = "";
    if (reste !== null) {
      bilan = prevuesFutures + 0.05 >= reste
        ? '<p class="verdict ok">Les heures prévues d\'ici l\'examen suffisent pour atteindre l\'objectif de ' + u.nombre(objectif) + " h.</p>"
        : '<p class="verdict ko">Il reste ' + u.nombre(Math.ceil(reste * 10) / 10) + " h à faire pour l'objectif, et " + u.nombre(Math.round(prevuesFutures * 10) / 10) +
          " h sont prévues d'ici l'examen. Il en manque " + u.nombre(Math.ceil((reste - prevuesFutures) * 10) / 10) + " h.</p>";
    }
    return '<section class="carte" data-resume-plan><h2>Vue d\'ensemble</h2><div class="duo">' +
      '<div><span class="mini-lib">Heures prévues</span><div class="gros-chiffre">' + u.nombre(Math.round(prevuesTotal * 10) / 10) + " h</div></div>" +
      '<div><span class="mini-lib">Heures réelles</span><div class="gros-chiffre">' + u.nombre(Math.floor(reellesTotal * 10) / 10) + " h</div></div>" +
      "</div>" + bilan +
      '<p class="aide mt">Code couleur d\'une semaine passée : atteint à partir de 100 % des heures prévues, presque à partir de 75 %, sinon pas atteint.</p></section>';
  }

  function rendre(r) {
    const ex = r.examen;
    const dateExamen = S.d.parametres[ex].dateExamen;
    if (!u.estJour(dateExamen)) {
      return '<section class="carte"><p class="vide">Ajoute la date de l\'examen dans les <a href="#/parametres">Paramètres</a> pour afficher le plan semaine par semaine.</p></section>';
    }
    const liste = lundis(ex);
    if (!liste.length) return '<section class="carte"><p class="vide">La date de l\'examen est passée.</p></section>';

    let h = resumeHTML(ex, liste);
    h += '<section class="carte"><div class="carte-tete"><h2>Phases</h2></div>' +
      '<p class="aide">Regroupe des semaines consécutives sous un nom (ex. « Bases Math », « Tests blancs »).</p>' +
      (phases(ex).length ? '<ul class="liste">' + phases(ex).map(p =>
        '<li class="item"><div class="item-tete"><strong>' + u.esc(p.nom) + '</strong><span class="item-meta">' + u.jourCourt(p.du) + " – " + u.jourCourt(p.au) + "</span></div>" +
        '<div class="item-actions"><button class="btn btn-lien" data-action="modifier-phase" data-id="' + p.id + '">Modifier</button>' +
        '<button class="btn btn-lien danger" data-action="supprimer-phase" data-id="' + p.id + '">Supprimer</button></div></li>').join("") + "</ul>" : "") +
      '<button class="btn btn-petit mt" data-action="ajouter-phase">Ajouter une phase</button></section>';

    let phaseCourante = null;
    liste.forEach(l => {
      const ph = phaseDe(ex, l);
      if (ph && ph !== phaseCourante) {
        const semainesPhase = liste.filter(x => x >= ph.du && x <= ph.au);
        const prev = semainesPhase.reduce((a, x) => a + (semaine(ex, x).heuresPrevues || 0), 0);
        const reel = semainesPhase.reduce((a, x) => a + reelles(ex, x), 0);
        h += '<div class="phase-titre"><span>Phase</span><h2>' + u.esc(ph.nom) + "</h2>" +
          '<p class="item-meta">' + u.jourCourt(ph.du) + " – " + u.jourCourt(ph.au) + " · prévues " + u.nombre(Math.round(prev * 10) / 10) + " h · réelles " + u.nombre(Math.floor(reel * 10) / 10) + " h</p></div>";
      } else if (!ph && phaseCourante) {
        h += '<div class="phase-titre phase-sans"><h2>Hors phase</h2></div>';
      }
      phaseCourante = ph;
      h += carteSemaine(ex, l);
    });
    h += '<p class="aide">Dernière semaine : celle de l\'examen, le ' + u.jourLong(dateExamen) + ".</p>";
    return h;
  }

  /* ---------- Fenêtres : phase et compétence ciblée ---------- */

  function ouvrirPhase(ex, phase) {
    const liste = lundis(ex);
    const opts = (choisi, fin) => liste.map(l => {
      const v = fin ? u.ajouterJours(l, 6) : l;
      return '<option value="' + v + '"' + (v === choisi ? " selected" : "") + ">" + titreSemaine(l) + "</option>";
    }).join("");
    const html = '<form novalidate>' +
      '<label class="champ"><span>Nom de la phase</span><input name="nom" maxlength="60" autocomplete="off" value="' + u.esc(phase ? phase.nom : "") + '" placeholder="Ex. Bases Math"></label>' +
      '<label class="champ"><span>Première semaine</span><select name="du">' + opts(phase ? phase.du : liste[0], false) + "</select></label>" +
      '<label class="champ"><span>Dernière semaine</span><select name="au">' + opts(phase ? phase.au : u.ajouterJours(liste[0], 6), true) + "</select></label>" +
      '<p class="erreur-form" data-erreur hidden></p></form>';
    ui.modale({
      titre: phase ? "Modifier la phase" : "Nouvelle phase",
      html: html,
      auMontage: el => el.querySelector("form").addEventListener("submit", ev => ev.preventDefault()),
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const f = el.querySelector("form");
          const err = el.querySelector("[data-erreur]");
          const nom = f.nom.value.trim(), du = f.du.value, au = f.au.value;
          const montrer = m => { err.textContent = m; err.hidden = false; return false; };
          if (!nom) return montrer("Donne un nom à la phase.");
          if (au < du) return montrer("La dernière semaine doit être après la première.");
          const chevauche = phases(ex).find(p => (!phase || p.id !== phase.id) && du <= p.au && au >= p.du);
          if (chevauche) return montrer("Ces semaines font déjà partie de la phase « " + chevauche.nom + " ».");
          if (phase) S.modifier("planPhases", phase.id, { nom: nom, du: du, au: au });
          else S.ajouter("planPhases", { examen: ex, nom: nom, du: du, au: au });
          P.app.rafraichir();
        } }
      ]
    });
  }

  function ouvrirCible(ex, lundi) {
    let cascade;
    ui.modale({
      titre: "Compétence ciblée",
      html: '<p class="aide mb">' + titreSemaine(lundi) + ". Choisis au moins une section ; domaine et compétence sont facultatifs.</p>" +
        ui.cascadeHTML(ex, {}, { vide: "Toute la section / tout le domaine" }) + '<p class="erreur-form" data-erreur hidden></p>',
      auMontage: el => { cascade = ui.lierCascade(el); },
      boutons: [
        { texte: "Annuler" },
        { texte: "Ajouter", classe: "btn-primaire", action: (fermer, el) => {
          const v = cascade.valeurs();
          if (!v.section) { const e = el.querySelector("[data-erreur]"); e.textContent = "Choisis au moins une section."; e.hidden = false; return false; }
          const id = [ex, v.section, v.domaine, v.competence].filter(Boolean).join(".");
          const w = semaine(ex, lundi);
          if (w.competencesCiblees.indexOf(id) === -1) enregistrer(ex, lundi, { competencesCiblees: w.competencesCiblees.concat([id]) });
          P.app.rafraichir();
        } }
      ]
    });
  }

  /* ---------- Événements ---------- */

  // Met à jour le statut et la jauge d'une semaine sans redessiner la page
  // (pour ne pas perdre le champ en cours de saisie).
  function majCarte(el, ex, lundi) {
    const carte = el.querySelector('[data-semaine="' + lundi + '"]');
    const w = semaine(ex, lundi);
    const s = statut(lundi, w.heuresPrevues, reelles(ex, lundi));
    const badge = carte.querySelector("[data-statut]");
    badge.className = "badge " + s.classe;
    badge.textContent = s.lib;
    carte.className = "carte semaine semaine-" + s.cle;
    const jauge = carte.querySelector("[data-jauge]");
    jauge.className = "jauge jauge-" + s.cle;
    jauge.firstChild.style.width = (s.pct === null ? 0 : Math.min(100, s.pct * 100)).toFixed(1) + "%";
    // La vue d'ensemble ne contient aucun champ : on peut la redessiner entièrement.
    const resume = el.querySelector("[data-resume-plan]");
    if (resume) resume.outerHTML = resumeHTML(ex, lundis(ex));
  }

  function monter(el, r) {
    const ex = r.examen;
    el.addEventListener("change", ev => {
      const t = ev.target;
      if (t.dataset.prevues) {
        const n = u.lireNombre(t.value);
        if (n !== null && (n < 0 || n > 168)) { t.classList.add("champ-invalide"); ui.toast("Entre 0 et 168 heures."); return; }
        t.classList.remove("champ-invalide");
        enregistrer(ex, t.dataset.prevues, { heuresPrevues: n });
        majCarte(el, ex, t.dataset.prevues);
        ui.toast("Enregistré", 1000);
      } else if (t.dataset.objectifs) {
        enregistrer(ex, t.dataset.objectifs, { objectifs: t.value.trim() });
        ui.toast("Enregistré", 1000);
      }
    });
    el.addEventListener("click", ev => {
      const b = ev.target.closest("[data-action]");
      if (!b) return;
      const a = b.dataset.action;
      if (a === "cibler") ouvrirCible(ex, b.dataset.lundi);
      else if (a === "retirer-cible") {
        const w = semaine(ex, b.dataset.lundi);
        const cibles = w.competencesCiblees.slice();
        cibles.splice(Number(b.dataset.i), 1);
        enregistrer(ex, b.dataset.lundi, { competencesCiblees: cibles });
        P.app.rafraichir();
      } else if (a === "ajouter-phase") ouvrirPhase(ex, null);
      else if (a === "modifier-phase") ouvrirPhase(ex, S.trouver("planPhases", b.dataset.id));
      else if (a === "supprimer-phase") {
        const p = S.trouver("planPhases", b.dataset.id);
        ui.confirmer("La phase « " + p.nom + " » sera supprimée. Les semaines et leur contenu restent.", { titre: "Supprimer la phase ?", ok: "Supprimer", danger: true })
          .then(ok => { if (ok) { S.supprimer("planPhases", p.id); P.app.rafraichir(); } });
      }
    });
  }

  P.vues.plan = { rendre: rendre, monter: monter };
})(window.Prepa = window.Prepa || {});
