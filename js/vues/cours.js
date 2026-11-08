/* ==========================================================================
   vues/cours.js — l'onglet Cours de l'espace SAT.
   Adresses :
     #/sat/cours                 sommaire (Reading and Writing, Math, Stratégie) et recherche
     #/sat/cours/d/<domaine>     un domaine : présentation et ses compétences
     #/sat/cours/c/<compétence>  une compétence : ta méthode en 7 étapes, puis le cours
     #/sat/cours/s/<page>        une page de stratégie (bilan, methode, ressources, conv-plus)
   Le texte vient de cours-sat.js, le découpage et la méthode de cours.js.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, C = P.cours;
  P.vues = P.vues || {};

  let recherche = ""; // gardée quand on revient au sommaire

  const lien = (h, txt) => '<a href="#/sat/cours' + h + '">' + txt + "</a>";
  const domaine = id => P.prog.sections("sat").reduce((r, s) => r || s.domaines.find(d => d.id === id), null);

  function ariane(morceaux) {
    return '<nav class="ariane" aria-label="Fil d\'Ariane">' + [lien("", "Cours")].concat(morceaux).join(' <span aria-hidden="true">›</span> ') + "</nav>";
  }

  function ligneCompetence(id) {
    const inf = C.infos(id), t = C.tempsQuestion(id);
    const n = C.etapeActuelle(id);
    return '<li><a class="cours-ligne" href="#/sat/cours/c/' + id + '">' +
      '<span class="cours-ligne-txt"><b>' + u.esc(inf.c.nom) + "</b>" + (inf.c.fr ? '<span class="aide">' + u.esc(inf.c.fr) + "</span>" : "") + "</span>" +
      '<span class="cours-ligne-meta"><span class="meth-mini' + (n >= 7 ? " fini" : n > 0 ? " encours" : "") + '">' + (n >= 7 ? P.icone("coche") : (n + 1) + "/7") + "</span>" +
      (t ? '<span class="aide">' + t + " s</span>" : "") + "</span>" +
      P.icone("fleche") + "</a></li>";
  }

  /* ---------- Sommaire ---------- */

  function sommaire() {
    const pages = C.pages();
    let h = '<label class="cours-recherche">' + P.icone("carnet") +
      '<input type="search" data-recherche placeholder="Chercher dans le cours (ex. FANBOYS, slope, transitions)" value="' + u.esc(recherche) + '" autocomplete="off" aria-label="Chercher dans le cours"></label>' +
      '<div data-resultats></div>';
    h += '<section class="carte carte-strat-tete"><div><h2>Ta méthode en 7 étapes</h2><p class="aide">Les mêmes étapes pour chaque compétence. Elles sont en haut de chaque page de cours, à cocher au fur et à mesure.</p></div>' +
      '<div class="rangee-boutons"><a class="btn btn-petit btn-primaire" href="#/sat/cours/s/methode">Voir la méthode</a><a class="btn btn-petit" href="#/sat/cours/s/bilan">Comment l\'utiliser</a></div></section>';
    P.prog.sections("sat").forEach(s => {
      const doms = s.domaines.filter(d => pages.dom[d.id]);
      if (!doms.length) return;
      h += '<section class="carte"><h2>' + u.esc(s.nom) + "</h2>";
      doms.forEach(d => {
        h += '<h3 class="cours-domaine">' + lien("/d/" + d.id, u.esc(d.nom)) + "</h3>" +
          '<ul class="cours-liste">' + d.competences.map(c => s.id + "." + d.id + "." + c.id).filter(id => pages.comp[id]).map(ligneCompetence).join("") + "</ul>";
      });
      h += "</section>";
    });
    h += '<section class="carte"><h2>Stratégie</h2><ul class="cours-liste">' +
      [["methode", "Ta méthode, compétence par compétence", "Les 7 étapes, le samedi, par où commencer"],
        ["bilan", "Comment utiliser ce cours", "Les domaines, le nombre de questions, les priorités"],
        ["conv-plus", "Grammaire : pour aller plus loin", "Tout ce que les 8 règles ne couvrent pas"],
        ["ressources", "Ressources", "Khan Academy, Question Bank, sources"]]
        .filter(([id]) => id === "conv-plus" ? pages.dom.conv && pages.dom.conv.extra.length : pages.strat[id])
        .map(([id, t, f]) => '<li><a class="cours-ligne" href="#/sat/cours/s/' + id + '"><span class="cours-ligne-txt"><b>' + t + '</b><span class="aide">' + f + "</span></span>" + P.icone("fleche") + "</a></li>").join("") +
      "</ul></section>";
    return h;
  }

  // Recherche dans tout le cours : titres et extraits autour du mot trouvé.
  function resultats(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) return "";
    const pages = C.pages(), res = [];
    Object.values(pages.comp).forEach(p => res.push({ h: "/c/" + p.id, t: C.infos(p.id).c.nom, x: C.texte(p) }));
    Object.values(pages.dom).forEach(p => res.push({ h: "/d/" + p.domaine, t: p.titre, x: C.texte(p) }));
    Object.values(pages.strat).forEach(p => res.push({ h: "/s/" + p.id, t: p.titre, x: C.texte(p) }));
    if (pages.dom.conv) pages.dom.conv.extra.forEach(p => res.push({ h: "/s/conv-plus", t: "Grammaire : pour aller plus loin", x: p.titre + " " + p.md }));
    const trouves = res.map(r => {
      const txt = r.x.replace(/\s+/g, " ");
      const i = txt.toLowerCase().indexOf(q);
      return i === -1 && r.t.toLowerCase().indexOf(q) === -1 ? null : Object.assign(r, { i: i, txt: txt });
    }).filter(Boolean);
    if (!trouves.length) return '<p class="vide">Rien trouvé pour « ' + u.esc(q) + " ».</p>";
    return '<ul class="cours-liste carte">' + trouves.slice(0, 20).map(r => {
      let extrait = "";
      if (r.i !== -1) {
        const a = Math.max(0, r.i - 50), b = Math.min(r.txt.length, r.i + q.length + 70);
        extrait = (a ? "…" : "") + u.esc(r.txt.slice(a, r.i)) + "<mark>" + u.esc(r.txt.slice(r.i, r.i + q.length)) + "</mark>" + u.esc(r.txt.slice(r.i + q.length, b)) + (b < r.txt.length ? "…" : "");
      }
      return '<li><a class="cours-ligne" href="#/sat/cours' + r.h + '"><span class="cours-ligne-txt"><b>' + u.esc(r.t) + "</b>" +
        (extrait ? '<span class="aide">' + extrait + "</span>" : "") + "</span>" + P.icone("fleche") + "</a></li>";
    }).join("") + "</ul>";
  }

  /* ---------- Pages ---------- */

  function blocsHTML(blocs) {
    return '<article class="carte cours-texte">' + blocs.map(b => (b.titre ? "<h2>" + u.esc(b.titre) + "</h2>" : "") + C.html(b.md)).join("") + "</article>";
  }

  function pageCompetence(id) {
    const p = C.pages().comp[id], inf = C.infos(id);
    if (!p || !inf) return '<p class="vide">Cette page de cours n\'existe pas.</p>' + sommaire();
    const t = C.tempsQuestion(id);
    const ordre = C.ordre(), i = ordre.indexOf(id);
    const voisin = (j, sens) => {
      const v = ordre[j];
      if (!v) return "<span></span>";
      return '<a class="cours-voisin ' + sens + '" href="#/sat/cours/c/' + v + '"><span class="aide">' + (sens === "prec" ? "Précédente" : "Suivante") + "</span><b>" + u.esc(C.infos(v).c.nom) + "</b></a>";
    };
    return ariane([lien("/d/" + inf.d.id, u.esc(inf.d.nom))]) +
      '<header class="cours-entete"><h1>' + u.esc(inf.c.nom) + "</h1>" + (inf.c.fr ? '<p class="aide">' + u.esc(inf.c.fr) + "</p>" : "") +
      (t ? '<span class="puce-info"><i></i>' + t + " s par question</span>" : "") + "</header>" +
      C.carteHTML(id) +
      blocsHTML(p.blocs) +
      '<div class="rangee-boutons"><button type="button" class="btn" data-meth="timer" data-id="' + id + '">' + P.icone("play") + "Lancer une séance</button>" +
      '<button type="button" class="btn" data-meth="erreur" data-id="' + id + '">' + P.icone("plus") + "Noter une erreur</button></div>" +
      '<nav class="cours-voisins">' + voisin(i - 1, "prec") + voisin(i + 1, "suiv") + "</nav>";
  }

  function pageDomaine(did) {
    const p = C.pages().dom[did], d = domaine(did);
    if (!p || !d) return '<p class="vide">Ce domaine n\'existe pas.</p>' + sommaire();
    const ids = d.competences.map(c => p.section + "." + did + "." + c.id).filter(id => C.pages().comp[id]);
    return ariane([]) +
      '<header class="cours-entete"><h1>' + u.esc(d.nom) + "</h1>" + (d.fr ? '<p class="aide">' + u.esc(d.fr) + "</p>" : "") + "</header>" +
      (p.md ? '<article class="carte cours-texte">' + C.html(p.md) + "</article>" : "") +
      '<section class="carte"><h2>Les compétences</h2><ul class="cours-liste">' + ids.map(ligneCompetence).join("") + "</ul></section>" +
      (p.extra.length ? '<section class="carte"><ul class="cours-liste"><li><a class="cours-ligne" href="#/sat/cours/s/conv-plus"><span class="cours-ligne-txt"><b>Pour aller plus loin</b><span class="aide">Les détails de ton premier cours de grammaire</span></span>' + P.icone("fleche") + "</a></li></ul></section>" : "");
  }

  function pageStrategie(id) {
    const pages = C.pages();
    if (id === "conv-plus" && pages.dom.conv && pages.dom.conv.extra.length) {
      return ariane([lien("/d/conv", "Standard English Conventions")]) + '<header class="cours-entete"><h1>Grammaire : pour aller plus loin</h1></header>' +
        blocsHTML(pages.dom.conv.extra.map(x => ({ titre: x.titre, md: x.md })));
    }
    const p = pages.strat[id];
    if (!p) return '<p class="vide">Cette page n\'existe pas.</p>' + sommaire();
    let h = ariane([]) + '<header class="cours-entete"><h1>' + u.esc(p.titre) + "</h1></header>";
    if (id === "methode") {
      // Les 7 étapes en français, puis le texte d'origine du cours.
      h += '<section class="carte"><h2>Les 7 étapes</h2><ol class="meth-liste meth-lecture">' + C.ETAPES.map((e, i) =>
        '<li class="meth-etape"><div class="meth-tete"><span class="meth-num">' + (i + 1) + '</span><span class="meth-court">' + u.esc(e.court) + "</span></div>" +
        '<div class="meth-corps"><p>' + u.esc(e.long) + "</p></div></li>").join("") + "</ol>" +
        '<p class="aide">Environ deux tiers du temps pour les questions et leur correction, un tiers pour le cours. L\'étape 3 se saute en Algebra, Advanced Math et grammaire.</p></section>';
    }
    return h + blocsHTML(p.blocs);
  }

  P.vues.cours = {
    rendre: function (r) {
      const ch = r.chemin || [];
      if (ch[0] === "c" && ch[1]) return pageCompetence(ch[1]);
      if (ch[0] === "d" && ch[1]) return pageDomaine(ch[1]);
      if (ch[0] === "s" && ch[1]) return pageStrategie(ch[1]);
      return sommaire();
    },
    monter: function (el) {
      C.lier(el);
      const champ = el.querySelector("[data-recherche]");
      if (champ) {
        const zone = el.querySelector("[data-resultats]");
        const maj = () => { recherche = champ.value; zone.innerHTML = resultats(recherche); };
        champ.addEventListener("input", maj);
        if (recherche) maj();
      }
    }
  };
})(window.Prepa = window.Prepa || {});
