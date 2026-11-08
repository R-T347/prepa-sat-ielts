/* ==========================================================================
   vues/journal.js — le journal d'erreurs.
   Une fiche par question ratée. Elle revient à J+3 dans « À refaire aujourd'hui ».
   Juste une 1re fois → J+7 ; juste une 2e fois de suite → archivée ;
   faux → J+3 et la règle s'affiche en grand (calcul dans stats.js).
   Adresses : #/sat/journal (liste) et #/sat/journal/reprises (reprises du jour).
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats, ui = P.ui;
  P.vues = P.vues || {};

  const TYPES = { 1: "Notion pas sue", 2: "Mal lu", 3: "Manque de temps" };
  const STATUTS = {
    "a-refaire": { lib: "À refaire", classe: "badge-alerte" },
    "en-attente": { lib: "En attente", classe: "" },
    "archivee": { lib: "Archivée", classe: "badge-succes" }
  };

  const filtres = { sat: {}, ielts: {} };      // filtres choisis, par examen
  const repartitionOuverte = { sat: false, ielts: false };
  const filtresOuverts = { sat: false, ielts: false };
  let limite = 50;                             // nombre de fiches affichées
  let regleAAfficher = null;                   // erreur ratée en reprise : on affiche sa règle en grand

  function opts(liste, choisi, vide) {
    return '<option value="">' + u.esc(vide) + "</option>" +
      liste.map(([v, lib]) => '<option value="' + u.esc(v) + '"' + (String(v) === String(choisi) ? " selected" : "") + ">" + u.esc(lib) + "</option>").join("");
  }
  function montrerErreur(el, message) {
    const p = el.querySelector("[data-erreur]");
    p.textContent = message;
    p.hidden = !message;
  }

  /* ---------- Liste ---------- */

  function repartitionHTML(ex, toutes) {
    const total = toutes.length;
    const parType = [1, 2, 3].map(t => [TYPES[t], toutes.filter(e => e.typeErreur === t).length]);
    const parDomaine = new Map();
    toutes.forEach(e => {
      let cle = "Non précisé";
      if (e.domaine) cle = P.prog.chemin({ examen: ex, section: e.section, domaine: e.domaine });
      else if (e.section) cle = P.prog.chemin({ examen: ex, section: e.section }) + " › domaine non précisé";
      parDomaine.set(cle, (parDomaine.get(cle) || 0) + 1);
    });
    const domaines = Array.from(parDomaine).sort((a, b) => b[1] - a[1]);
    const lignes = arr => {
      const max = Math.max(1, ...arr.map(x => x[1]));
      return arr.map(([lib, n]) => '<div class="rep-ligne"><span>' + u.esc(lib) + "</span><b>" + n + " · " + Math.round((n / total) * 100) + " %</b>" +
        '<div class="barre"><i style="width:' + ((n / max) * 100).toFixed(1) + '%"></i></div></div>').join("");
    };
    return '<details class="carte" data-repartition' + (repartitionOuverte[ex] ? " open" : "") + "><summary>Où je perds mes points</summary>" +
      '<h3 class="sous-titre">Par type d\'erreur</h3><div class="repartition">' + lignes(parType) + "</div>" +
      '<h3 class="sous-titre">Par domaine</h3><div class="repartition">' + lignes(domaines) + "</div>" +
      '<p class="aide mt">Sur ' + total + " " + u.accord(total, "erreur saisie", "erreurs saisies") + " (actives et archivées).</p></details>";
  }

  function carteErreur(e, auj) {
    const statut = st.statutErreur(e, auj);
    const s = STATUTS[statut];
    const chemin = P.prog.chemin(e);
    let reprise;
    if (statut === "archivee") reprise = "Archivée après 2 reprises justes";
    else if (statut === "a-refaire") reprise = e.aRefaireLe < auj ? "À refaire depuis le " + u.jourCourt(e.aRefaireLe) : "À refaire aujourd'hui";
    else reprise = "Reprise le " + u.jourCourt(e.aRefaireLe);
    const meta = [u.jourCourt(e.jour), e.source, e.refQuestion].filter(Boolean).map(u.esc).join(" · ");
    const details = [
      reprise,
      !e.archivee && e.justesDeSuite === 1 ? "1 reprise juste" : "",
      e.tempsSec ? e.tempsSec + " s" : "",
      e.finiATemps === true ? "fini à temps" : e.finiATemps === false ? "pas fini à temps" : ""
    ].filter(Boolean).join(" · ");

    return '<li class="carte erreur-carte">' +
      '<div class="item-tete"><span class="badge ' + s.classe + '">' + s.lib + '</span><span class="badge">' + (TYPES[e.typeErreur] || "Type ?") + "</span>" +
      '<span class="item-meta">' + meta + "</span></div>" +
      (chemin ? '<div class="item-chemin">' + u.esc(chemin) + "</div>" : "") +
      ((e.maReponse || e.bonneReponse) ? '<div class="erreur-rep">Ma réponse <strong>' + u.esc(e.maReponse || "-") + "</strong> → bonne réponse <strong>" + u.esc(e.bonneReponse || "-") + "</strong></div>" : "") +
      (e.regle ? '<div class="erreur-regle">' + u.esc(e.regle) + "</div>" : '<div class="erreur-regle regle-manquante">Règle à compléter</div>') +
      '<div class="item-meta mt-petit">' + u.esc(details) + "</div>" +
      '<div class="item-actions">' +
      '<button class="btn btn-lien" data-action="modifier" data-id="' + e.id + '">Modifier</button>' +
      '<button class="btn btn-lien danger" data-action="supprimer" data-id="' + e.id + '">Supprimer</button>' +
      "</div></li>";
  }

  function rendreListe(ex) {
    regleAAfficher = null;
    const auj = u.aujourdhui();
    const toutes = S.liste("erreurs", ex);
    const nARefaire = toutes.filter(e => st.statutErreur(e, auj) === "a-refaire").length;
    const nActives = toutes.filter(e => !e.archivee).length;
    const nArchivees = toutes.length - nActives;

    let h = '<div class="tuiles">' +
      '<a class="tuile' + (nARefaire ? " accent" : "") + '" href="#/' + ex + '/journal/reprises"><span class="gros-chiffre">' + nARefaire + "</span><span>à refaire aujourd'hui</span></a>" +
      '<div class="tuile"><span class="gros-chiffre">' + nActives + "</span><span>" + u.accord(nActives, "active") + "</span></div>" +
      '<div class="tuile"><span class="gros-chiffre">' + nArchivees + "</span><span>" + u.accord(nArchivees, "archivée") + "</span></div>" +
      "</div>" +
      // Quand des erreurs sont à refaire, c'est l'action principale du jour.
      '<div class="rangee-boutons">' +
      (nARefaire
        ? '<a class="btn btn-primaire" href="#/' + ex + '/journal/reprises">' + P.icone("play") + "Faire les reprises (" + nARefaire + ")</a>" +
          '<button class="btn" data-action="ajouter">' + P.icone("plus") + "Ajouter une erreur</button>"
        : '<button class="btn btn-primaire" data-action="ajouter">' + P.icone("plus") + "Ajouter une erreur</button>") +
      '<button class="btn" data-action="importer-csv">Importer un CSV</button></div>';

    if (toutes.length) h += repartitionHTML(ex, toutes);

    // Filtres, repliés derrière « Filtrer » pour que la liste apparaisse tout de suite
    const f = filtres[ex];
    const sections = P.prog.sections(ex).map(s => [s.id, s.nom]);
    const domaines = f.section ? P.prog.domaines(ex, f.section).map(d => [d.id, d.nom]) : [];
    const nbFiltres = [f.section, f.type, f.statut].filter(Boolean).length;
    h += '<details class="carte filtres-repli"' + (filtresOuverts[ex] || nbFiltres ? " open" : "") + ' data-filtres-repli><summary class="btn btn-petit">Filtrer' +
      (nbFiltres ? " (" + nbFiltres + ")" : "") + '</summary><div class="filtres">' +
      '<label class="champ"><span>Section</span><select data-f="section">' + opts(sections, f.section, "Toutes") + "</select></label>" +
      '<label class="champ"><span>Domaine</span><select data-f="domaine"' + (f.section ? "" : " disabled") + ">" + opts(domaines, f.domaine, "Tous") + "</select></label>" +
      '<label class="champ"><span>Type d\'erreur</span><select data-f="type">' + opts([[1, TYPES[1]], [2, TYPES[2]], [3, TYPES[3]]], f.type, "Tous") + "</select></label>" +
      '<label class="champ"><span>Statut</span><select data-f="statut">' + opts([["a-refaire", "À refaire"], ["en-attente", "En attente"], ["archivee", "Archivées"]], f.statut, "Tous") + "</select></label>" +
      "</div></details>";

    const filtrees = toutes.filter(e =>
      (!f.section || e.section === f.section) &&
      (!f.domaine || e.domaine === f.domaine) &&
      (!f.type || String(e.typeErreur) === String(f.type)) &&
      (!f.statut || st.statutErreur(e, auj) === f.statut)
    ).sort((a, b) => a.jour !== b.jour ? (a.jour < b.jour ? 1 : -1) : (a.creeLe < b.creeLe ? 1 : -1));

    const filtreActif = f.section || f.type || f.statut;
    if (!filtrees.length) {
      h += '<p class="vide">' + (toutes.length ? "Aucune erreur ne correspond à ces filtres."
        : "Ton journal est vide. Chaque question ratée doit y entrer, le jour même.") + "</p>";
    } else {
      h += '<p class="aide mb">' + filtrees.length + " " + u.accord(filtrees.length, "erreur") + (filtreActif ? " pour ces filtres" : "") + "</p>";
      h += '<ul class="liste">' + filtrees.slice(0, limite).map(e => carteErreur(e, auj)).join("") + "</ul>";
      if (filtrees.length > limite) h += '<button class="btn btn-petit" data-action="plus">Afficher plus</button>';
    }
    return h;
  }

  /* ---------- Formulaire d'ajout / de modification ---------- */

  // prefill (facultatif) : valeurs de départ pour une nouvelle erreur (ex. depuis le timer).
  function ouvrirForm(ex, err, prefill) {
    const nouveau = !err;
    const memo = (S.appareil().dernierJournal || {})[ex] || {};
    const v = err || Object.assign({ jour: u.aujourdhui(), source: memo.source || "", section: memo.section, domaine: memo.domaine, competence: memo.competence }, prefill || {});
    const sources = S.d.parametres.sourcesErreurs.slice();
    if (v.source && sources.indexOf(v.source) === -1) sources.push(v.source);
    let cascade;

    const html = '<form novalidate>' +
      '<div class="grille-2">' +
      '<label class="champ"><span>Date</span><input type="date" name="jour" value="' + u.esc(v.jour) + '" max="' + u.aujourdhui() + '"></label>' +
      '<label class="champ"><span>Source</span><select name="source">' + opts(sources.map(s => [s, s]), v.source, "-") + "</select></label>" +
      "</div>" +
      ui.cascadeHTML(ex, v) +
      '<label class="champ"><span>Référence de la question</span><input name="refQuestion" value="' + u.esc(v.refQuestion) + '" placeholder="Ex. Test 7 M1 Q14" autocomplete="off"></label>' +
      '<div class="grille-2">' +
      '<label class="champ"><span>Ma réponse</span><input name="maReponse" value="' + u.esc(v.maReponse) + '" autocomplete="off"></label>' +
      '<label class="champ"><span>Bonne réponse</span><input name="bonneReponse" value="' + u.esc(v.bonneReponse) + '" autocomplete="off"></label>' +
      "</div>" +
      '<p class="legende" style="margin:0 0 .3rem">Type d\'erreur <span class="requis">*</span></p>' +
      '<div class="choix-cartes">' + [1, 2, 3].map(t =>
        '<label><input type="radio" name="typeErreur" value="' + t + '"' + (v.typeErreur === t ? " checked" : "") + "><span><b>" + t + "</b>" + TYPES[t] + "</span></label>").join("") + "</div>" +
      '<label class="champ"><span>La règle, dans mes mots <span class="requis">*</span></span>' +
      '<textarea name="regle" rows="3" placeholder="Ce que je dois retenir pour ne plus faire cette erreur">' + u.esc(v.regle) + "</textarea></label>" +
      '<div class="grille-2">' +
      '<label class="champ"><span>Temps passé (secondes)</span><input type="number" name="tempsSec" min="0" step="1" inputmode="numeric" value="' + (v.tempsSec === null || v.tempsSec === undefined ? "" : v.tempsSec) + '"></label>' +
      '<label class="champ"><span>Fini à temps ?</span><select name="finiATemps">' +
      opts([["oui", "Oui"], ["non", "Non"]], v.finiATemps === true ? "oui" : v.finiATemps === false ? "non" : "", "-") + "</select></label>" +
      "</div>" +
      (nouveau
        ? '<p class="aide" data-reprise></p>'
        : '<div class="grille-2">' +
          '<label class="champ"><span>À refaire le</span><input type="date" name="aRefaireLe" value="' + u.esc(v.aRefaireLe || "") + '"></label>' +
          '<label class="champ"><span>Statut</span><select name="archivee">' + opts([["oui", "Archivée"]], v.archivee ? "oui" : "", "Active") + "</select></label>" +
          "</div>") +
      '<p class="erreur-form" data-erreur hidden></p>' +
      "</form>";

    function majReprise(el) {
      const f = el.querySelector("form");
      if (nouveau) {
        const p = el.querySelector("[data-reprise]");
        p.textContent = u.estJour(f.jour.value) ? "Reprise prévue le " + u.jourLong(st.premiereReprise(f.jour.value)) + " (J+3)." : "";
      } else if (!(err.reprises || []).length && u.estJour(f.jour.value)) {
        // Erreur jamais reprise : la date de reprise suit la date de l'erreur.
        f.aRefaireLe.value = st.premiereReprise(f.jour.value);
      }
    }

    // Lit et vérifie le formulaire. Renvoie les champs à enregistrer, ou null.
    function lire(el) {
      const f = el.querySelector("form");
      const jour = f.jour.value;
      const coche = f.querySelector('[name="typeErreur"]:checked');
      const type = coche ? Number(coche.value) : null;
      const regle = f.regle.value.trim();
      const temps = u.lireNombre(f.tempsSec.value);
      const manque = [];
      f.regle.classList.toggle("champ-invalide", !regle);
      if (!u.estJour(jour)) manque.push("la date");
      if (!type) manque.push("le type d'erreur");
      if (!regle) manque.push("la règle");
      if (manque.length) { montrerErreur(el, "À compléter : " + manque.join(", ") + "."); return null; }
      if (jour > u.aujourdhui()) { montrerErreur(el, "La date ne peut pas être dans le futur."); return null; }
      if (temps !== null && temps < 0) { montrerErreur(el, "Le temps passé doit être positif."); return null; }
      montrerErreur(el, "");
      const c = cascade.valeurs();
      const champs = {
        jour: jour, source: f.source.value, examen: ex,
        section: c.section, domaine: c.domaine, competence: c.competence,
        refQuestion: f.refQuestion.value.trim(), maReponse: f.maReponse.value.trim(), bonneReponse: f.bonneReponse.value.trim(),
        typeErreur: type, regle: regle,
        tempsSec: temps === null ? null : Math.round(temps),
        finiATemps: f.finiATemps.value === "oui" ? true : f.finiATemps.value === "non" ? false : null
      };
      if (nouveau) {
        Object.assign(champs, { aRefaireLe: st.premiereReprise(jour), justesDeSuite: 0, archivee: false, reprises: [] });
      } else {
        champs.aRefaireLe = u.estJour(f.aRefaireLe.value) ? f.aRefaireLe.value : err.aRefaireLe;
        champs.archivee = f.archivee.value === "oui";
        if (!champs.archivee && err.archivee) champs.justesDeSuite = 0; // désarchivée : le cycle repart
      }
      S.majAppareil({ dernierJournal: Object.assign({}, S.appareil().dernierJournal, { [ex]: { source: champs.source, section: c.section, domaine: c.domaine, competence: c.competence } }) });
      return champs;
    }

    const boutons = [{ texte: "Annuler" }];
    if (nouveau) {
      boutons.push({ texte: "Enregistrer et ajouter une autre", action: (fermer, el) => {
        const champs = lire(el);
        if (!champs) return false;
        S.ajouter("erreurs", champs);
        ui.toast("Erreur enregistrée");
        P.app.rafraichir();
        // On garde la date, la source et la compétence ; on vide le reste.
        const f = el.querySelector("form");
        ["refQuestion", "maReponse", "bonneReponse", "regle", "tempsSec"].forEach(n => { f[n].value = ""; });
        f.finiATemps.value = "";
        f.querySelectorAll('[name="typeErreur"]').forEach(r => { r.checked = false; });
        f.refQuestion.focus();
        return false;
      } });
    }
    boutons.push({ texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
      const champs = lire(el);
      if (!champs) return false;
      if (nouveau) { S.ajouter("erreurs", champs); ui.toast("Erreur enregistrée"); }
      else { S.modifier("erreurs", err.id, champs); ui.toast("Erreur modifiée"); }
      P.app.rafraichir();
    } });

    ui.modale({
      titre: nouveau ? "Nouvelle erreur" : "Modifier l'erreur",
      html: html,
      boutons: boutons,
      auMontage: el => {
        cascade = ui.lierCascade(el);
        const f = el.querySelector("form");
        f.addEventListener("submit", ev => ev.preventDefault());
        f.jour.addEventListener("change", () => majReprise(el));
        if (nouveau) majReprise(el);
      }
    });
  }

  function supprimer(id) {
    const e = S.trouver("erreurs", id);
    if (!e) return;
    ui.confirmer("Cette fiche du " + u.jourLong(e.jour) + (e.refQuestion ? " (" + e.refQuestion + ")" : "") + " sera retirée du journal.", { titre: "Supprimer l'erreur ?", ok: "Supprimer", danger: true })
      .then(ok => {
        if (!ok) return;
        S.supprimer("erreurs", id);
        ui.toast("Erreur supprimée");
        P.app.rafraichir();
      });
  }

  /* ---------- Reprises du jour ---------- */

  function rendreReprises(ex) {
    let h = '<a class="lien-retour" href="#/' + ex + '/journal">‹ Retour au journal</a><h1 class="titre-page">Reprises du jour</h1>';
    const file = st.erreursARefaire(ex);

    // Après un « Faux » : la règle en grand, avant la question suivante.
    const ratee = regleAAfficher && S.trouver("erreurs", regleAAfficher);
    if (ratee) {
      return h + '<section class="carte reprise">' +
        '<span class="badge badge-danger">Faux</span>' +
        '<p class="aide mt-petit">Relis la règle. Cette question reviendra le ' + u.jourLong(ratee.aRefaireLe) + ".</p>" +
        '<div class="reprise-regle">' + u.esc(ratee.regle) + "</div>" +
        (ratee.bonneReponse ? '<p class="erreur-rep">Bonne réponse : <strong>' + u.esc(ratee.bonneReponse) + "</strong></p>" : "") +
        '<button class="btn btn-primaire btn-geant mt" data-action="relu">' + (file.length ? "J'ai relu, question suivante" : "J'ai relu") + "</button>" +
        "</section>";
    }

    if (!file.length) {
      return h + '<section class="carte"><p class="vide">Rien à refaire aujourd\'hui pour l\'examen ' + P.PROGRAMME[ex].nom + ".</p>" +
        '<a class="btn btn-primaire" href="#/' + ex + '/journal">Retour au journal</a></section>';
    }

    const e = file[0];
    const chemin = P.prog.chemin(e);
    const n = (e.reprises || []).length;
    h += '<p class="aide mb">' + file.length + " " + u.accord(file.length, "question") + " à refaire</p>" +
      '<section class="carte reprise">' +
      '<div class="item-tete"><span class="badge">' + (TYPES[e.typeErreur] || "") + '</span><span class="item-meta">Erreur du ' + u.jourCourt(e.jour) +
      (n ? " · reprise n° " + (n + 1) : "") + "</span></div>" +
      '<div class="reprise-ref">' + u.esc([e.source, e.refQuestion].filter(Boolean).join(" · ") || "Question sans référence") + "</div>" +
      (chemin ? '<div class="item-chemin">' + u.esc(chemin) + "</div>" : "") +
      '<p class="mt">Refais la question sans regarder la règle, puis indique si tu as trouvé la bonne réponse.</p>' +
      (e.bonneReponse
        ? '<button class="btn btn-petit" data-action="voir-reponse">Voir la bonne réponse</button>' +
          '<p class="erreur-rep" data-reponse hidden>Bonne réponse : <strong>' + u.esc(e.bonneReponse) + "</strong>" +
          (e.maReponse ? " (tu avais répondu " + u.esc(e.maReponse) + ")" : "") + "</p>"
        : "") +
      '<div class="duo-boutons">' +
      '<button class="btn btn-geant btn-plein-succes" data-action="juste" data-id="' + e.id + '">Juste</button>' +
      '<button class="btn btn-geant btn-plein-danger" data-action="faux" data-id="' + e.id + '">Faux</button>' +
      "</div></section>";
    return h;
  }

  function repondre(id, juste) {
    const e = S.trouver("erreurs", id);
    if (!e) return;
    const changements = st.apresReprise(e, juste);
    S.modifier("erreurs", id, changements);
    if (juste) {
      ui.toast(changements.archivee ? "Juste deux fois de suite : erreur archivée" : "Juste. Prochaine reprise le " + u.jourLong(changements.aRefaireLe), 3500);
    } else {
      regleAAfficher = id;
    }
    P.app.rafraichir();
    window.scrollTo(0, 0);
  }

  /* ---------- La vue ---------- */

  P.vues.journal = {
    ouvrirFormulaire: ouvrirForm,
    rendre: function (r) {
      return r.sous === "reprises" ? rendreReprises(r.examen) : rendreListe(r.examen);
    },

    monter: function (el, r) {
      const ex = r.examen;
      el.addEventListener("click", ev => {
        const b = ev.target.closest("[data-action]");
        if (!b) return;
        const a = b.dataset.action, id = b.dataset.id;
        if (a === "ajouter") ouvrirForm(ex, null);
        else if (a === "modifier") ouvrirForm(ex, S.trouver("erreurs", id));
        else if (a === "supprimer") supprimer(id);
        else if (a === "plus") { limite += 50; P.app.rafraichir(); }
        else if (a === "importer-csv") P.importCsv.choisir(ex);
        else if (a === "juste") repondre(id, true);
        else if (a === "faux") repondre(id, false);
        else if (a === "relu") { regleAAfficher = null; P.app.rafraichir(); window.scrollTo(0, 0); }
        else if (a === "voir-reponse") { const p = el.querySelector("[data-reponse]"); p.hidden = !p.hidden; }
      });
      el.addEventListener("change", ev => {
        const s = ev.target.closest("[data-f]");
        if (!s) return;
        filtres[ex][s.dataset.f] = s.value || null;
        if (s.dataset.f === "section") filtres[ex].domaine = null;
        P.app.rafraichir();
      });
      const rep = el.querySelector("[data-repartition]");
      if (rep) rep.addEventListener("toggle", () => { repartitionOuverte[ex] = rep.open; });
      const repli = el.querySelector("[data-filtres-repli]");
      if (repli) repli.addEventListener("toggle", () => { filtresOuverts[ex] = repli.open; });
    }
  };
})(window.Prepa = window.Prepa || {});
