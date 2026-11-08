/* ==========================================================================
   vues/writing.js — l'onglet Writing (IELTS).
   Une fiche par essai : date, Task 1 ou Task 2, type d'essai, sujet, texte collé,
   nombre de mots calculé (alerte sous 150 mots en Task 1, sous 250 en Task 2),
   temps passé, band estimé pour chacun des 4 critères, band de la tâche, commentaires.
   Les types d'essai viennent de programme.js (Writing › Task 1 / Task 2), selon la
   variante Academic ou General Training.
   Enregistrement : essais [{ jour, tache, typeEssai, sujet, texte, tempsMin,
                              criteres: { ta, cc, lr, gra }, bandTache, commentaires }]
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, ui = P.ui;
  P.vues = P.vues || {};

  const MIN_MOTS = { 1: 150, 2: 250 };
  const CRITERES = [
    { id: "ta", court: "TA/TR", nom: t => (t === 1 ? "Task Achievement" : "Task Response") },
    { id: "cc", court: "CC", nom: () => "Coherence and Cohesion" },
    { id: "lr", court: "LR", nom: () => "Lexical Resource" },
    { id: "gra", court: "GRA", nom: () => "Grammatical Range and Accuracy" }
  ];
  const BANDS = [];
  for (let b = 9; b >= 0; b -= 0.5) BANDS.push(b);
  const fmtBand = b => (b === null || b === undefined || b === "" ? "-" : u.nombre(b));
  const lireBand = v => (v === "" || v === null || v === undefined ? null : Number(v));
  // Moyenne des critères renseignés, arrondie au demi-band le plus proche.
  function moyenneCriteres(c) {
    const v = CRITERES.map(x => c[x.id]).filter(x => typeof x === "number");
    return v.length === 4 ? Math.round((v.reduce((a, b) => a + b, 0) / 4) * 2) / 2 : null;
  }
  const typesEssai = tache => P.prog.competences("ielts", "writing", "t" + tache);
  function nomType(e) {
    const c = P.prog.competence("ielts", "writing", "t" + e.tache, e.typeEssai);
    return c ? c.nom : (e.typeEssai || "");
  }
  function selectBand(nom, v, vide) {
    return '<select name="' + nom + '"><option value="">' + (vide || "-") + "</option>" +
      BANDS.map(b => '<option value="' + b + '"' + (v === b ? " selected" : "") + ">" + u.nombre(b) + "</option>").join("") + "</select>";
  }

  /* ---------- Liste ---------- */

  function resumeHTML(essais) {
    const derniers = essais.slice(0, 5);
    const moyennes = CRITERES.map(c => {
      const v = derniers.map(e => (e.criteres || {})[c.id]).filter(x => typeof x === "number");
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    });
    const valides = moyennes.filter(x => x !== null);
    const plusFaible = valides.length ? CRITERES[moyennes.indexOf(Math.min(...valides))] : null;
    const dernierBand = t => { const e = essais.find(x => x.tache === t && typeof x.bandTache === "number"); return e ? fmtBand(e.bandTache) : "-"; };
    return '<section class="carte"><h2>Mes critères</h2>' +
      '<div class="criteres-moy">' + CRITERES.map((c, i) =>
        '<div class="tuile' + (plusFaible && plusFaible.id === c.id ? " accent" : "") + '"><span class="gros-chiffre">' + (moyennes[i] === null ? "-" : u.nombre(Math.round(moyennes[i] * 10) / 10)) + "</span><span>" + c.court + "</span></div>").join("") + "</div>" +
      '<p class="aide">' + (derniers.length === 1 ? "Notes de ton dernier essai." : "Moyenne de tes " + derniers.length + " derniers essais.") +
      (plusFaible ? " Critère le plus faible : <strong>" + (plusFaible.id === "ta" ? "Task Achievement / Task Response" : plusFaible.nom()) + "</strong>." : "") + "</p>" +
      '<p class="aide">Dernier band Task 1 : <strong>' + dernierBand(1) + "</strong> · Task 2 : <strong>" + dernierBand(2) + "</strong></p></section>";
  }

  function itemEssai(e) {
    const mots = u.compterMots(e.texte);
    const min = MIN_MOTS[e.tache];
    const court = e.texte && mots < min;
    const c = e.criteres || {};
    return '<li class="item essai">' +
      '<div class="item-tete"><span class="test-score">' + fmtBand(e.bandTache) + '</span><span class="badge badge-accent">Task ' + e.tache + "</span>" +
      '<span class="item-meta">' + u.jourCourt(e.jour) + (e.typeEssai ? " · " + u.esc(nomType(e)) : "") + "</span></div>" +
      (e.sujet ? '<div class="essai-sujet">' + u.esc(e.sujet) + "</div>" : "") +
      '<div class="test-detail">' + CRITERES.map(x => "<span>" + (x.id === "ta" ? (e.tache === 1 ? "TA" : "TR") : x.court) + " <b>" + fmtBand(c[x.id]) + "</b></span>").join("") + "</div>" +
      '<div class="item-meta mt-petit">' + (e.texte ? '<span class="' + (court ? "en-retard" : "") + '">' + mots + " mots" + (court ? " (minimum " + min + ")" : "") + "</span>" : "Texte non collé") +
      (e.tempsMin ? " · " + e.tempsMin + " min" : "") + "</div>" +
      (e.commentaires ? '<div class="item-note">' + u.esc(e.commentaires) + "</div>" : "") +
      '<div class="item-actions"><button class="btn btn-lien" data-action="modifier" data-id="' + e.id + '">Ouvrir</button>' +
      '<button class="btn btn-lien danger" data-action="supprimer" data-id="' + e.id + '">Supprimer</button></div></li>';
  }

  function rendre() {
    const essais = S.liste("essais").sort((a, b) => (a.jour !== b.jour ? (a.jour < b.jour ? 1 : -1) : (a.creeLe < b.creeLe ? 1 : -1)));
    let h = '<div class="rangee-boutons"><button class="btn btn-primaire" data-action="ajouter">Nouvel essai</button></div>';
    if (!essais.length) return h + '<section class="carte"><p class="vide">Aucun essai pour l\'instant. Colle tes essais ici avec ton estimation pour chacun des 4 critères.</p></section>';
    h += resumeHTML(essais);
    h += '<section class="carte"><h2>Mes essais</h2><ul class="liste">' + essais.map(itemEssai).join("") + "</ul></section>";
    return h;
  }

  /* ---------- Formulaire ---------- */

  function ouvrirForm(essai) {
    const v = essai || { jour: u.aujourdhui(), tache: 2, typeEssai: "", sujet: "", texte: "", tempsMin: null, criteres: {}, bandTache: null, commentaires: "" };
    const c = v.criteres || {};
    let bandManuel = !!essai; // une fiche existante garde son band ; une nouvelle le calcule tant qu'on n'y touche pas

    const html = '<form novalidate>' +
      '<div class="grille-2">' +
      '<label class="champ"><span>Date</span><input type="date" name="jour" value="' + u.esc(v.jour) + '" max="' + u.aujourdhui() + '"></label>' +
      '<div class="champ"><span class="legende">Tâche</span><div class="segment">' +
      '<label><input type="radio" name="tache" value="1"' + (v.tache === 1 ? " checked" : "") + "><span>Task 1</span></label>" +
      '<label><input type="radio" name="tache" value="2"' + (v.tache === 2 ? " checked" : "") + "><span>Task 2</span></label></div></div>" +
      "</div>" +
      '<label class="champ"><span>Type d\'essai</span><select name="typeEssai" data-types></select></label>' +
      '<label class="champ"><span>Sujet</span><textarea name="sujet" rows="2">' + u.esc(v.sujet) + "</textarea></label>" +
      '<label class="champ"><span>Mon texte</span><textarea name="texte" rows="10" class="texte-essai" placeholder="Colle ton essai ici">' + u.esc(v.texte) + "</textarea></label>" +
      '<p class="compte-mots" data-mots></p>' +
      '<label class="champ"><span>Temps passé (min)</span><input type="number" name="tempsMin" min="0" max="300" step="1" inputmode="numeric" value="' + (v.tempsMin || "") + '"></label>' +
      '<p class="legende" style="margin:0 0 .3rem">Band estimé par critère</p>' +
      '<div class="grille-2">' + CRITERES.map(x =>
        '<label class="champ"><span data-lib-critere="' + x.id + '">' + x.nom(v.tache) + "</span>" + selectBand("crit-" + x.id, c[x.id]) + "</label>").join("") + "</div>" +
      '<label class="champ"><span>Band de la tâche</span>' + selectBand("bandTache", v.bandTache) +
      '<span class="aide">Proposé automatiquement : moyenne des 4 critères, arrondie au demi-band. Tu peux le changer.</span></label>' +
      '<label class="champ"><span>Commentaires</span><textarea name="commentaires" rows="3" placeholder="Ce qui a marché, ce qu\'il faut corriger">' + u.esc(v.commentaires) + "</textarea></label>" +
      '<p class="erreur-form" data-erreur hidden></p></form>';

    function maj(el) {
      const f = el.querySelector("form");
      const tache = Number(f.querySelector('[name="tache"]:checked').value);
      // Types d'essai de la tâche choisie
      const sel = f.typeEssai;
      if (sel.dataset.tache !== String(tache)) {
        const actuel = sel.dataset.tache ? sel.value : v.typeEssai;
        const types = typesEssai(tache);
        sel.innerHTML = '<option value="">-</option>' + types.map(t => '<option value="' + t.id + '"' + (t.id === actuel ? " selected" : "") + ">" + u.esc(t.nom) + "</option>").join("");
        sel.dataset.tache = String(tache);
        el.querySelector('[data-lib-critere="ta"]').textContent = CRITERES[0].nom(tache);
      }
      // Nombre de mots et alerte
      const mots = u.compterMots(f.texte.value);
      const min = MIN_MOTS[tache];
      const p = el.querySelector("[data-mots]");
      p.textContent = mots + " " + u.accord(mots, "mot") + (f.texte.value.trim() && mots < min ? ". En dessous du minimum de " + min + " mots pour la Task " + tache : "");
      p.classList.toggle("alerte-mots", !!f.texte.value.trim() && mots < min);
      // Band de la tâche proposé
      if (!bandManuel) {
        const m = moyenneCriteres(lireCriteres(f));
        f.bandTache.value = m === null ? "" : String(m);
      }
    }
    function lireCriteres(f) {
      const r = {};
      CRITERES.forEach(x => { r[x.id] = lireBand(f["crit-" + x.id].value); });
      return r;
    }

    ui.modale({
      titre: essai ? "Essai du " + u.jourCourt(essai.jour) : "Nouvel essai",
      html: html,
      auMontage: el => {
        const f = el.querySelector("form");
        f.addEventListener("submit", ev => ev.preventDefault());
        f.addEventListener("input", () => maj(el));
        f.addEventListener("change", ev => {
          if (ev.target.name === "bandTache") bandManuel = ev.target.value !== "";
          maj(el);
        });
        maj(el);
      },
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const f = el.querySelector("form");
          const err = el.querySelector("[data-erreur]");
          if (!u.estJour(f.jour.value)) { err.textContent = "Indique la date."; err.hidden = false; return false; }
          const temps = u.lireNombre(f.tempsMin.value);
          const champs = {
            jour: f.jour.value,
            tache: Number(f.querySelector('[name="tache"]:checked').value),
            typeEssai: f.typeEssai.value,
            sujet: f.sujet.value.trim(),
            texte: f.texte.value.trim(),
            tempsMin: temps === null ? null : Math.max(0, Math.round(temps)),
            criteres: lireCriteres(f),
            bandTache: lireBand(f.bandTache.value),
            commentaires: f.commentaires.value.trim()
          };
          if (essai) { S.modifier("essais", essai.id, champs); ui.toast("Essai modifié"); }
          else { S.ajouter("essais", champs); ui.toast("Essai enregistré : " + u.compterMots(champs.texte) + " mots"); }
          P.app.rafraichir();
        } }
      ]
    });
  }

  P.vues.writing = {
    rendre: rendre,
    monter: function (el) {
      el.addEventListener("click", ev => {
        const b = ev.target.closest("[data-action]");
        if (!b) return;
        const a = b.dataset.action, id = b.dataset.id;
        if (a === "ajouter") ouvrirForm(null);
        else if (a === "modifier") ouvrirForm(S.trouver("essais", id));
        else if (a === "supprimer") {
          const e = S.trouver("essais", id);
          ui.confirmer("L'essai du " + u.jourLong(e.jour) + " (Task " + e.tache + ") sera supprimé, texte compris.", { titre: "Supprimer l'essai ?", ok: "Supprimer", danger: true })
            .then(ok => { if (ok) { S.supprimer("essais", id); P.app.rafraichir(); } });
        }
      });
    },
    compterMots: u.compterMots
  };
})(window.Prepa = window.Prepa || {});
