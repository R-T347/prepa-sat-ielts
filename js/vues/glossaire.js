/* ==========================================================================
   vues/glossaire.js — le Glossaire : les mots anglais qui te posent problème
   et leur traduction en français. Commun au SAT et à l'IELTS.
   Adresse : #/glossaire
   Enregistrement : glossaire [{ mot, traduction, phrase, source }]
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, ui = P.ui;
  P.vues = P.vues || {};

  let tri = "az";        // "az" ou "recents"
  let recherche = "";
  let detailsOuverts = false;

  const cle = m => (m || "").trim().toLowerCase();
  const doublon = (mot, saufId) => S.liste("glossaire").find(x => x.id !== saufId && cle(x.mot) === cle(mot));
  // Lettre de rangement : sans accent, A à Z, sinon « # ».
  const lettre = m => { const l = cle(m).normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase(); return /[A-Z]/.test(l) ? l : "#"; };

  function itemHTML(x) {
    return '<li class="glo-item" data-glo="' + x.id + '" data-texte="' + u.esc(cle(x.mot) + " " + cle(x.traduction) + " " + cle(x.phrase)) + '">' +
      '<div class="glo-tete"><b lang="en">' + u.esc(x.mot) + '</b><span class="glo-trad">' + u.esc(x.traduction) + "</span></div>" +
      (x.phrase ? '<p class="glo-phrase" lang="en">' + u.esc(x.phrase) + "</p>" : "") +
      '<div class="glo-pied">' + (x.source ? '<span class="item-meta">' + u.esc(x.source) + "</span>" : "<span></span>") +
      '<span class="item-actions"><button type="button" class="btn btn-lien" data-action="modifier" data-id="' + x.id + '">Modifier</button>' +
      '<button type="button" class="btn btn-lien danger" data-action="supprimer" data-id="' + x.id + '">Supprimer</button></span></div></li>';
  }

  function listeHTML() {
    const mots = S.liste("glossaire");
    if (!mots.length) return '<p class="vide">Ton glossaire est vide. Ajoute le premier mot qui t\'a posé problème.</p>';
    if (tri === "recents") {
      return '<ul class="glo-liste">' + mots.slice().sort((a, b) => (a.creeLe < b.creeLe ? 1 : -1)).map(itemHTML).join("") + "</ul>";
    }
    const tries = mots.slice().sort((a, b) => cle(a.mot).localeCompare(cle(b.mot), "en"));
    let h = "", courante = null;
    tries.forEach(x => {
      const l = lettre(x.mot);
      if (l !== courante) { h += (courante ? "</ul>" : "") + '<h3 class="glo-lettre" data-lettre>' + l + '</h3><ul class="glo-liste">'; courante = l; }
      h += itemHTML(x);
    });
    return h + "</ul>";
  }

  function formHTML(x) {
    x = x || {};
    return '<form novalidate>' +
      '<label class="champ"><span>Mot ou expression en anglais</span><input name="mot" lang="en" maxlength="120" autocomplete="off" autocapitalize="none" value="' + u.esc(x.mot || "") + '"></label>' +
      '<label class="champ"><span>Traduction en français</span><input name="traduction" maxlength="200" autocomplete="off" value="' + u.esc(x.traduction || "") + '"></label>' +
      '<label class="champ"><span>Phrase où tu l\'as trouvé (facultatif)</span><textarea name="phrase" lang="en" rows="2" maxlength="400">' + u.esc(x.phrase || "") + "</textarea></label>" +
      '<label class="champ"><span>Source (facultatif)</span><input name="source" maxlength="80" autocomplete="off" placeholder="Ex. Bluebook Test 6, Question Bank" value="' + u.esc(x.source || "") + '"></label>' +
      '<p class="erreur-form" data-erreur hidden></p></form>';
  }

  // Lit et vérifie le formulaire. Renvoie les champs, ou null (avec un message affiché).
  function lire(el, saufId) {
    const f = el.querySelector("form");
    const v = { mot: f.mot.value.trim(), traduction: f.traduction.value.trim(), phrase: (f.phrase ? f.phrase.value.trim() : ""), source: (f.source ? f.source.value.trim() : "") };
    const err = el.querySelector("[data-erreur]");
    let pb = !v.mot ? "Écris le mot en anglais." : !v.traduction ? "Écris sa traduction en français." : null;
    const d = !pb && doublon(v.mot, saufId);
    if (d) pb = "« " + d.mot + " » est déjà dans ton glossaire : " + d.traduction + ".";
    err.textContent = pb || "";
    err.hidden = !pb;
    return pb ? null : v;
  }

  function modifier(id) {
    const x = S.trouver("glossaire", id);
    if (!x) return;
    ui.modale({
      titre: "Modifier le mot",
      html: formHTML(x),
      auMontage: el => el.querySelector("form").addEventListener("submit", ev => ev.preventDefault()),
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const v = lire(el, id);
          if (!v) return false;
          S.modifier("glossaire", id, v);
          ui.toast("Mot modifié");
          P.app.rafraichir();
        } }
      ]
    });
  }

  function filtrer(el) {
    const q = cle(recherche);
    let n = 0;
    el.querySelectorAll(".glo-item").forEach(li => {
      const ok = !q || li.dataset.texte.indexOf(q) !== -1;
      li.hidden = !ok;
      if (ok) n++;
    });
    // Masquer les lettres sans résultat
    el.querySelectorAll("[data-lettre]").forEach(h => { h.hidden = !Array.from(h.nextElementSibling.children).some(li => !li.hidden); });
    const info = el.querySelector("[data-glo-info]");
    if (info) info.textContent = q ? n + " " + u.accord(n, "résultat") : "";
  }

  P.vues.glossaire = {
    rendre: function () {
      const n = S.liste("glossaire").length;
      return '<header class="cours-entete"><h1>Glossaire</h1><p class="aide">Les mots anglais qui t\'ont posé problème, avec leur traduction. ' +
        n + " " + u.accord(n, "mot") + ".</p></header>" +
        '<section class="carte"><h2>Ajouter un mot</h2><form class="glo-ajout" data-glo-ajout novalidate>' +
        '<div class="grille-2"><label class="champ"><span>En anglais</span><input name="mot" lang="en" maxlength="120" autocomplete="off" autocapitalize="none" placeholder="Ex. undermine"></label>' +
        '<label class="champ"><span>En français</span><input name="traduction" maxlength="200" autocomplete="off" placeholder="Ex. affaiblir, saper"></label></div>' +
        '<details class="glo-plus"' + (detailsOuverts ? " open" : "") + '><summary>Phrase et source (facultatif)</summary>' +
        '<label class="champ"><span>Phrase où tu l\'as trouvé</span><textarea name="phrase" lang="en" rows="2" maxlength="400"></textarea></label>' +
        '<label class="champ"><span>Source</span><input name="source" maxlength="80" autocomplete="off" placeholder="Ex. Bluebook Test 6, Question Bank"></label></details>' +
        '<p class="erreur-form" data-erreur hidden></p>' +
        '<button class="btn btn-primaire">' + P.icone("plus") + "Ajouter au glossaire</button></form></section>" +
        (n ? '<div class="glo-outils"><label class="cours-recherche">' + P.icone("carnet") + '<input type="search" data-glo-recherche placeholder="Chercher en anglais ou en français" value="' + u.esc(recherche) + '" autocomplete="off" aria-label="Chercher dans le glossaire"></label>' +
          '<div class="segment" role="radiogroup" aria-label="Ordre"><label><input type="radio" name="tri" value="az"' + (tri === "az" ? " checked" : "") + '><span>A → Z</span></label>' +
          '<label><input type="radio" name="tri" value="recents"' + (tri === "recents" ? " checked" : "") + "><span>Récents</span></label></div>" +
          '<p class="aide" data-glo-info></p></div>' : "") +
        '<section class="carte glo-carte">' + listeHTML() + "</section>";
    },

    monter: function (el) {
      const form = el.querySelector("[data-glo-ajout]");
      form.addEventListener("submit", ev => {
        ev.preventDefault();
        const v = lire(el.querySelector(".carte"), null);
        if (!v) return;
        S.ajouter("glossaire", v);
        ui.toast("« " + v.mot + " » ajouté");
        detailsOuverts = false;
        P.app.rafraichir();
        const champ = document.querySelector('[data-glo-ajout] [name="mot"]');
        if (champ) champ.focus({ preventScroll: true });
      });
      el.querySelector(".glo-plus").addEventListener("toggle", ev => { detailsOuverts = ev.target.open; });
      // Prévenir tout de suite si le mot existe déjà
      form.mot.addEventListener("input", () => {
        const d = form.mot.value.trim() && doublon(form.mot.value, null);
        const err = form.querySelector("[data-erreur]");
        err.textContent = d ? "« " + d.mot + " » est déjà dans ton glossaire : " + d.traduction + "." : "";
        err.hidden = !d;
      });
      const champ = el.querySelector("[data-glo-recherche]");
      if (champ) {
        champ.addEventListener("input", () => { recherche = champ.value; filtrer(el); });
        if (recherche) filtrer(el);
      }
      el.addEventListener("change", ev => {
        if (ev.target.name === "tri") { tri = ev.target.value; P.app.rafraichir(); }
      });
      el.addEventListener("click", ev => {
        const b = ev.target.closest("[data-action]");
        if (!b) return;
        if (b.dataset.action === "modifier") modifier(b.dataset.id);
        else if (b.dataset.action === "supprimer") {
          const x = S.trouver("glossaire", b.dataset.id);
          ui.confirmer("« " + x.mot + " » sera retiré de ton glossaire.", { titre: "Supprimer ce mot ?", ok: "Supprimer", danger: true })
            .then(ok => { if (ok) { S.supprimer("glossaire", x.id); ui.toast("Mot supprimé"); P.app.rafraichir(); } });
        }
      });
    }
  };
})(window.Prepa = window.Prepa || {});
