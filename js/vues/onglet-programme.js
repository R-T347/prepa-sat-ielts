/* ==========================================================================
   vues/onglet-programme.js — l'onglet Programme.
   Le contenu (sections, domaines, compétences) vient de programme.js.
   Pour chaque compétence : niveau de maîtrise choisi (0 à 4), heures passées
   (calculées à partir des séances), nombre d'erreurs du journal, notes et liens.
   Chaque domaine affiche sa maîtrise moyenne.
   L'état d'une compétence est enregistré dans la liste « competences », avec pour
   identifiant le chemin complet : "sat.math.adv.nonlin-fn".
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, ui = P.ui;
  P.vues = P.vues || {};

  const NIVEAUX = ["Pas vu", "Découvert", "En cours", "Maîtrisé", "Automatique"];
  const ouverts = new Set(); // compétences dont le panneau « Notes et liens » est ouvert
  const domainesOuverts = new Set(); // domaines dépliés (repliés par défaut)

  P.NIVEAUX_MAITRISE = NIVEAUX;

  const idComp = (ex, s, d, c) => [ex, s, d, c].join(".");
  // État enregistré d'une compétence, complété par les valeurs par défaut.
  function etat(id) {
    const e = S.trouver("competences", id);
    return {
      maitrise: e && !e.supprimeLe ? (Number(e.maitrise) || 0) : 0,
      notes: e && !e.supprimeLe ? (e.notes || "") : "",
      liens: e && !e.supprimeLe && Array.isArray(e.liens) ? e.liens : []
    };
  }
  P.etatCompetence = etat;

  // Totaux d'heures et d'erreurs par section, domaine et compétence.
  function index(ex) {
    const heures = new Map(), erreurs = new Map(), actives = new Map();
    const plus = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
    const cles = o => {
      const k = [];
      if (o.section) { k.push(o.section); if (o.domaine) { k.push(o.section + "|" + o.domaine); if (o.competence) k.push(o.section + "|" + o.domaine + "|" + o.competence); } }
      return k;
    };
    S.liste("seances", ex).forEach(s => cles(s).forEach(k => plus(heures, k, s.dureeSec || 0)));
    S.liste("erreurs", ex).forEach(e => cles(e).forEach(k => { plus(erreurs, k, 1); if (!e.archivee) plus(actives, k, 1); }));
    return { heures: heures, erreurs: erreurs, actives: actives };
  }

  function metaTexte(ix, cle) {
    const h = ix.heures.get(cle) || 0;
    const n = ix.erreurs.get(cle) || 0;
    const a = ix.actives.get(cle) || 0;
    return (h ? u.duree(h) : "0 h") + " · " + n + " " + u.accord(n, "erreur") + (n ? " (" + a + " " + u.accord(a, "active") + ")" : "");
  }

  function competenceHTML(ex, s, d, c, ix) {
    const id = idComp(ex, s.id, d.id, c.id);
    const e = etat(id);
    const options = NIVEAUX.map((lib, n) => '<option value="' + n + '"' + (e.maitrise === n ? " selected" : "") + ">" + n + " · " + lib + "</option>").join("");
    const liens = e.liens.map((l, i) =>
      '<li><a href="' + u.esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + u.esc(l.nom || l.url) + "</a>" +
      '<button type="button" class="btn btn-lien danger" data-action="retirer-lien" data-id="' + id + '" data-i="' + i + '">Retirer</button></li>').join("");
    const resume = [e.notes ? "note" : "", e.liens.length ? e.liens.length + " " + u.accord(e.liens.length, "lien") : ""].filter(Boolean).join(", ");
    return '<li class="comp">' +
      '<div class="comp-ligne">' +
      '<div class="comp-nom"><b>' + u.esc(c.nom) + "</b>" + (c.fr ? '<span class="aide">' + u.esc(c.fr) + "</span>" : "") +
      '<span class="item-meta">' + metaTexte(ix, s.id + "|" + d.id + "|" + c.id) + "</span>" +
      (ex === "sat" && P.cours && P.cours.pages().comp[s.id + "." + d.id + "." + c.id]
        ? '<a class="comp-cours" href="#/sat/cours/c/' + s.id + "." + d.id + "." + c.id + '">' + P.icone("carnet") + "Cours · " + P.cours.resume(s.id + "." + d.id + "." + c.id) + "</a>" : "") +
      "</div>" +
      '<select class="comp-niveau niveau-' + e.maitrise + '" data-maitrise="' + id + '" aria-label="Maîtrise : ' + u.esc(c.nom) + '">' + options + "</select>" +
      "</div>" +
      '<details class="comp-details" data-details="' + id + '"' + (ouverts.has(id) ? " open" : "") + ">" +
      "<summary>Notes et liens" + (resume ? " <span>(" + resume + ")</span>" : "") + "</summary>" +
      '<label class="champ"><span>Notes</span><textarea rows="3" data-notes="' + id + '" placeholder="Méthode, pièges, formules…">' + u.esc(e.notes) + "</textarea></label>" +
      (liens ? '<ul class="liens">' + liens + "</ul>" : "") +
      '<div class="grille-2"><label class="champ"><span>Nom du lien</span><input data-lien-nom="' + id + '" autocomplete="off" placeholder="Ex. Vidéo Khan Academy"></label>' +
      '<label class="champ"><span>Adresse</span><input data-lien-url="' + id + '" type="url" inputmode="url" autocomplete="off" placeholder="https://…"></label></div>' +
      '<button type="button" class="btn btn-petit" data-action="ajouter-lien" data-id="' + id + '">Ajouter le lien</button>' +
      "</details></li>";
  }

  function rendre(r) {
    const ex = r.examen;
    const ix = index(ex);
    let h = '<p class="aide mb">Choisis ton niveau pour chaque compétence : 0 Pas vu · 1 Découvert · 2 En cours · 3 Maîtrisé · 4 Automatique. ' +
      "Les heures viennent du timer, les erreurs du journal.</p>";
    P.prog.sections(ex).forEach(s => {
      h += '<section class="carte"><div class="carte-tete"><h2>' + u.esc(s.nom) + '</h2><span class="item-meta">' + u.duree(ix.heures.get(s.id) || 0) + "</span></div>" +
        (s.fr ? '<p class="aide">' + u.esc(s.fr) + "</p>" : "");
      s.domaines.forEach(d => {
        const niveaux = d.competences.map(c => etat(idComp(ex, s.id, d.id, c.id)).maitrise);
        const moyenne = niveaux.length ? niveaux.reduce((a, b) => a + b, 0) / niveaux.length : 0;
        // Domaine repliable : le résumé (nom, maîtrise moyenne) reste visible, on déplie pour les compétences.
        const cleDomaine = ex + "." + s.id + "." + d.id;
        h += '<details class="domaine" data-domaine="' + cleDomaine + '"' + (domainesOuverts.has(cleDomaine) ? " open" : "") + "><summary>" +
          '<div class="domaine-tete"><div><h3>' + u.esc(d.nom) + "</h3>" + (d.fr ? '<p class="aide">' + u.esc(d.fr) + "</p>" : "") + "</div>" +
          '<div class="domaine-moy" title="Maîtrise moyenne"><b>' + u.nombre(Math.round(moyenne * 10) / 10) + "</b><span>/ 4</span></div></div>" +
          '<div class="jauge" role="img" aria-label="Maîtrise moyenne ' + u.nombre(Math.round(moyenne * 10) / 10) + ' sur 4"><i style="width:' + ((moyenne / 4) * 100).toFixed(1) + '%"></i></div>' +
          '<p class="item-meta">' + d.competences.length + " " + u.accord(d.competences.length, "compétence") + " · " + metaTexte(ix, s.id + "|" + d.id) + "</p>" +
          "</summary>" +
          '<ul class="liste">' + d.competences.map(c => competenceHTML(ex, s, d, c, ix)).join("") + "</ul></details>";
      });
      h += "</section>";
    });
    return h;
  }

  function monter(el) {
    el.addEventListener("change", ev => {
      const t = ev.target;
      if (t.dataset.maitrise) {
        const n = Number(t.value);
        S.definir("competences", t.dataset.maitrise, { maitrise: n });
        ui.toast("Maîtrise : " + n + " · " + NIVEAUX[n], 1500);
        P.app.rafraichir(); // met à jour la moyenne du domaine
      } else if (t.dataset.notes) {
        S.definir("competences", t.dataset.notes, { notes: t.value.trim() });
        ui.toast("Notes enregistrées", 1200);
      }
    });
    el.addEventListener("toggle", ev => {
      const d = ev.target;
      if (d.dataset && d.dataset.details) { if (d.open) ouverts.add(d.dataset.details); else ouverts.delete(d.dataset.details); }
      if (d.dataset && d.dataset.domaine) { if (d.open) domainesOuverts.add(d.dataset.domaine); else domainesOuverts.delete(d.dataset.domaine); }
    }, true);
    el.addEventListener("click", ev => {
      const b = ev.target.closest("[data-action]");
      if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.action === "ajouter-lien") {
        const nom = el.querySelector('[data-lien-nom="' + id + '"]').value.trim();
        const url = u.normaliserUrl(el.querySelector('[data-lien-url="' + id + '"]').value);
        if (!url) { ui.toast("Adresse invalide : elle doit commencer par https://", 3500); return; }
        S.definir("competences", id, { liens: etat(id).liens.concat([{ nom: nom || url, url: url }]) });
        ouverts.add(id);
        ui.toast("Lien ajouté", 1200);
        P.app.rafraichir();
      } else if (b.dataset.action === "retirer-lien") {
        const liens = etat(id).liens.slice();
        liens.splice(Number(b.dataset.i), 1);
        S.definir("competences", id, { liens: liens });
        P.app.rafraichir();
      }
    });
  }

  P.vues.programme = { rendre: rendre, monter: monter };
})(window.Prepa = window.Prepa || {});
