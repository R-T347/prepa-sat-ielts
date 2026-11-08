/* ==========================================================================
   vues/vocabulaire.js — l'onglet Vocabulaire (IELTS).
   Une fiche par mot ou expression : définition, phrase d'exemple, thème, statut
   (nouveau / en cours / acquis). Révision espacée simple : J+1, J+3, J+7, J+21
   (calcul dans stats.js). Mode « réviser » : on voit le mot, on réfléchit, on
   retourne la carte, puis « Je savais » ou « Je ne savais pas ».
   Adresses : #/ielts/vocabulaire et #/ielts/vocabulaire/revision
   Enregistrement : vocabulaire [{ mot, definition, exemple, theme, statut, etape, aReviserLe }]
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats, ui = P.ui;
  P.vues = P.vues || {};

  const STATUTS = { "nouveau": ["Nouveau", "badge-accent"], "en cours": ["En cours", "badge-alerte"], "acquis": ["Acquis", "badge-succes"] };
  const filtres = { theme: null, statut: null };

  function opts(liste, choisi, vide) {
    return (vide !== null ? '<option value="">' + u.esc(vide) + "</option>" : "") +
      liste.map(([v, lib]) => '<option value="' + u.esc(v) + '"' + (v === choisi ? " selected" : "") + ">" + u.esc(lib) + "</option>").join("");
  }
  function montrerErreur(el, message) {
    const p = el.querySelector("[data-erreur]");
    p.textContent = message;
    p.hidden = !message;
  }

  /* ---------- Liste ---------- */

  function carteMot(m) {
    const s = STATUTS[m.statut] || STATUTS.nouveau;
    const prochaine = m.statut === "acquis" ? "Acquis" : m.aReviserLe ? (m.aReviserLe <= u.aujourdhui() ? "À réviser aujourd'hui" : "Prochaine révision le " + u.jourCourt(m.aReviserLe)) : "";
    return '<li class="carte mot-carte" data-recherche="' + u.esc(u.simplifier(m.mot + " " + m.definition + " " + m.exemple)) + '">' +
      '<div class="item-tete"><strong class="mot">' + u.esc(m.mot) + '</strong><span class="badge ' + s[1] + '">' + s[0] + "</span>" +
      (m.theme ? '<span class="badge">' + u.esc(m.theme) + "</span>" : "") + "</div>" +
      (m.definition ? '<div class="mot-def">' + u.esc(m.definition) + "</div>" : "") +
      (m.exemple ? '<div class="mot-exemple">« ' + u.esc(m.exemple) + " »</div>" : "") +
      '<div class="item-meta mt-petit">' + prochaine + "</div>" +
      '<div class="item-actions"><button class="btn btn-lien" data-action="modifier" data-id="' + m.id + '">Modifier</button>' +
      '<button class="btn btn-lien danger" data-action="supprimer" data-id="' + m.id + '">Supprimer</button></div></li>';
  }

  function rendreListe() {
    const tous = S.liste("vocabulaire");
    const nReviser = st.motsAReviser().length;
    const nAcquis = tous.filter(m => m.statut === "acquis").length;
    const themes = S.d.parametres.themesVocabulaire.slice();
    tous.forEach(m => { if (m.theme && themes.indexOf(m.theme) === -1) themes.push(m.theme); });

    let h = '<div class="tuiles">' +
      '<a class="tuile' + (nReviser ? " accent" : "") + '" href="#/ielts/vocabulaire/revision"><span class="gros-chiffre">' + nReviser + "</span><span>à réviser aujourd'hui</span></a>" +
      '<div class="tuile"><span class="gros-chiffre">' + tous.length + "</span><span>" + u.accord(tous.length, "mot") + " en tout</span></div>" +
      '<div class="tuile"><span class="gros-chiffre">' + nAcquis + "</span><span>" + u.accord(nAcquis, "acquis", "acquis") + "</span></div></div>" +
      '<div class="rangee-boutons"><button class="btn btn-primaire" data-action="ajouter">Ajouter un mot</button>' +
      (nReviser ? '<a class="btn" href="#/ielts/vocabulaire/revision">Réviser (' + nReviser + ")</a>" : "") + "</div>";

    if (!tous.length) return h + '<section class="carte"><p class="vide">Aucun mot pour l\'instant. Ajoute les mots et expressions que tu rencontres, avec la phrase où tu les as lus.</p></section>';

    h += '<section class="carte"><div class="filtres">' +
      '<label class="champ" style="grid-column:1/-1"><span>Rechercher</span><input type="search" data-recherche-champ placeholder="Mot, définition ou exemple" autocomplete="off"></label>' +
      '<label class="champ"><span>Thème</span><select data-f="theme">' + opts(themes.map(t => [t, t]), filtres.theme, "Tous") + "</select></label>" +
      '<label class="champ"><span>Statut</span><select data-f="statut">' + opts(Object.keys(STATUTS).map(k => [k, STATUTS[k][0]]), filtres.statut, "Tous") + "</select></label>" +
      "</div></section>";

    const liste = tous.filter(m => (!filtres.theme || m.theme === filtres.theme) && (!filtres.statut || m.statut === filtres.statut))
      .sort((a, b) => (a.creeLe < b.creeLe ? 1 : -1));
    h += '<p class="aide mb" data-compte>' + liste.length + " " + u.accord(liste.length, "mot") + "</p>";
    h += liste.length ? '<ul class="liste">' + liste.map(carteMot).join("") + "</ul>" : '<p class="vide">Aucun mot ne correspond à ces filtres.</p>';
    return h;
  }

  /* ---------- Formulaire ---------- */

  function ouvrirForm(mot) {
    const nouveau = !mot;
    const v = mot || { mot: "", definition: "", exemple: "", theme: S.appareil().dernierTheme || "", statut: "nouveau" };
    const themes = S.d.parametres.themesVocabulaire.slice();
    if (v.theme && themes.indexOf(v.theme) === -1) themes.push(v.theme);
    const html = '<form novalidate>' +
      '<label class="champ"><span>Mot ou expression <span class="requis">*</span></span><input name="mot" maxlength="120" autocomplete="off" autocapitalize="off" value="' + u.esc(v.mot) + '"></label>' +
      '<label class="champ"><span>Définition</span><textarea name="definition" rows="2" maxlength="400">' + u.esc(v.definition) + "</textarea></label>" +
      '<label class="champ"><span>Phrase d\'exemple</span><textarea name="exemple" rows="2" maxlength="400" placeholder="De préférence la phrase où tu l\'as rencontré">' + u.esc(v.exemple) + "</textarea></label>" +
      '<div class="grille-2">' +
      '<label class="champ"><span>Thème</span><select name="theme">' + opts(themes.map(t => [t, t]), v.theme, "-") + "</select></label>" +
      '<label class="champ"><span>Statut</span><select name="statut">' + opts(Object.keys(STATUTS).map(k => [k, STATUTS[k][0]]), v.statut, null) + "</select></label>" +
      "</div>" +
      (nouveau ? '<p class="aide">Première révision demain, puis à J+3, J+7 et J+21.</p>' : "") +
      '<p class="erreur-form" data-erreur hidden></p></form>';

    function lire(el) {
      const f = el.querySelector("form");
      const texte = f.mot.value.trim();
      if (!texte) { montrerErreur(el, "Écris le mot ou l'expression."); f.mot.classList.add("champ-invalide"); return null; }
      const doublon = S.liste("vocabulaire").find(m => (!mot || m.id !== mot.id) && u.simplifier(m.mot) === u.simplifier(texte));
      if (doublon && !el.dataset.confirmeDoublon) {
        el.dataset.confirmeDoublon = "1";
        montrerErreur(el, "« " + doublon.mot + " » est déjà dans ta liste. Clique de nouveau pour l'ajouter quand même.");
        return null;
      }
      const statut = f.statut.value;
      const champs = { mot: texte, definition: f.definition.value.trim(), exemple: f.exemple.value.trim(), theme: f.theme.value, statut: statut };
      if (nouveau) {
        champs.etape = statut === "acquis" ? st.INTERVALLES_VOCAB.length : 0;
        champs.aReviserLe = statut === "acquis" ? null : st.premiereRevisionMot(u.aujourdhui());
      } else if (statut !== mot.statut) {
        // Statut changé à la main : on recale le cycle de révision.
        if (statut === "acquis") { champs.etape = st.INTERVALLES_VOCAB.length; champs.aReviserLe = null; }
        else if (mot.statut === "acquis" || statut === "nouveau") { champs.etape = 0; champs.aReviserLe = st.premiereRevisionMot(u.aujourdhui()); }
      }
      S.majAppareil({ dernierTheme: champs.theme });
      return champs;
    }

    const boutons = [{ texte: "Annuler" }];
    if (nouveau) {
      boutons.push({ texte: "Enregistrer et ajouter un autre", action: (fermer, el) => {
        const champs = lire(el);
        if (!champs) return false;
        S.ajouter("vocabulaire", champs);
        ui.toast("« " + champs.mot + " » ajouté");
        P.app.rafraichir();
        const f = el.querySelector("form");
        ["mot", "definition", "exemple"].forEach(n => { f[n].value = ""; });
        f.statut.value = "nouveau";
        delete el.dataset.confirmeDoublon;
        montrerErreur(el, "");
        f.mot.focus();
        return false;
      } });
    }
    boutons.push({ texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
      const champs = lire(el);
      if (!champs) return false;
      if (nouveau) { S.ajouter("vocabulaire", champs); ui.toast("« " + champs.mot + " » ajouté"); }
      else { S.modifier("vocabulaire", mot.id, champs); ui.toast("Mot modifié"); }
      P.app.rafraichir();
    } });

    ui.modale({
      titre: nouveau ? "Nouveau mot" : "Modifier le mot",
      html: html,
      boutons: boutons,
      auMontage: el => {
        const f = el.querySelector("form");
        f.addEventListener("submit", ev => ev.preventDefault());
        f.mot.addEventListener("input", () => { delete el.dataset.confirmeDoublon; f.mot.classList.remove("champ-invalide"); });
      }
    });
  }

  /* ---------- Révision (cartes à retourner) ---------- */

  function rendreRevision() {
    let h = '<a class="lien-retour" href="#/ielts/vocabulaire">‹ Retour au vocabulaire</a><h1 class="titre-page">Révision du vocabulaire</h1>';
    const file = st.motsAReviser();
    if (!file.length) {
      return h + '<section class="carte"><p class="vide">Aucun mot à réviser aujourd\'hui.</p><a class="btn btn-primaire" href="#/ielts/vocabulaire">Retour au vocabulaire</a></section>';
    }
    const m = file[0];
    h += '<p class="aide mb">' + file.length + " " + u.accord(file.length, "mot") + " à réviser</p>" +
      '<div class="flash" data-flash>' +
      '<div class="flash-interieur">' +
      '<div class="flash-face flash-recto">' + (m.theme ? '<span class="badge">' + u.esc(m.theme) + "</span>" : "") +
      '<div class="flash-mot">' + u.esc(m.mot) + '</div><p class="aide">Rappelle-toi le sens, puis retourne la carte.</p></div>' +
      '<div class="flash-face flash-verso"><div class="flash-mot petit">' + u.esc(m.mot) + "</div>" +
      '<div class="mot-def">' + (m.definition ? u.esc(m.definition) : "<em>Pas de définition saisie.</em>") + "</div>" +
      (m.exemple ? '<div class="mot-exemple">« ' + u.esc(m.exemple) + " »</div>" : "") + "</div>" +
      "</div></div>" +
      '<button class="btn btn-primaire btn-geant mt" data-action="retourner">Retourner la carte</button>' +
      '<div class="duo-boutons" data-reponses hidden>' +
      '<button class="btn btn-geant btn-plein-succes" data-action="savais" data-id="' + m.id + '">Je savais</button>' +
      '<button class="btn btn-geant btn-plein-danger" data-action="savais-pas" data-id="' + m.id + '">Je ne savais pas</button></div>';
    return h;
  }

  function repondre(id, savait) {
    const m = S.trouver("vocabulaire", id);
    if (!m) return;
    const ch = st.apresRevisionMot(m, savait);
    S.modifier("vocabulaire", id, ch);
    ui.toast(ch.statut === "acquis" ? "« " + m.mot + " » est acquis" : "Prochaine révision le " + u.jourLong(ch.aReviserLe), 2500);
    P.app.rafraichir();
    window.scrollTo(0, 0);
  }

  /* ---------- La vue ---------- */

  P.vues.vocabulaire = {
    rendre: r => (r.sous === "revision" ? rendreRevision() : rendreListe()),
    monter: function (el) {
      el.addEventListener("click", ev => {
        const b = ev.target.closest("[data-action]");
        if (!b) return;
        const a = b.dataset.action, id = b.dataset.id;
        if (a === "ajouter") ouvrirForm(null);
        else if (a === "modifier") ouvrirForm(S.trouver("vocabulaire", id));
        else if (a === "supprimer") {
          const m = S.trouver("vocabulaire", id);
          ui.confirmer("« " + m.mot + " » sera retiré de ta liste.", { titre: "Supprimer le mot ?", ok: "Supprimer", danger: true })
            .then(ok => { if (ok) { S.supprimer("vocabulaire", id); P.app.rafraichir(); } });
        } else if (a === "retourner") {
          el.querySelector("[data-flash]").classList.add("retournee");
          b.hidden = true;
          el.querySelector("[data-reponses]").hidden = false;
        } else if (a === "savais") repondre(id, true);
        else if (a === "savais-pas") repondre(id, false);
      });
      el.addEventListener("change", ev => {
        const s = ev.target.closest("[data-f]");
        if (!s) return;
        filtres[s.dataset.f] = s.value || null;
        P.app.rafraichir();
      });
      // Recherche : on masque les fiches qui ne correspondent pas, sans redessiner la page.
      const champ = el.querySelector("[data-recherche-champ]");
      if (champ) champ.addEventListener("input", () => {
        const t = u.simplifier(champ.value);
        let n = 0;
        el.querySelectorAll("[data-recherche]").forEach(li => {
          const ok = !t || li.dataset.recherche.indexOf(t) !== -1;
          li.hidden = !ok;
          if (ok) n++;
        });
        const compte = el.querySelector("[data-compte]");
        if (compte) compte.textContent = n + " " + u.accord(n, "mot");
      });
    }
  };
})(window.Prepa = window.Prepa || {});
