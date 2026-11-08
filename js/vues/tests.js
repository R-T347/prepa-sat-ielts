/* ==========================================================================
   vues/tests.js — les tests blancs.
   SAT : scores R&W et Math (200 à 800, par pas de 10), total calculé,
         « Module 2 plus facile ? » par section, réponses au hasard, remarques par module.
   IELTS : bands des 4 épreuves (0 à 9, par demi-band), band global calculé.
   Courbe d'évolution avec la ligne d'objectif.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats, ui = P.ui;
  P.vues = P.vues || {};

  const fmtScore = ex => (ex === "sat" ? v => u.nombre(v, 0) : v => u.nombre(v, 1));
  const ouiNon = v => (v === true ? "oui" : v === false ? "non" : "-");
  const BANDS = [];
  for (let b = 9; b >= 0; b -= 0.5) BANDS.push(b);

  function objectifDe(ex) {
    const v = ex === "sat" ? S.d.parametres.sat.objectifScore : S.d.parametres.ielts.objectifBand;
    return v === null || v === undefined || v === "" ? null : Number(v);
  }
  // Tests du plus ancien au plus récent.
  function chronologiques(ex) {
    return S.liste("testsBlancs", ex).sort((a, b) =>
      a.jour !== b.jour ? (a.jour < b.jour ? -1 : 1) : (a.creeLe < b.creeLe ? -1 : 1));
  }
  function montrerErreur(el, message) {
    const p = el.querySelector("[data-erreur]");
    p.textContent = message;
    p.hidden = !message;
  }

  /* ---------- Rendu ---------- */

  function itemTest(t) {
    const fmt = fmtScore(t.examen);
    let corps = "";
    if (t.examen === "sat") {
      const r = t.remarques || {};
      const remarques = [["rw1", "R&W module 1"], ["rw2", "R&W module 2"], ["math1", "Math module 1"], ["math2", "Math module 2"]]
        .filter(([k]) => r[k]).map(([k, lib]) => "<li><b>" + lib + " :</b> " + u.esc(r[k]) + "</li>").join("");
      corps = '<div class="test-detail"><span>Reading and Writing <b>' + t.rw + "</b></span><span>Math <b>" + t.math + "</b></span></div>" +
        '<div class="test-detail item-meta"><span>Module 2 plus facile ? R&W : ' + ouiNon(t.rwModule2PlusFacile) + ", Math : " + ouiNon(t.mathModule2PlusFacile) + "</span>" +
        (t.auHasard ? "<span>" + t.auHasard + " " + u.accord(t.auHasard, "réponse") + " au hasard</span>" : "") + "</div>" +
        (remarques ? '<ul class="test-remarques">' + remarques + "</ul>" : "");
    } else {
      corps = '<div class="test-detail"><span>Listening <b>' + u.nombre(t.listening) + "</b></span><span>Reading <b>" + u.nombre(t.reading) +
        "</b></span><span>Writing <b>" + u.nombre(t.writing) + "</b></span><span>Speaking <b>" + u.nombre(t.speaking) + "</b></span></div>" +
        (t.remarques ? '<ul class="test-remarques"><li>' + u.esc(t.remarques) + "</li></ul>" : "");
    }
    return '<li class="item">' +
      '<div class="item-tete"><span class="test-score">' + fmt(st.scoreTest(t)) + '</span><span class="item-meta">' + u.esc(u.jourLong(t.jour)) +
      (t.source ? " · " + u.esc(t.source) : "") + "</span></div>" + corps +
      '<div class="item-actions">' +
      '<button class="btn btn-lien" data-action="modifier" data-id="' + t.id + '">Modifier</button>' +
      '<button class="btn btn-lien danger" data-action="supprimer" data-id="' + t.id + '">Supprimer</button>' +
      "</div></li>";
  }

  function rendre(r) {
    const ex = r.examen;
    const tests = chronologiques(ex);
    const fmt = fmtScore(ex);
    let h = '<div class="rangee-boutons"><button class="btn btn-primaire" data-action="ajouter">Ajouter un test blanc</button></div>';
    if (!tests.length) return h + '<section class="carte"><p class="vide">Aucun test blanc enregistré.</p></section>';

    const scores = tests.map(st.scoreTest);
    const objectif = objectifDe(ex);
    h += '<div class="tuiles">' +
      '<div class="tuile"><span class="gros-chiffre">' + fmt(scores[scores.length - 1]) + "</span><span>dernier test</span></div>" +
      '<div class="tuile"><span class="gros-chiffre">' + fmt(Math.max.apply(null, scores)) + "</span><span>meilleur</span></div>" +
      '<div class="tuile"><span class="gros-chiffre">' + (objectif !== null ? fmt(objectif) : "-") + "</span><span>objectif</span></div>" +
      "</div>";
    h += '<section class="carte"><h2>' + (ex === "sat" ? "Évolution du score total" : "Évolution du band global") + "</h2>" +
      '<div class="courbe" data-courbe></div>' +
      (objectif === null ? '<p class="aide">Règle ton objectif dans les <a href="#/parametres">Paramètres</a> pour afficher la ligne d\'objectif.</p>' : "") +
      "</section>";
    h += sectionsHTML(ex, tests);
    h += '<section class="carte"><h2>Tous les tests</h2><ul class="liste">' + tests.slice().reverse().map(itemTest).join("") + "</ul></section>";
    return h;
  }

  function dessinerCourbe(el, ex) {
    const zone = el.querySelector("[data-courbe]");
    if (!zone) return;
    const tests = chronologiques(ex);
    const points = tests.map(t => ({ jour: t.jour, valeur: st.scoreTest(t), detail: t.source }));
    const valeurs = points.map(p => p.valeur);
    const objectif = objectifDe(ex);
    const fmt = fmtScore(ex);
    let min, max, pas;
    if (ex === "sat") {
      const bas = Math.min.apply(null, valeurs.concat(objectif !== null ? [objectif] : []));
      min = Math.max(400, Math.floor((bas - 50) / 100) * 100);
      max = 1600;
      pas = max - min <= 600 ? 100 : 200;
    } else {
      const bas = Math.min.apply(null, valeurs.concat(objectif !== null ? [objectif] : []));
      min = Math.max(0, Math.floor(bas - 1));
      max = 9;
      pas = 1;
    }
    ui.courbe(zone, points, {
      min: min, max: max, pas: pas, objectif: objectif,
      libObjectif: objectif !== null ? "Objectif " + fmt(objectif) : "",
      format: fmt,
      titre: ex === "sat" ? "Évolution du score total SAT" : "Évolution du band global IELTS"
    });
  }


  /* ---------- Courbes par section ----------
     Une courbe par section (SAT : Reading and Writing, Math) ou par épreuve (IELTS),
     avec l'écart entre le premier et le dernier test. Ligne de référence : la moitié de
     l'objectif SAT pour chaque section (ex. 750 pour 1500), l'objectif de band pour l'IELTS. */
  const SECTIONS = {
    sat: [["rw", "Reading and Writing"], ["math", "Math"]],
    ielts: [["listening", "Listening"], ["reading", "Reading"], ["writing", "Writing"], ["speaking", "Speaking"]]
  };

  function sectionsHTML(ex, tests) {
    const fmt = fmtScore(ex);
    return '<section class="carte"><h2>Par section</h2><div class="sections-courbes">' +
      SECTIONS[ex].map(([cle, nom]) => {
        const v = tests.map(t => Number(t[cle])).filter(x => !isNaN(x));
        let tendance = "";
        if (v.length >= 2) {
          const d = v[v.length - 1] - v[0];
          tendance = (d > 0 ? "+" : "") + fmt(d) + " depuis le 1er test";
        } else if (v.length) tendance = "dernier : " + fmt(v[v.length - 1]);
        return '<div class="section-courbe"><div class="carte-tete"><h3>' + nom + '</h3><span class="item-meta">' + tendance + "</span></div>" +
          '<div class="courbe" data-courbe-section="' + cle + '"></div></div>';
      }).join("") + "</div></section>";
  }

  function dessinerSections(el, ex) {
    const tests = chronologiques(ex);
    const fmt = fmtScore(ex);
    const objectif = objectifDe(ex);
    SECTIONS[ex].forEach(([cle, nom]) => {
      const zone = el.querySelector('[data-courbe-section="' + cle + '"]');
      if (!zone) return;
      const points = tests.map(t => ({ jour: t.jour, valeur: Number(t[cle]), detail: t.source })).filter(p => !isNaN(p.valeur));
      const ref = objectif === null ? null : (ex === "sat" ? Math.round(objectif / 20) * 10 : objectif);
      const bas = Math.min.apply(null, points.map(p => p.valeur).concat(ref !== null ? [ref] : []));
      const echelle = ex === "sat"
        ? { min: Math.max(200, Math.floor((bas - 30) / 50) * 50), max: 800, pas: 100 }
        : { min: Math.max(0, Math.floor(bas - 1)), max: 9, pas: 1 };
      if (ex === "sat" && echelle.max - echelle.min <= 300) echelle.pas = 50;
      ui.courbe(zone, points, Object.assign(echelle, {
        objectif: ref, libObjectif: ref !== null ? "Repère " + fmt(ref) : "", format: fmt, titre: "Évolution " + nom
      }));
    });
  }
  /* ---------- Formulaires ---------- */

  function selectOuiNon(nom, v) {
    return '<select name="' + nom + '"><option value="">-</option>' +
      '<option value="oui"' + (v === true ? " selected" : "") + ">Oui</option>" +
      '<option value="non"' + (v === false ? " selected" : "") + ">Non</option></select>";
  }
  function selectBand(nom, v) {
    return '<select name="' + nom + '"><option value="">-</option>' +
      BANDS.map(b => '<option value="' + b + '"' + (v === b ? " selected" : "") + ">" + u.nombre(b) + "</option>").join("") + "</select>";
  }
  const lireOuiNon = v => (v === "oui" ? true : v === "non" ? false : null);

  function ouvrirForm(ex, test) {
    const v = test || { jour: u.aujourdhui(), source: "" };
    const sourcesConnues = Array.from(new Set(S.liste("testsBlancs").map(t => t.source).filter(Boolean)));
    let html = '<form novalidate>' +
      '<div class="grille-2">' +
      '<label class="champ"><span>Date</span><input type="date" name="jour" value="' + u.esc(v.jour) + '" max="' + u.aujourdhui() + '"></label>' +
      '<label class="champ"><span>Source</span><input name="source" list="sources-tests" value="' + u.esc(v.source) + '" placeholder="Ex. Bluebook Test 7" autocomplete="off"></label>' +
      "</div>" +
      '<datalist id="sources-tests">' + sourcesConnues.map(s => '<option value="' + u.esc(s) + '">').join("") + "</datalist>";

    if (ex === "sat") {
      const r = v.remarques || {};
      html += '<div class="grille-2">' +
        '<label class="champ"><span>Reading and Writing</span><input type="number" name="rw" min="200" max="800" step="10" inputmode="numeric" value="' + (v.rw || "") + '" placeholder="200 à 800"></label>' +
        '<label class="champ"><span>Math</span><input type="number" name="math" min="200" max="800" step="10" inputmode="numeric" value="' + (v.math || "") + '" placeholder="200 à 800"></label>' +
        "</div>" +
        '<div class="total-live">Total : <strong data-total>-</strong></div>' +
        '<div class="grille-2">' +
        '<label class="champ"><span>Module 2 R&W plus facile ?</span>' + selectOuiNon("rwModule2PlusFacile", v.rwModule2PlusFacile) + "</label>" +
        '<label class="champ"><span>Module 2 Math plus facile ?</span>' + selectOuiNon("mathModule2PlusFacile", v.mathModule2PlusFacile) + "</label>" +
        "</div>" +
        '<p class="aide" style="margin:-.5rem 0 .85rem">« Oui » = après le module 1, tu as eu le module 2 le plus facile. C\'est le seul indice sur le routage adaptatif.</p>' +
        '<label class="champ"><span>Questions répondues au hasard (manque de temps)</span><input type="number" name="auHasard" min="0" step="1" inputmode="numeric" value="' + (v.auHasard || "") + '"></label>' +
        '<div class="grille-2">' +
        '<label class="champ"><span>Remarques R&W module 1</span><textarea name="rw1" rows="2">' + u.esc(r.rw1) + "</textarea></label>" +
        '<label class="champ"><span>Remarques R&W module 2</span><textarea name="rw2" rows="2">' + u.esc(r.rw2) + "</textarea></label>" +
        '<label class="champ"><span>Remarques Math module 1</span><textarea name="math1" rows="2">' + u.esc(r.math1) + "</textarea></label>" +
        '<label class="champ"><span>Remarques Math module 2</span><textarea name="math2" rows="2">' + u.esc(r.math2) + "</textarea></label>" +
        "</div>";
    } else {
      html += '<div class="grille-4">' +
        '<label class="champ"><span>Listening</span>' + selectBand("listening", v.listening) + "</label>" +
        '<label class="champ"><span>Reading</span>' + selectBand("reading", v.reading) + "</label>" +
        '<label class="champ"><span>Writing</span>' + selectBand("writing", v.writing) + "</label>" +
        '<label class="champ"><span>Speaking</span>' + selectBand("speaking", v.speaking) + "</label>" +
        "</div>" +
        '<div class="total-live">Band global : <strong data-total>-</strong></div>' +
        '<label class="champ"><span>Remarques</span><textarea name="remarques" rows="3">' + u.esc(v.remarques) + "</textarea></label>";
    }
    html += '<p class="erreur-form" data-erreur hidden></p></form>';

    function majTotal(el) {
      const f = el.querySelector("form");
      const sortie = el.querySelector("[data-total]");
      if (ex === "sat") {
        const rw = u.lireNombre(f.rw.value), math = u.lireNombre(f.math.value);
        const ok = st.scoreValideSat(rw) && st.scoreValideSat(math);
        sortie.textContent = ok ? u.nombre(rw + math, 0) : "-";
      } else {
        const b = ["listening", "reading", "writing", "speaking"].map(n => f[n].value === "" ? null : Number(f[n].value));
        sortie.textContent = b.every(x => x !== null) ? u.nombre(st.bandGlobal(b[0], b[1], b[2], b[3])) : "-";
      }
    }

    function lire(el) {
      const f = el.querySelector("form");
      const jour = f.jour.value;
      if (!u.estJour(jour)) { montrerErreur(el, "Indique la date du test."); return null; }
      if (jour > u.aujourdhui()) { montrerErreur(el, "La date ne peut pas être dans le futur."); return null; }
      const base = { examen: ex, jour: jour, source: f.source.value.trim() };
      if (ex === "sat") {
        const rw = u.lireNombre(f.rw.value), math = u.lireNombre(f.math.value);
        f.rw.classList.toggle("champ-invalide", !st.scoreValideSat(rw));
        f.math.classList.toggle("champ-invalide", !st.scoreValideSat(math));
        if (!st.scoreValideSat(rw) || !st.scoreValideSat(math)) { montrerErreur(el, "Chaque score va de 200 à 800, par pas de 10."); return null; }
        const hasard = u.lireNombre(f.auHasard.value);
        if (hasard !== null && (hasard < 0 || !Number.isInteger(hasard))) { montrerErreur(el, "Le nombre de réponses au hasard doit être un entier positif."); return null; }
        return Object.assign(base, {
          rw: rw, math: math,
          rwModule2PlusFacile: lireOuiNon(f.rwModule2PlusFacile.value),
          mathModule2PlusFacile: lireOuiNon(f.mathModule2PlusFacile.value),
          auHasard: hasard === null ? 0 : hasard,
          remarques: { rw1: f.rw1.value.trim(), rw2: f.rw2.value.trim(), math1: f.math1.value.trim(), math2: f.math2.value.trim() }
        });
      }
      const noms = ["listening", "reading", "writing", "speaking"];
      const b = noms.map(n => f[n].value === "" ? null : Number(f[n].value));
      noms.forEach((n, i) => f[n].classList.toggle("champ-invalide", b[i] === null));
      if (b.some(x => x === null || !st.bandValide(x))) { montrerErreur(el, "Indique les 4 bands (0 à 9, par demi-band)."); return null; }
      return Object.assign(base, { listening: b[0], reading: b[1], writing: b[2], speaking: b[3], remarques: f.remarques.value.trim() });
    }

    ui.modale({
      titre: (test ? "Modifier le test blanc " : "Nouveau test blanc ") + P.PROGRAMME[ex].nom,
      html: html,
      auMontage: el => {
        const f = el.querySelector("form");
        f.addEventListener("submit", ev => ev.preventDefault());
        f.addEventListener("input", () => majTotal(el));
        f.addEventListener("change", () => majTotal(el));
        majTotal(el);
      },
      boutons: [
        { texte: "Annuler" },
        { texte: "Enregistrer", classe: "btn-primaire", action: (fermer, el) => {
          const champs = lire(el);
          if (!champs) return false;
          if (test) { S.modifier("testsBlancs", test.id, champs); ui.toast("Test modifié"); }
          else { S.ajouter("testsBlancs", champs); ui.toast("Test enregistré : " + fmtScore(ex)(st.scoreTest(champs))); }
          P.app.rafraichir();
        } }
      ]
    });
  }

  function supprimer(id) {
    const t = S.trouver("testsBlancs", id);
    if (!t) return;
    ui.confirmer("Le test du " + u.jourLong(t.jour) + (t.source ? " (" + t.source + ")" : "") + " sera supprimé.", { titre: "Supprimer le test blanc ?", ok: "Supprimer", danger: true })
      .then(ok => {
        if (!ok) return;
        S.supprimer("testsBlancs", id);
        ui.toast("Test supprimé");
        P.app.rafraichir();
      });
  }

  P.vues.tests = {
    rendre: rendre,
    monter: function (el, r) {
      dessinerCourbe(el, r.examen);
      dessinerSections(el, r.examen);
      el.addEventListener("click", ev => {
        const b = ev.target.closest("[data-action]");
        if (!b) return;
        const a = b.dataset.action, id = b.dataset.id;
        if (a === "ajouter") ouvrirForm(r.examen, null);
        else if (a === "modifier") ouvrirForm(r.examen, S.trouver("testsBlancs", id));
        else if (a === "supprimer") supprimer(id);
      });
    }
  };
})(window.Prepa = window.Prepa || {});
