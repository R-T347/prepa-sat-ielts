/* ==========================================================================
   cours.js — le cours SAT et la méthode en 7 étapes.
   - Découpe le texte de cours-sat.js en pages : une par compétence du
     programme (programme.js), une par domaine, plus les pages de stratégie.
   - Petit lecteur Markdown (titres, paragraphes, listes, tableaux, gras,
     italique, liens), sans bibliothèque externe.
   - La méthode : 7 étapes à cocher pour chaque compétence, enregistrées dans
     la liste « methode » (identifiant = chemin de la compétence, ex.
     "sat.rw.info.central"), donc synchronisées comme le reste.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store;
  const C = {};

  /* ---------- Correspondance entre le cours et le programme ---------- */

  // Titre de partie (##) du cours → [section, domaine] du programme.
  const DOMAINES = {
    "R&W — Information and Ideas": ["rw", "info"],
    "R&W — Craft and Structure": ["rw", "craft"],
    "R&W — Expression of Ideas": ["rw", "expr"],
    "R&W — Standard English Conventions": ["rw", "conv"],
    "Math — Algebra": ["math", "alg"],
    "Math — Advanced Math": ["math", "adv"],
    "Math — Problem-Solving and Data Analysis": ["math", "psda"],
    "Math — Geometry and Trigonometry": ["math", "geo"]
  };
  // Compétences dans l'ordre où le cours les présente (### 1., 2.…).
  const ORDRE = {
    info: ["central", "evid-text", "evid-quant", "infer"],
    craft: ["words", "structure", "cross"],
    expr: ["trans", "synth"],
    alg: ["lin-1var", "lin-2var", "lin-fn", "systemes", "inequations"],
    adv: ["equiv", "nonlin-eq", "nonlin-fn"],
    psda: ["ratios", "pourcentages", "donnees-1var", "donnees-2var", "probas", "echantillons", "etudes"],
    geo: ["aires", "angles", "trigo", "cercles"]
  };
  // Grammaire : les 8 règles se répartissent sur les deux compétences du programme.
  const REGLES = { 1: "bound", 2: "bound", 3: "bound", 4: "form", 5: "form", 6: "form", 7: "form", 8: "form" };
  // Domaines où le cours dit de sauter l'étape 3 (Khan Academy).
  const DOMAINES_FORTS = ["alg", "adv", "conv"];

  // Découpe le Markdown en parties (##) et sous-parties (###).
  function decouper(md) {
    const parties = [];
    let p = null, s = null;
    md.split("\n").forEach(l => {
      if (/^## /.test(l)) { p = { titre: l.slice(3).trim(), intro: [], sous: [] }; s = null; parties.push(p); return; }
      if (/^### /.test(l) && p) { s = { titre: l.slice(4).trim(), lignes: [] }; p.sous.push(s); return; }
      if (/^# /.test(l)) return;
      if (s) s.lignes.push(l); else if (p) p.intro.push(l);
    });
    return parties;
  }

  // Construit les pages. Résultat mis en cache.
  let pagesCache = null;
  C.pages = function () {
    if (pagesCache) return pagesCache;
    const parties = decouper(P.COURS_SAT_MD || "");
    const pages = { comp: {}, dom: {}, strat: {} };
    const texte = lignes => lignes.join("\n").trim();
    parties.forEach(p => {
      const dm = DOMAINES[p.titre];
      if (dm) {
        const [sec, dom] = dm;
        const page = { id: sec + "." + dom, section: sec, domaine: dom, titre: p.titre.replace(/^(R&W|Math) — /, ""), md: texte(p.intro), extra: [] };
        pages.dom[dom] = page;
        if (dom === "conv") {
          const pratique = p.sous.find(x => /^Practice/.test(x.titre));
          p.sous.forEach(x => {
            const m = /^Rule (\d)/.exec(x.titre);
            if (m) {
              const cid = REGLES[m[1]];
              const id = sec + "." + dom + "." + cid;
              pages.comp[id] = pages.comp[id] || { id: id, section: sec, domaine: dom, competence: cid, blocs: [] };
              pages.comp[id].blocs.push({ titre: x.titre, md: texte(x.lignes) });
            } else if (x !== pratique) {
              page.extra.push({ id: "conv-plus", titre: x.titre, md: texte(x.lignes) });
            }
          });
          if (pratique) ["bound", "form"].forEach(cid => {
            const c = pages.comp[sec + "." + dom + "." + cid];
            if (c) c.blocs.push({ titre: "Practice", md: texte(pratique.lignes) });
          });
        } else {
          (ORDRE[dom] || []).forEach((cid, i) => {
            const x = p.sous[i];
            if (!x) return;
            const id = sec + "." + dom + "." + cid;
            pages.comp[id] = { id: id, section: sec, domaine: dom, competence: cid, blocs: [{ titre: null, md: texte(x.lignes) }], titreCours: x.titre.replace(/^\d+\.\s*/, "") };
          });
        }
      } else if (/^How to use/.test(p.titre)) {
        pages.strat.bilan = { id: "bilan", titre: "Comment utiliser ce cours", blocs: [{ titre: null, md: texte(p.intro) }].concat(p.sous.filter(x => !/^Your method/.test(x.titre)).map(x => ({ titre: x.titre, md: texte(x.lignes) }))) };
        const meth = p.sous.find(x => /^Your method/.test(x.titre));
        if (meth) pages.strat.methode = { id: "methode", titre: "Ta méthode", blocs: [{ titre: meth.titre, md: texte(meth.lignes) }] };
      } else if (/^Resources/.test(p.titre)) {
        pages.strat.ressources = { id: "ressources", titre: "Ressources", blocs: [{ titre: null, md: texte(p.intro) }].concat(p.sous.map(x => ({ titre: x.titre, md: texte(x.lignes) }))) };
      }
    });
    pagesCache = pages;
    return pages;
  };

  // Ordre de lecture des compétences (pour « précédente / suivante »).
  C.ordre = function () {
    const l = [];
    P.prog.sections("sat").forEach(s => s.domaines.forEach(d => d.competences.forEach(c => {
      const id = s.id + "." + d.id + "." + c.id;
      if (C.pages().comp[id]) l.push(id);
    })));
    return l;
  };

  // Infos du programme pour une compétence : { s, d, c } ou null.
  C.infos = function (id) {
    const [sid, did, cid] = id.split(".");
    const s = P.prog.sections("sat").find(x => x.id === sid);
    const d = s && s.domaines.find(x => x.id === did);
    const c = d && d.competences.find(x => x.id === cid);
    return c ? { s: s, d: d, c: c } : null;
  };

  // Temps prévu par question, en secondes (tiré du cours ; à défaut, celui du domaine, puis 95 s en maths).
  C.tempsQuestion = function (id) {
    const p = C.pages().comp[id];
    const lire = md => {
      const m = /Time budget:\s*(\d+)(?:\s*to\s*(\d+))?\s*seconds/i.exec(md || "");
      return m ? Number(m[2] || m[1]) : null;
    };
    let t = p ? lire(p.blocs.map(b => b.md).join("\n")) : null;
    if (!t && p) {
      const dom = C.pages().dom[p.domaine];
      t = lire(Object.values(C.pages().comp).filter(x => x.domaine === p.domaine).map(x => x.blocs.map(b => b.md).join("\n")).join("\n") + (dom ? dom.md : ""));
    }
    if (!t && id.indexOf("math.") === 0) t = 95; // 35 min pour 22 questions
    return t;
  };

  /* ---------- Lecteur Markdown ---------- */

  function enLigne(t) {
    let h = u.esc(t);
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, txt, url) => '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + txt + "</a>");
    h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g, "$1<em>$2</em>");
    return h;
  }
  function cellules(l) { return l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(x => x.trim()); }

  C.html = function (md) {
    const lignes = (md || "").split("\n");
    let h = "", i = 0;
    while (i < lignes.length) {
      const l = lignes[i];
      if (!l.trim()) { i++; continue; }
      if (/^#{3,4} /.test(l)) { h += "<h3>" + enLigne(l.replace(/^#+ /, "")) + "</h3>"; i++; continue; }
      if (/^\|/.test(l)) {
        const t = [];
        while (i < lignes.length && /^\|/.test(lignes[i])) t.push(lignes[i++]);
        const tete = cellules(t[0]);
        const corps = t.slice(/^\|[\s:|-]+\|?$/.test(t[1] || "") ? 2 : 1);
        h += '<div class="cours-tableau"><table><thead><tr>' + tete.map(c => "<th>" + enLigne(c) + "</th>").join("") + "</tr></thead><tbody>" +
          corps.map(r => "<tr>" + cellules(r).map(c => "<td>" + enLigne(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>";
        continue;
      }
      if (/^- /.test(l)) {
        h += "<ul>";
        while (i < lignes.length && /^- /.test(lignes[i])) h += "<li>" + enLigne(lignes[i++].slice(2)) + "</li>";
        h += "</ul>";
        continue;
      }
      if (/^\d+\. /.test(l)) {
        h += "<ol>";
        while (i < lignes.length && /^\d+\. /.test(lignes[i])) h += "<li>" + enLigne(lignes[i++].replace(/^\d+\. /, "")) + "</li>";
        h += "</ol>";
        continue;
      }
      const para = [];
      while (i < lignes.length && lignes[i].trim() && !/^(#{3,4} |\||- |\d+\. )/.test(lignes[i])) para.push(lignes[i++]);
      h += "<p>" + enLigne(para.join(" ")) + "</p>";
    }
    return h;
  };

  // Texte brut d'une page, pour la recherche.
  C.texte = page => [page.titre || page.titreCours || ""].concat((page.blocs || []).map(b => (b.titre || "") + " " + b.md), [page.md || ""]).join(" ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*|#]/g, " ");

  /* ---------- La méthode en 7 étapes ---------- */

  C.ETAPES = [
    { court: "Lire la page de cours", long: "10 à 15 minutes. Puis ferme-la et écris la règle principale de mémoire, en deux lignes. Si tu n'y arrives pas, relis." },
    { court: "Une vidéo, seulement si un point reste flou", long: "YouTube ou les explications OnePrep, 15 minutes au maximum. Si tu as compris la page, saute cette étape.", facultative: true },
    { court: "Les bases sur Khan Academy", long: "Seulement sur tes compétences faibles : un exercice Medium depuis les liens « Practice ». Si tu en rates plus d'un ou deux, relis les pièges avant de continuer." },
    { court: "Une série de 10 questions Medium + Hard", long: "Sur la Question Bank ou OnePrep, l'un ou l'autre, jamais les deux : ce sont les mêmes questions. Chronomètre-toi avec le temps prévu. Marque chaque question où tu hésites, même si tu y réponds." },
    { court: "Refaire les questions marquées, sans chrono", long: "Avant de regarder les corrigés. Juste sans chrono mais faux avec = problème de rythme. Faux les deux fois = problème de méthode : relis la page." },
    { court: "Journal d'erreurs : 3 lignes par erreur", long: "Pourquoi la bonne réponse est prouvée, pourquoi la tienne t'a attiré, et le signal à repérer la prochaine fois (le nom du piège : « trop étroit », « sens inversé »…)." },
    { court: "La règle pour avancer : environ 8 sur 10", long: "8 sur 10 ou plus : compétence suivante. En dessous : relis tes lignes du journal et refais une série de 10 le lendemain." }
  ];

  const idMethode = id => "sat." + id;
  // Étape 3 à sauter dans les domaines où tu es déjà fort.
  C.sautee = (id, i) => i === 2 && DOMAINES_FORTS.indexOf(id.split(".")[1]) !== -1;

  C.etat = function (id) {
    const e = S.trouver("methode", idMethode(id));
    const faites = e && !e.supprimeLe && Array.isArray(e.faites) ? e.faites : [];
    return {
      faites: C.ETAPES.map((x, i) => !!faites[i]),
      series: e && !e.supprimeLe && Array.isArray(e.series) ? e.series : []
    };
  };
  function enregistrer(id, champs) { S.definir("methode", idMethode(id), Object.assign({ examen: "sat" }, champs)); }

  // Étape en cours : celle qui suit la dernière cochée (en sautant l'étape 3 si besoin). 7 = terminé.
  C.etapeActuelle = function (id) {
    const f = C.etat(id).faites;
    let der = -1;
    f.forEach((x, i) => { if (x) der = i; });
    let n = der + 1;
    while (n < 7 && C.sautee(id, n)) n++;
    return n;
  };
  C.resume = function (id) {
    const n = C.etapeActuelle(id);
    return n >= 7 ? "Méthode terminée" : "Étape " + (n + 1) + "/7";
  };

  C.basculer = function (id, i) {
    const e = C.etat(id);
    e.faites[i] = !e.faites[i];
    enregistrer(id, { faites: e.faites });
  };
  // Score de la série (étape 7). Renvoie true si la compétence est validée (8/10 ou plus).
  C.noterSerie = function (id, score) {
    const e = C.etat(id);
    const series = e.series.concat([{ jour: u.aujourdhui(), score: score }]).slice(-20);
    e.faites[6] = score >= 8; // sous 8/10, l'étape 7 reste à refaire
    enregistrer(id, { faites: e.faites, series: series });
    return score >= 8;
  };
  // Nouvelle série le lendemain : on garde les étapes 1 à 3, on recommence à l'étape 4.
  C.nouvelleSerie = function (id) {
    const e = C.etat(id);
    enregistrer(id, { faites: e.faites.map((x, i) => i < 3 ? x : false) });
  };
  C.recommencer = function (id) { enregistrer(id, { faites: [] }); };

  /* Carte de la méthode pour une compétence.
     opts.compacte : seulement l'étape en cours (timer) ; opts.lienCours : lien vers la page de cours. */
  C.carteHTML = function (id, opts) {
    opts = opts || {};
    const inf = C.infos(id);
    if (!inf) return "";
    const e = C.etat(id), n = C.etapeActuelle(id);
    const t = C.tempsQuestion(id);
    const derniere = e.series[e.series.length - 1];
    const etapeHTML = (x, i) => {
      const sautee = C.sautee(id, i), faite = e.faites[i], enCours = i === n;
      let plus = "";
      if (i === 3 && t) plus += '<p class="meth-info">10 questions × ' + t + " s ≈ " + Math.round(t * 10 / 60) + " min</p>" +
        '<button type="button" class="btn btn-petit" data-meth="timer" data-id="' + id + '">' + P.icone("play") + "Lancer le timer sur cette compétence</button>";
      if (i === 5) plus += '<button type="button" class="btn btn-petit" data-meth="erreur" data-id="' + id + '">' + P.icone("plus") + "Noter une erreur</button>";
      if (i === 6) {
        plus += '<form class="meth-score" data-meth-score="' + id + '"><label><span>Score de la série</span><input name="score" type="number" min="0" max="10" step="1" inputmode="numeric" placeholder="8"></label><span>/ 10</span><button class="btn btn-petit">Valider</button></form>';
        if (derniere) {
          const ok = derniere.score >= 8;
          plus += '<div class="meth-verdict' + (ok ? " ok" : "") + '"><strong>' + derniere.score + "/10 · " + u.esc(u.jourCourt(derniere.jour)) + "</strong> " +
            (ok ? "Compétence validée : passe à la suivante." : "Relis tes lignes du journal et refais une série de 10 demain.") + "</div>" +
            '<div class="rangee-boutons">' +
            (ok && P.etatCompetence && P.etatCompetence(idMethode(id)).maitrise < 3 ? '<button type="button" class="btn btn-petit btn-primaire" data-meth="maitrise" data-id="' + id + '">Marquer « Maîtrisé »</button>' : "") +
            (ok ? "" : '<button type="button" class="btn btn-petit" data-meth="nouvelle" data-id="' + id + '">Préparer la série de demain</button>') +
            "</div>";
          if (e.series.length > 1) plus += '<p class="meth-info">Séries : ' + e.series.map(s => s.score + "/10").join(" · ") + "</p>";
        }
      }
      return '<li class="meth-etape' + (faite ? " faite" : "") + (enCours ? " en-cours" : "") + (sautee ? " sautee" : "") + '">' +
        '<label class="meth-tete"><input type="checkbox" data-meth-coche="' + id + '" data-i="' + i + '"' + (faite ? " checked" : "") + ">" +
        '<span class="meth-num">' + (faite ? P.icone("coche") : i + 1) + "</span>" +
        '<span class="meth-court">' + u.esc(x.court) + (sautee ? ' <em class="meth-tag">à sauter ici</em>' : x.facultative ? ' <em class="meth-tag">facultative</em>' : "") + "</span></label>" +
        (enCours || !opts.compacte ? '<div class="meth-corps"' + (enCours || (i === 6 && n >= 7) ? "" : " hidden") + '><p>' + u.esc(x.long) + "</p>" + plus + "</div>" : "") +
        "</li>";
    };
    const nbFaites = e.faites.filter(Boolean).length + (C.sautee(id, 2) && !e.faites[2] ? 1 : 0);
    let h = '<section class="carte carte-methode" data-methode="' + id + '">' +
      '<div class="carte-tete"><h2>Ta méthode</h2><span class="puce-info"><i></i>' + C.resume(id) + "</span></div>" +
      '<div class="meth-points" aria-hidden="true">' + C.ETAPES.map((x, i) => '<i class="' + (e.faites[i] ? "faite" : i === n ? "en-cours" : C.sautee(id, i) ? "sautee" : "") + '"></i>').join("") + "</div>";
    if (opts.compacte) {
      h += '<p class="meth-competence">' + u.esc(inf.c.nom) + "</p>";
      h += n < 7 ? '<ol class="meth-liste">' + etapeHTML(C.ETAPES[n], n) + "</ol>" : '<p class="aide">Les 7 étapes sont faites pour cette compétence.</p>';
      h += '<div class="rangee-boutons mt-petit"><a class="btn btn-petit" href="#/sat/cours/c/' + id + '">' + P.icone("carnet") + "Lire le cours et les 7 étapes</a></div>";
    } else {
      h += '<ol class="meth-liste">' + C.ETAPES.map(etapeHTML).join("") + "</ol>" +
        (nbFaites ? '<button type="button" class="btn btn-lien" data-meth="recommencer" data-id="' + id + '">Tout décocher</button>' : "");
    }
    return h + "</section>";
  };

  // Branche les actions de la carte (à appeler une fois par vue, sur son conteneur).
  C.lier = function (el) {
    el.addEventListener("change", ev => {
      const c = ev.target.closest("[data-meth-coche]");
      if (!c) return;
      C.basculer(c.dataset.methCoche, Number(c.dataset.i));
      P.app.rafraichir();
      // La page est redessinée : on anime la case de la nouvelle page.
      const n = document.querySelector('[data-meth-coche="' + c.dataset.methCoche + '"][data-i="' + c.dataset.i + '"]');
      if (n) P.ui.animerCoche(n.nextElementSibling, n.checked);
    });
    el.addEventListener("submit", ev => {
      const f = ev.target.closest("[data-meth-score]");
      if (!f) return;
      ev.preventDefault();
      const n = u.lireNombre(f.score.value);
      if (n === null || !Number.isInteger(n) || n < 0 || n > 10) { P.ui.toast("Indique un score entier entre 0 et 10."); return; }
      const ok = C.noterSerie(f.dataset.methScore, n);
      P.ui.toast(ok ? "Série validée : " + n + "/10" : "Série enregistrée : " + n + "/10", 2500);
      P.app.rafraichir();
    });
    el.addEventListener("click", ev => {
      // Déplier ou replier le texte d'une étape en touchant son titre (sauf la case à cocher).
      const tete = ev.target.closest(".meth-tete");
      if (tete && !ev.target.closest("input") && ev.target.closest(".meth-court")) {
        ev.preventDefault();
        const corps = tete.parentNode.querySelector(".meth-corps");
        if (corps) corps.hidden = !corps.hidden;
        return;
      }
      const b = ev.target.closest("[data-meth]");
      if (!b) return;
      const id = b.dataset.id, inf = C.infos(id);
      const a = b.dataset.meth;
      if (a === "timer") C.lancerTimer(id);
      else if (a === "erreur") P.vues.journal.ouvrirFormulaire("sat", null, { section: inf.s.id, domaine: inf.d.id, competence: inf.c.id });
      else if (a === "maitrise") { S.definir("competences", idMethode(id), { maitrise: 3 }); P.ui.toast("Compétence marquée « Maîtrisé »"); P.app.rafraichir(); }
      else if (a === "nouvelle") { C.nouvelleSerie(id); P.ui.toast("Demain : reprends à l'étape 4"); P.app.rafraichir(); }
      else if (a === "recommencer") {
        P.ui.confirmer("Les 7 étapes de cette compétence seront décochées. Tes scores de séries restent enregistrés.", { titre: "Tout décocher ?", ok: "Décocher" })
          .then(ok => { if (ok) { C.recommencer(id); P.app.rafraichir(); } });
      }
    });
  };

  // Ouvre le timer SAT avec cette compétence déjà choisie (sauf si une séance tourne déjà).
  C.lancerTimer = function (id) {
    const inf = C.infos(id);
    if (!P.timer.e) {
      const a = S.appareil();
      const tous = Object.assign({}, a.derniers);
      tous.sat = Object.assign({}, tous.sat, { section: inf.s.id, domaine: inf.d.id, competence: inf.c.id });
      S.majAppareil({ derniers: tous, dernierExamen: "sat" });
    }
    P.app.aller("#/sat/timer");
  };

  P.cours = C;
})(window.Prepa = window.Prepa || {});
