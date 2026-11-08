/* ==========================================================================
   vues/taches.js — l'onglet Tâches & ressources.
   Tâches : texte, échéance facultative, case « fait » ; les tâches faites passent
   en bas, grisées.
   Ressources : liens utiles (nom, adresse, à quoi elle sert). Celles du SAT sont
   pré-remplies (identifiants fixes, voir store.js), modifiables et supprimables.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, ui = P.ui;
  P.vues = P.vues || {};

  function montrerErreur(el, message) {
    const p = el.querySelector("[data-erreur]");
    p.textContent = message;
    p.hidden = !message;
  }

  /* ---------- Tâches ---------- */

  // À faire d'abord (par échéance, sans échéance à la fin), puis les tâches faites.
  function triTaches(liste) {
    const afaire = liste.filter(t => !t.fait).sort((a, b) => {
      if (a.echeance && b.echeance) return a.echeance < b.echeance ? -1 : a.echeance > b.echeance ? 1 : (a.creeLe < b.creeLe ? -1 : 1);
      if (a.echeance) return -1;
      if (b.echeance) return 1;
      return a.creeLe < b.creeLe ? -1 : 1;
    });
    const faites = liste.filter(t => t.fait).sort((a, b) => ((a.faitLe || "") < (b.faitLe || "") ? 1 : -1));
    return afaire.concat(faites);
  }

  function tacheHTML(t, auj) {
    let echeance = "";
    if (t.echeance) {
      const retard = !t.fait && t.echeance < auj;
      echeance = '<span class="item-meta' + (retard ? " en-retard" : "") + '">' +
        (retard ? "En retard · " : t.echeance === auj && !t.fait ? "Aujourd'hui · " : "") + "pour le " + u.jourCourt(t.echeance) + "</span>";
    }
    return '<li class="tache' + (t.fait ? " faite" : "") + '">' +
      '<label class="tache-case"><input type="checkbox" data-cocher="' + t.id + '"' + (t.fait ? " checked" : "") + ' aria-label="Fait">' +
      '<span class="tache-texte">' + u.esc(t.texte) + "</span></label>" +
      '<div class="tache-bas">' + echeance +
      '<span class="item-actions"><button class="btn btn-lien" data-action="modifier-tache" data-id="' + t.id + '">Modifier</button>' +
      '<button class="btn btn-lien danger" data-action="supprimer-tache" data-id="' + t.id + '">Supprimer</button></span></div></li>';
  }

  function ouvrirTache(t) {
    ui.modale({
      titre: "Modifier la tâche",
      html: '<form novalidate><label class="champ"><span>Tâche</span><textarea name="texte" rows="2" maxlength="300">' + u.esc(t.texte) + "</textarea></label>" +
        '<label class="champ"><span>Échéance (facultatif)</span><input type="date" name="echeance" value="' + u.esc(t.echeance || "") + '"></label>' +
        '<p class="erreur-form" data-erreur hidden></p></form>',
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const f = el.querySelector("form");
          const texte = f.texte.value.trim();
          if (!texte) { montrerErreur(el, "La tâche ne peut pas être vide."); return false; }
          S.modifier("taches", t.id, { texte: texte, echeance: u.estJour(f.echeance.value) ? f.echeance.value : null });
          P.app.rafraichir();
        } }
      ]
    });
  }

  /* ---------- Ressources ---------- */

  function ressourceHTML(r) {
    let hote = r.url;
    try { hote = new URL(r.url).hostname.replace(/^www\./, ""); } catch (e) { /* adresse gardée telle quelle */ }
    return '<li class="item ressource">' +
      '<a class="ressource-nom" href="' + u.esc(r.url) + '" target="_blank" rel="noopener noreferrer">' + u.esc(r.nom) + "</a>" +
      (r.usage ? '<div class="item-note">' + u.esc(r.usage) + "</div>" : "") +
      '<div class="item-meta">' + u.esc(hote) + "</div>" +
      '<div class="item-actions"><button class="btn btn-lien" data-action="modifier-ressource" data-id="' + r.id + '">Modifier</button>' +
      '<button class="btn btn-lien danger" data-action="supprimer-ressource" data-id="' + r.id + '">Supprimer</button></div></li>';
  }

  function ouvrirRessource(ex, r) {
    const v = r || { nom: "", url: "", usage: "" };
    ui.modale({
      titre: r ? "Modifier la ressource" : "Nouvelle ressource",
      html: '<form novalidate>' +
        '<label class="champ"><span>Nom</span><input name="nom" maxlength="80" autocomplete="off" value="' + u.esc(v.nom) + '" placeholder="Ex. Khan Academy"></label>' +
        '<label class="champ"><span>Adresse</span><input name="url" type="url" inputmode="url" autocomplete="off" value="' + u.esc(v.url) + '" placeholder="https://…"></label>' +
        '<label class="champ"><span>À quoi elle me sert</span><input name="usage" maxlength="160" autocomplete="off" value="' + u.esc(v.usage) + '" placeholder="Ex. Vidéos de cours en Math"></label>' +
        '<p class="erreur-form" data-erreur hidden></p></form>',
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const f = el.querySelector("form");
          const nom = f.nom.value.trim();
          const url = u.normaliserUrl(f.url.value);
          if (!nom) { montrerErreur(el, "Donne un nom à la ressource."); return false; }
          if (!url) { montrerErreur(el, "Adresse invalide. Exemple : https://www.khanacademy.org"); return false; }
          const champs = { nom: nom, url: url, usage: f.usage.value.trim() };
          if (r) S.modifier("ressources", r.id, champs);
          else S.ajouter("ressources", Object.assign({ examen: ex }, champs));
          P.app.rafraichir();
        } }
      ]
    });
  }

  /* ---------- La vue ---------- */

  function rendre(r) {
    const ex = r.examen;
    const auj = u.aujourdhui();
    const taches = triTaches(S.liste("taches", ex));
    const restantes = taches.filter(t => !t.fait).length;
    let h = '<section class="carte"><div class="carte-tete"><h2>Tâches</h2><span class="item-meta">' + restantes + " " + u.accord(restantes, "à faire", "à faire") + "</span></div>" +
      '<form class="ajout-tache" data-form="tache" novalidate>' +
      '<input name="texte" maxlength="300" autocomplete="off" placeholder="Nouvelle tâche" aria-label="Nouvelle tâche">' +
      '<input type="date" name="echeance" aria-label="Échéance (facultatif)">' +
      '<button class="btn btn-primaire" type="submit">Ajouter</button></form>';
    h += taches.length ? '<ul class="liste taches">' + taches.map(t => tacheHTML(t, auj)).join("") + "</ul>"
      : '<p class="vide">Aucune tâche pour l\'instant.</p>';
    h += "</section>";

    const ressources = S.liste("ressources", ex).sort((a, b) => (a.creeLe < b.creeLe ? -1 : a.creeLe > b.creeLe ? 1 : 0));
    h += '<section class="carte"><div class="carte-tete"><h2>Ressources</h2></div>' +
      (ressources.length ? '<ul class="liste">' + ressources.map(ressourceHTML).join("") + "</ul>" : '<p class="vide">Aucune ressource pour l\'instant.</p>') +
      '<button class="btn mt" data-action="ajouter-ressource">Ajouter une ressource</button></section>';
    return h;
  }

  function monter(el, r) {
    const ex = r.examen;
    const form = el.querySelector('[data-form="tache"]');
    form.addEventListener("submit", ev => {
      ev.preventDefault();
      const texte = form.texte.value.trim();
      if (!texte) { form.texte.focus(); return; }
      S.ajouter("taches", { examen: ex, texte: texte, echeance: u.estJour(form.echeance.value) ? form.echeance.value : null, fait: false, faitLe: null });
      P.app.rafraichir();
      const champ = document.querySelector('[data-form="tache"] [name="texte"]');
      if (champ) champ.focus({ preventScroll: true });
    });
    el.addEventListener("change", ev => {
      const id = ev.target.dataset.cocher;
      if (!id) return;
      const fait = ev.target.checked;
      S.modifier("taches", id, { fait: fait, faitLe: fait ? u.iso() : null });
      P.app.rafraichir();
      P.ui.animerCoche(document.querySelector('[data-cocher="' + id + '"]'), fait);
    });
    el.addEventListener("click", ev => {
      const b = ev.target.closest("[data-action]");
      if (!b) return;
      const a = b.dataset.action, id = b.dataset.id;
      if (a === "modifier-tache") ouvrirTache(S.trouver("taches", id));
      else if (a === "supprimer-tache") {
        const t = S.trouver("taches", id);
        ui.confirmer("« " + t.texte + " » sera supprimée.", { titre: "Supprimer la tâche ?", ok: "Supprimer", danger: true })
          .then(ok => { if (ok) { S.supprimer("taches", id); P.app.rafraichir(); } });
      } else if (a === "ajouter-ressource") ouvrirRessource(ex, null);
      else if (a === "modifier-ressource") ouvrirRessource(ex, S.trouver("ressources", id));
      else if (a === "supprimer-ressource") {
        const res = S.trouver("ressources", id);
        ui.confirmer("La ressource « " + res.nom + " » sera supprimée.", { titre: "Supprimer la ressource ?", ok: "Supprimer", danger: true })
          .then(ok => { if (ok) { S.supprimer("ressources", id); P.app.rafraichir(); } });
      }
    });
  }

  P.vues.taches = { rendre: rendre, monter: monter };
})(window.Prepa = window.Prepa || {});
