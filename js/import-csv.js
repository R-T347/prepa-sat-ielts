/* ==========================================================================
   import-csv.js — importe dans le journal d'erreurs un carnet tenu dans
   Google Sheets (Fichier › Télécharger › Valeurs séparées par des virgules .csv).

   Colonnes attendues, dans cet ordre :
     1 Date · 2 Source · 3 Section · 4 Compétence · 5 Domaine · 6 Réf. question ·
     7 Ma rép. → bonne · 8 Type d'erreur · 9 La règle · 10 Sec. · 11 Fini à temps ? ·
     12 À refaire le · 13 Refait juste ? · 14 Statut

   - La ligne de titres est reconnue et ignorée.
   - Section, domaine et compétence sont retrouvés dans programme.js d'après leur
     nom (anglais ou français, sans tenir compte des accents ni des majuscules).
     Un nom non reconnu n'est pas perdu : il est recopié dans la référence de la question.
   - Chaque ligne reçoit un identifiant calculé à partir de son contenu : importer
     deux fois le même fichier n'ajoute pas de doublons.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats, ui = P.ui;
  const simple = u.simplifier;
  const COLONNES = ["Date", "Source", "Section", "Compétence", "Domaine", "Réf. question", "Ma rép. → bonne", "Type d'erreur",
    "La règle", "Sec.", "Fini à temps ?", "À refaire le", "Refait juste ?", "Statut"];

  // Autres noms possibles, en plus de l'id, du nom officiel et de l'explication française.
  const ALIAS = {
    rw: ["rw", "r w", "reading writing", "reading", "writing", "english", "verbal", "lecture ecriture"],
    math: ["maths", "mathematiques", "mathematics"],
    strat: ["strategie", "strategy", "strategies"],
    info: ["information ideas", "info ideas"],
    craft: ["craft structure"],
    expr: ["expression ideas"],
    conv: ["sec", "conventions", "standard english", "grammar", "grammaire"],
    alg: ["algebre"],
    adv: ["advanced", "adv math", "algebre avancee"],
    psda: ["problem solving", "data analysis", "problem solving data analysis"],
    geo: ["geometry", "geometrie", "trigonometry", "geometry trigonometry", "geo trig"],
    listening: ["listen", "comprehension orale"],
    speaking: ["oral", "expression orale"]
  };

  /* ---------- Lecture du fichier CSV ---------- */

  // Découpe le texte en lignes et en cellules (gère les guillemets et les retours à la ligne dans une cellule).
  function lireCsv(texte) {
    texte = texte.replace(/^﻿/, "");
    const premiere = texte.split(/\r?\n/, 1)[0];
    const compte = c => premiere.split(c).length - 1;
    const sep = compte(";") > compte(",") ? ";" : compte("\t") > compte(",") ? "\t" : ",";
    const lignes = [];
    let ligne = [], cellule = "", entreGuillemets = false;
    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (entreGuillemets) {
        if (c === '"') {
          if (texte[i + 1] === '"') { cellule += '"'; i++; } else entreGuillemets = false;
        } else cellule += c;
      } else if (c === '"') entreGuillemets = true;
      else if (c === sep) { ligne.push(cellule); cellule = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texte[i + 1] === "\n") i++;
        ligne.push(cellule); lignes.push(ligne); ligne = []; cellule = "";
      } else cellule += c;
    }
    if (cellule !== "" || ligne.length) { ligne.push(cellule); lignes.push(ligne); }
    return lignes;
  }

  const MOIS = { janv: 1, janvier: 1, fevr: 2, fevrier: 2, mars: 3, avr: 4, avril: 4, mai: 5, juin: 6, juil: 7, juillet: 7, aout: 8,
    sept: 9, septembre: 9, oct: 10, octobre: 10, nov: 11, novembre: 11, dec: 12, decembre: 12 };

  // "2026-11-04", "04/11/2026", "4/11/26", "4 nov. 2026" → "2026-11-04" ; null si illisible.
  function lireDate(s) {
    s = (s || "").trim();
    let a, m, j, r;
    if ((r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) { a = +r[1]; m = +r[2]; j = +r[3]; }
    else if ((r = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(s))) { j = +r[1]; m = +r[2]; a = +r[3]; if (a < 100) a += 2000; }
    else if ((r = /^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/.exec(simple(s).replace(/(\d)\s*([a-z])/, "$1 $2")))) { j = +r[1]; m = MOIS[r[2]]; a = +r[3]; }
    else return null;
    if (!m || m > 12 || !j || j > 31) return null;
    const d = new Date(a, m - 1, j);
    return d.getMonth() === m - 1 ? u.jour(d) : null;
  }

  function lireOuiNon(s) {
    const t = simple(s);
    if (/^(oui|o|yes|y|true|vrai|x|1)\b/.test(t) || /[✓✔]/.test(s)) return true;
    if (/^(non|n|no|false|faux|0)\b/.test(t) || /[✗✘]/.test(s)) return false;
    return null;
  }

  // "1", "2 Mal lu", "Manque de temps"… → 1, 2 ou 3 ; null si non reconnu.
  function lireType(s) {
    const t = simple(s);
    const r = /^([123])\b/.exec(t);
    if (r) return +r[1];
    if (/notion|pas su|connais|cours/.test(t)) return 1;
    if (/temps|time|chrono/.test(t)) return 3;
    if (/\blu\b|lecture|inattention|etourderie|mal lu/.test(t)) return 2;
    return null;
  }

  // "B → D", "B -> D", "B => D" → ["B", "D"]
  function lireReponses(s) {
    const morceaux = (s || "").split(/\s*(?:→|->|=>|➜|➔)\s*/);
    return morceaux.length >= 2 ? [morceaux[0].trim(), morceaux.slice(1).join(" ").trim()] : [(s || "").trim(), ""];
  }

  /* ---------- Correspondance avec programme.js ---------- */

  function correspondance(liste, texte) {
    const t = simple(texte);
    if (!t) return null;
    const exacts = x => [x.id, x.nom, x.fr].concat(ALIAS[x.id] || []).map(simple).filter(Boolean);
    const exact = liste.find(x => exacts(x).indexOf(t) !== -1);
    if (exact) return exact;
    if (t.length < 4) return null;
    // Correspondance partielle, seulement si elle est unique (ex. « Nonlinear func » → Nonlinear functions).
    const partiels = liste.filter(x => [x.nom].concat(ALIAS[x.id] || []).map(simple).some(n => n.length >= 4 && (n.indexOf(t) !== -1 || t.indexOf(n) !== -1)));
    return partiels.length === 1 ? partiels[0] : null;
  }

  function resoudre(ex, txtSection, txtCompetence, txtDomaine) {
    const sections = P.prog.sections(ex);
    let s = correspondance(sections, txtSection), d = null, c = null;
    if (s) {
      d = correspondance(s.domaines, txtDomaine);
      const candidates = d ? d.competences : [].concat(...s.domaines.map(x => x.competences));
      c = correspondance(candidates, txtCompetence);
      if (c && !d) d = s.domaines.find(x => x.competences.indexOf(c) !== -1) || null;
    } else {
      // Section absente ou non reconnue : on cherche la compétence, puis le domaine, dans tout l'examen.
      const toutes = [];
      sections.forEach(sec => sec.domaines.forEach(dom => dom.competences.forEach(co => toutes.push({ id: co.id, nom: co.nom, fr: co.fr, s: sec, d: dom, c: co }))));
      const tc = correspondance(toutes, txtCompetence);
      if (tc) { s = tc.s; d = tc.d; c = tc.c; }
      else {
        const doms = [];
        sections.forEach(sec => sec.domaines.forEach(dom => doms.push({ id: dom.id, nom: dom.nom, fr: dom.fr, s: sec, d: dom })));
        const td = correspondance(doms, txtDomaine);
        if (td) { s = td.s; d = td.d; }
      }
    }
    const inconnus = [];
    if (txtSection && !s) inconnus.push("Section : " + txtSection);
    if (txtDomaine && !d) inconnus.push("Domaine : " + txtDomaine);
    if (txtCompetence && !c) inconnus.push("Compétence : " + txtCompetence);
    return { section: s ? s.id : null, domaine: d ? d.id : null, competence: c ? c.id : null, inconnus: inconnus };
  }

  // Empreinte d'une ligne (FNV-1a) : sert d'identifiant stable pour éviter les doublons.
  function empreinte(texte, graine) {
    let h = graine >>> 0;
    for (let i = 0; i < texte.length; i++) { h ^= texte.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  /* ---------- Analyse complète ---------- */

  function analyser(texte, ex) {
    const lignes = lireCsv(texte);
    const res = { erreurs: [], ignorees: [], sansCompetence: 0, sansType: 0, sansRegle: 0, dejaPresentes: 0, colonnesManquantes: false };
    let debut = 0;
    if (lignes.length && !lireDate(lignes[0][0]) && /date/.test(simple(lignes[0][0]))) debut = 1; // ligne de titres
    const nonVides = lignes.slice(debut).filter(l => l.some(x => x.trim() !== ""));
    if (nonVides.length && nonVides.filter(l => l.length >= 9).length < nonVides.length / 2) res.colonnesManquantes = true;
    const vus = new Set();

    for (let i = debut; i < lignes.length; i++) {
      const cols = lignes[i];
      const c = k => (cols[k] || "").trim();
      const numero = i + 1;
      if (!cols.some(x => x.trim() !== "")) continue;
      if (!c(5) && !c(6) && !c(8) && !c(3)) { res.ignorees.push({ numero: numero, raison: "ligne presque vide" }); continue; }
      const jour = lireDate(c(0));
      if (!jour) { res.ignorees.push({ numero: numero, raison: "date illisible" + (c(0) ? " (« " + c(0) + " »)" : "") }); continue; }

      const pos = resoudre(ex, c(2), c(3), c(4));
      const [maReponse, bonneReponse] = lireReponses(c(6));
      const type = lireType(c(7));
      const temps = u.lireNombre(c(9));
      const refaireLe = lireDate(c(11));
      const nbJuste = /^\d+/.test(c(12)) ? parseInt(c(12), 10) : (lireOuiNon(c(12)) ? 1 : 0);
      const archivee = /archiv|maitris|acquis|termine|done|clos/.test(simple(c(13))) || nbJuste >= 2;

      const id = "csv-" + empreinte([ex].concat(cols.slice(0, 9).map(x => x.trim())).join("|"), 2166136261) +
        empreinte([ex].concat(cols.slice(0, 9).map(x => x.trim())).join("|"), 0x9747b28c);
      if (vus.has(id)) { res.ignorees.push({ numero: numero, raison: "ligne en double dans le fichier" }); continue; }
      vus.add(id);
      if (S.trouver("erreurs", id)) { res.dejaPresentes++; continue; }

      if (pos.inconnus.length) res.sansCompetence++;
      if (!type) res.sansType++;
      if (!c(8)) res.sansRegle++;
      const ref = [c(5)].concat(pos.inconnus.map(x => "[" + x + "]")).filter(Boolean).join(" ");

      res.erreurs.push({
        id: id, jour: jour, source: c(1), examen: ex,
        section: pos.section, domaine: pos.domaine, competence: pos.competence,
        refQuestion: ref, maReponse: maReponse, bonneReponse: bonneReponse,
        typeErreur: type, regle: c(8),
        tempsSec: temps === null ? null : Math.round(temps),
        finiATemps: lireOuiNon(c(10)),
        aRefaireLe: refaireLe || st.premiereReprise(jour),
        justesDeSuite: archivee ? 2 : Math.min(1, nbJuste),
        archivee: archivee,
        reprises: []
      });
    }
    return res;
  }

  /* ---------- Fenêtre d'aperçu et import ---------- */

  function apercu(nomFichier, res, ex) {
    const n = res.erreurs.length;
    const types = { 1: "Notion pas sue", 2: "Mal lu", 3: "Manque de temps" };
    let html = "<p>Fichier « " + u.esc(nomFichier) + " » : <strong>" + n + " " + u.accord(n, "erreur") + "</strong> à ajouter au journal " + P.PROGRAMME[ex].nom + ".</p>";
    if (res.colonnesManquantes) {
      html += '<p class="bandeau bandeau-danger">La plupart des lignes ont moins de 9 colonnes. Vérifie que le fichier suit bien cet ordre : ' + COLONNES.join(", ") + ".</p>";
    }
    const notes = [];
    if (res.dejaPresentes) notes.push(res.dejaPresentes + " " + u.accord(res.dejaPresentes, "ligne déjà importée", "lignes déjà importées") + " : ignorée(s), sans doublon.");
    if (res.ignorees.length) notes.push(res.ignorees.length + " " + u.accord(res.ignorees.length, "ligne ignorée", "lignes ignorées") + " : " +
      res.ignorees.slice(0, 5).map(x => "ligne " + x.numero + ", " + x.raison).join(" ; ") + (res.ignorees.length > 5 ? "…" : "") + ".");
    if (res.sansCompetence) notes.push(res.sansCompetence + " " + u.accord(res.sansCompetence, "ligne") + " avec une section, un domaine ou une compétence non reconnus : le texte est recopié dans la référence de la question.");
    if (res.sansType) notes.push(res.sansType + " " + u.accord(res.sansType, "ligne") + " sans type d'erreur reconnu (1, 2 ou 3) : à compléter ensuite.");
    if (res.sansRegle) notes.push(res.sansRegle + " " + u.accord(res.sansRegle, "ligne") + " sans règle : à compléter ensuite.");
    if (notes.length) html += '<ul class="notes-import">' + notes.map(x => "<li>" + u.esc(x) + "</li>").join("") + "</ul>";
    if (n) {
      html += '<h3 class="sous-titre">Aperçu des premières lignes</h3><ul class="liste">' + res.erreurs.slice(0, 4).map(e =>
        '<li class="item"><div class="item-tete"><span class="item-meta">' + u.jourCourt(e.jour) + (e.source ? " · " + u.esc(e.source) : "") + "</span>" +
        '<span class="badge">' + (types[e.typeErreur] || "Type ?") + "</span></div>" +
        '<div class="item-chemin">' + u.esc(P.prog.chemin(e) || "Compétence non précisée") + "</div>" +
        (e.regle ? '<div class="item-note">' + u.esc(e.regle.length > 120 ? e.regle.slice(0, 120) + "…" : e.regle) + "</div>" : "") + "</li>").join("") + "</ul>";
    }
    ui.modale({
      titre: "Importer un carnet CSV",
      html: html,
      boutons: n ? [
        { texte: "Annuler" },
        { texte: "Importer " + n + " " + u.accord(n, "erreur"), classe: "btn-primaire", action: () => {
          S.ajouterPlusieurs("erreurs", res.erreurs);
          ui.toast(n + " " + u.accord(n, "erreur importée", "erreurs importées"), 3500);
          P.app.rafraichir();
        } }
      ] : [{ texte: "Fermer", classe: "btn-primaire" }]
    });
  }

  // Ouvre le sélecteur de fichier, puis l'aperçu.
  function choisir(ex) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv,text/plain";
    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      if (!f) return;
      const lecteur = new FileReader();
      lecteur.onload = () => apercu(f.name, analyser(String(lecteur.result), ex), ex);
      lecteur.onerror = () => ui.toast("Le fichier n'a pas pu être lu.");
      lecteur.readAsText(f, "utf-8");
    });
    input.click();
  }

  P.importCsv = { choisir: choisir, analyser: analyser, apercu: apercu, lireCsv: lireCsv, lireDate: lireDate, COLONNES: COLONNES };
})(window.Prepa = window.Prepa || {});
