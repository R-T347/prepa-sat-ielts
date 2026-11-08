/* ==========================================================================
   ui.js — éléments d'interface réutilisables : messages brefs, fenêtres
   modales, confirmations, anneau de progression, menus en cascade
   (Section › Domaine › Compétence) et courbe d'évolution en SVG.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u;
  const ui = {};
  let compteurModales = 0;

  /* ---------- Message bref en bas de l'écran ---------- */

  ui.toast = function (message, duree) {
    const zone = document.getElementById("toasts");
    if (!zone) return;
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = message;
    zone.appendChild(t);
    setTimeout(() => { t.classList.add("sortie"); setTimeout(() => t.remove(), 350); }, duree || 2800);
  };

  /* ---------- Fenêtre modale ----------
     options : titre, html (contenu), boutons [{ texte, classe, action(fermer, el) }],
     auMontage(el, fermer), id (une seule fenêtre ouverte par id),
     fermable (false = la touche Échap ne ferme pas la fenêtre).
     Si l'action d'un bouton renvoie false, la fenêtre reste ouverte. */
  ui.modale = function (o) {
    if (o.id) {
      const ancienne = document.querySelector('.modale-fond[data-id="' + o.id + '"]');
      if (ancienne) ancienne.remove();
    }
    const n = ++compteurModales;
    const fond = document.createElement("div");
    fond.className = "modale-fond";
    if (o.id) fond.dataset.id = o.id;
    fond.innerHTML =
      '<div class="modale" role="dialog" aria-modal="true" aria-labelledby="modale-titre-' + n + '" tabindex="-1">' +
      '<h2 id="modale-titre-' + n + '">' + u.esc(o.titre) + "</h2>" +
      '<div class="modale-corps">' + (o.html || "") + "</div>" +
      '<div class="modale-boutons"></div></div>';

    const precedent = document.activeElement;
    function fermer() {
      fond.remove();
      ui.majBlocageDefilement();
      document.removeEventListener("keydown", clavier);
      if (precedent && precedent.isConnected && precedent.focus) { try { precedent.focus({ preventScroll: true }); } catch (e) { /* rien */ } }
    }
    function clavier(ev) {
      const toutes = document.querySelectorAll(".modale-fond");
      if (ev.key === "Escape" && o.fermable !== false && toutes[toutes.length - 1] === fond) fermer();
    }

    const zone = fond.querySelector(".modale-boutons");
    (o.boutons || []).forEach(b => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn " + (b.classe || "");
      btn.textContent = b.texte;
      btn.addEventListener("click", () => {
        const r = b.action ? b.action(fermer, fond) : undefined;
        if (r !== false) fermer();
      });
      zone.appendChild(btn);
    });

    document.body.appendChild(fond);
    ui.majBlocageDefilement();
    document.addEventListener("keydown", clavier);
    fond.querySelector(".modale").focus({ preventScroll: true });
    if (o.auMontage) o.auMontage(fond, fermer);
    return { el: fond, fermer: fermer };
  };

  // Tant qu'une fenêtre (ou la célébration d'un palier) est ouverte, la page derrière ne défile pas.
  /* Petite animation quand on coche une case : la case rebondit, une onde de la couleur
     d'accent s'élargit autour, la coche apparaît en tournant légèrement.
     Quand on décoche : un léger rétrécissement. Rien si le téléphone réduit les animations. */
  ui.calme = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  ui.animerCoche = function (boite, coche) {
    if (!boite || !boite.animate || ui.calme()) return;
    if (!coche) {
      boite.animate([{ transform: "scale(.86)" }, { transform: "scale(1)" }], { duration: 220, easing: "cubic-bezier(.2, .8, .3, 1)" });
      return;
    }
    const a = (getComputedStyle(document.documentElement).getPropertyValue("--accent") || "#ff7a3d").trim();
    const n = /^#[0-9a-f]{6}$/i.test(a) ? parseInt(a.slice(1), 16) : 0xff7a3d;
    const rvb = [n >> 16 & 255, n >> 8 & 255, n & 255].join(",");
    boite.animate([{ transform: "scale(.7)" }, { transform: "scale(1.14)", offset: .5 }, { transform: "scale(1)" }],
      { duration: 380, easing: "cubic-bezier(.3, .7, .3, 1)" });
    boite.animate([{ boxShadow: "0 0 0 0 rgba(" + rvb + ",.55)" }, { boxShadow: "0 0 0 11px rgba(" + rvb + ",0)" }],
      { duration: 520, easing: "ease-out" });
    const icone = boite.querySelector(".icone");
    if (icone) icone.animate([{ transform: "scale(0) rotate(-30deg)", opacity: 0 }, { transform: "scale(1) rotate(0)", opacity: 1 }],
      { duration: 320, delay: 80, easing: "cubic-bezier(.3, 1.6, .5, 1)", fill: "backwards" });
  };

  ui.majBlocageDefilement = function () {
    document.body.classList.toggle("modale-ouverte", !!document.querySelector(".modale-fond, .fete, .fin-seance"));
  };

  ui.modaleOuverte = id => !!document.querySelector('.modale-fond[data-id="' + id + '"]');

  // Demande de confirmation. Renvoie une promesse : true si l'utilisateur confirme.
  ui.confirmer = function (message, o) {
    o = o || {};
    return new Promise(resolve => {
      let reponse = false;
      const m = ui.modale({
        titre: o.titre || "Confirmer",
        html: "<p>" + u.esc(message) + "</p>" + (o.html || ""),
        boutons: [
          { texte: o.annuler || "Annuler" },
          { texte: o.ok || "Confirmer", classe: o.danger ? "btn-plein-danger" : "btn-primaire", action: (fermer, el) => {
            if (o.verifier && !o.verifier(el)) return false;
            reponse = true;
          } }
        ]
      });
      // Résout la promesse quand la fenêtre disparaît (bouton ou touche Échap).
      const obs = new MutationObserver(() => {
        if (!m.el.isConnected) { obs.disconnect(); resolve(reponse); }
      });
      obs.observe(document.body, { childList: true });
    });
  };

  /* ---------- Anneau de progression (SVG) ---------- */

  ui.anneau = function (pct, taille) {
    taille = taille || 112;
    const ep = Math.round(taille / 11);
    const r = (taille - ep) / 2;
    const c = 2 * Math.PI * r;
    const p = pct === null || pct === undefined ? 0 : Math.max(0, Math.min(100, pct));
    const centre = taille / 2;
    const texte = pct === null || pct === undefined ? "-" : Math.floor(pct) + " %";
    const aria = pct === null || pct === undefined ? "Objectif non défini" : Math.floor(pct) + " % de l'objectif";
    return '<svg class="anneau" width="' + taille + '" height="' + taille + '" viewBox="0 0 ' + taille + " " + taille + '" role="img" aria-label="' + aria + '">' +
      '<circle class="anneau-fond" cx="' + centre + '" cy="' + centre + '" r="' + r + '" fill="none" stroke-width="' + ep + '"/>' +
      (p > 0 ? '<circle class="anneau-val" cx="' + centre + '" cy="' + centre + '" r="' + r + '" fill="none" stroke-width="' + ep +
        '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (c * (1 - p / 100)).toFixed(2) +
        '" transform="rotate(-90 ' + centre + " " + centre + ')"/>' : "") +
      '<text class="anneau-texte" x="50%" y="50%" dominant-baseline="central" text-anchor="middle" style="font-size:' + Math.round(taille / 5.2) + 'px">' + texte + "</text></svg>";
  };

  /* ---------- Menus en cascade : Section › Domaine › Compétence ----------
     ui.cascadeHTML(examen, valeurs) produit le HTML ;
     ui.lierCascade(racine) branche les menus et renvoie { valeurs() }. */

  function options(liste, choisi, vide) {
    let h = '<option value="">' + u.esc(vide) + "</option>";
    let trouve = !choisi;
    liste.forEach(x => {
      const sel = x.id === choisi;
      if (sel) trouve = true;
      h += '<option value="' + u.esc(x.id) + '"' + (sel ? " selected" : "") + ">" + u.esc(x.nom) + "</option>";
    });
    // Un id qui n'existe plus dans programme.js reste visible au lieu d'être perdu.
    if (!trouve) h += '<option value="' + u.esc(choisi) + '" selected>Inconnu (' + u.esc(choisi) + ")</option>";
    return h;
  }

  ui.cascadeHTML = function (examen, v, o) {
    v = v || {};
    o = o || {};
    const vide = o.vide || "Non précisé";
    const pr = P.prog;
    return '<div class="cascade" data-cascade="' + examen + '" data-vide="' + u.esc(vide) + '">' +
      '<label class="champ"><span>Section</span><select data-niveau="section">' + options(pr.sections(examen), v.section, vide) + "</select></label>" +
      '<div class="grille-2">' +
      '<label class="champ"><span>Domaine</span><select data-niveau="domaine">' + options(pr.domaines(examen, v.section), v.domaine, vide) + "</select></label>" +
      '<label class="champ"><span>Compétence</span><select data-niveau="competence">' + options(pr.competences(examen, v.section, v.domaine), v.competence, vide) + "</select></label>" +
      "</div>" +
      (o.sansAide ? "" : '<p class="aide" data-aide></p>') +
      "</div>";
  };

  ui.lierCascade = function (racine) {
    const bloc = racine.matches && racine.matches("[data-cascade]") ? racine : racine.querySelector("[data-cascade]");
    const ex = bloc.dataset.cascade;
    const vide = bloc.dataset.vide;
    const sS = bloc.querySelector('[data-niveau="section"]');
    const sD = bloc.querySelector('[data-niveau="domaine"]');
    const sC = bloc.querySelector('[data-niveau="competence"]');
    const aide = bloc.querySelector("[data-aide]");
    function etat() {
      sD.disabled = !sS.value;
      sC.disabled = !sD.value;
      if (aide) {
        const x = P.prog.competence(ex, sS.value, sD.value, sC.value) || P.prog.domaine(ex, sS.value, sD.value) || P.prog.section(ex, sS.value);
        aide.textContent = x && x.fr ? x.fr : "";
      }
    }
    sS.addEventListener("change", () => {
      sD.innerHTML = options(P.prog.domaines(ex, sS.value), "", vide);
      sC.innerHTML = options([], "", vide);
      etat();
    });
    sD.addEventListener("change", () => {
      sC.innerHTML = options(P.prog.competences(ex, sS.value, sD.value), "", vide);
      etat();
    });
    sC.addEventListener("change", etat);
    etat();
    return { valeurs: () => ({ section: sS.value || null, domaine: sD.value || null, competence: sC.value || null }) };
  };

  /* ---------- Courbe d'évolution (SVG dessiné à la main) ----------
     points : [{ jour, valeur, detail }] dans l'ordre chronologique.
     o : { min, max, pas, objectif, libObjectif, format(v) }.
     Une seule série : pas de légende, le titre de la carte la nomme. La dernière
     valeur est écrite sur le graphique ; les autres s'affichent au survol ou au toucher. */
  ui.courbe = function (conteneur, points, o) {
    const fmt = o.format || (v => String(v));
    const L = Math.max(280, Math.floor(conteneur.clientWidth || 600));
    const H = 230;
    const mg = { g: 46, d: 18, h: 22, b: 30 };
    const w = L - mg.g - mg.d, h = H - mg.h - mg.b;
    const n = points.length;
    const x = i => mg.g + (n === 1 ? w / 2 : (i * w) / (n - 1));
    const y = v => mg.h + h - ((v - o.min) / (o.max - o.min)) * h;

    let svg = '<svg viewBox="0 0 ' + L + " " + H + '" width="' + L + '" height="' + H + '" role="img" aria-label="' + u.esc(o.titre || "Évolution") + '">';
    // Grille horizontale discrète et graduations
    for (let v = o.min; v <= o.max + 1e-9; v += o.pas) {
      svg += '<line class="grille" x1="' + mg.g + '" x2="' + (L - mg.d) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      svg += '<text x="' + (mg.g - 8) + '" y="' + y(v) + '" text-anchor="end" dominant-baseline="central">' + u.esc(fmt(v)) + "</text>";
    }
    // Ligne d'objectif
    if (o.objectif !== null && o.objectif !== undefined && o.objectif >= o.min && o.objectif <= o.max) {
      const yo = y(o.objectif);
      svg += '<line class="objectif" x1="' + mg.g + '" x2="' + (L - mg.d) + '" y1="' + yo + '" y2="' + yo + '"/>';
      svg += '<text class="lib-objectif" x="' + (L - mg.d) + '" y="' + (yo - 6) + '" text-anchor="end">' + u.esc(o.libObjectif || "Objectif") + "</text>";
    }
    // Dates : première et dernière (sans chevauchement)
    if (n) {
      svg += '<text x="' + x(0) + '" y="' + (H - 8) + '" text-anchor="' + (n === 1 ? "middle" : "start") + '">' + u.esc(u.jourCourt(points[0].jour)) + "</text>";
      if (n > 1) svg += '<text x="' + x(n - 1) + '" y="' + (H - 8) + '" text-anchor="end">' + u.esc(u.jourCourt(points[n - 1].jour)) + "</text>";
    }
    // Ligne et points
    if (n > 1) svg += '<polyline class="ligne" points="' + points.map((p, i) => x(i).toFixed(1) + "," + y(p.valeur).toFixed(1)).join(" ") + '"/>';
    svg += '<line class="repere" x1="0" x2="0" y1="' + mg.h + '" y2="' + (mg.h + h) + '" visibility="hidden"/>';
    points.forEach((p, i) => { svg += '<circle class="point" cx="' + x(i) + '" cy="' + y(p.valeur) + '" r="5"/>'; });
    // Dernière valeur écrite à côté du point
    if (n) {
      const dx = x(n - 1), dy = y(points[n - 1].valeur);
      const ancre = n === 1 ? "middle" : "end";
      // Sous le point si l'étiquette chevaucherait celle de l'objectif ou sortirait par le haut.
      const aObjectif = o.objectif !== null && o.objectif !== undefined;
      const gene = (aObjectif && Math.abs(dy - y(o.objectif)) < 30) || dy - 12 < 12;
      svg += '<text class="val" x="' + (n === 1 ? dx : dx - 2) + '" y="' + (gene ? dy + 22 : dy - 12) + '" text-anchor="' + ancre + '">' + u.esc(fmt(points[n - 1].valeur)) + "</text>";
    }
    svg += '<rect class="zone-survol" x="' + mg.g + '" y="0" width="' + w + '" height="' + H + '" fill="transparent"/>';
    svg += "</svg>";

    conteneur.innerHTML = svg + '<div class="courbe-bulle" hidden></div>';

    // Survol / toucher : affiche la valeur du point le plus proche.
    const el = conteneur.querySelector("svg");
    const bulle = conteneur.querySelector(".courbe-bulle");
    const repere = conteneur.querySelector(".repere");
    const cercles = conteneur.querySelectorAll(".point");
    function montrer(ev) {
      if (!n) return;
      const r = el.getBoundingClientRect();
      const px = ((ev.clientX - r.left) / r.width) * L;
      let i = n === 1 ? 0 : Math.round(((px - mg.g) / w) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      const p = points[i];
      repere.setAttribute("x1", x(i));
      repere.setAttribute("x2", x(i));
      repere.setAttribute("visibility", "visible");
      cercles.forEach((c, k) => c.classList.toggle("actif", k === i));
      bulle.innerHTML = "<b>" + u.esc(fmt(p.valeur)) + "</b><span>" + u.esc(u.jourCourt(p.jour)) + (p.detail ? " · " + u.esc(p.detail) : "") + "</span>";
      bulle.hidden = false;
      const echelle = r.width / L;
      const gauche = x(i) * echelle;
      bulle.style.left = Math.max(0, Math.min(r.width - bulle.offsetWidth, gauche - bulle.offsetWidth / 2)) + "px";
      bulle.style.top = Math.max(0, y(p.valeur) * echelle - bulle.offsetHeight - 14) + "px";
    }
    function cacher() {
      bulle.hidden = true;
      repere.setAttribute("visibility", "hidden");
      cercles.forEach(c => c.classList.remove("actif"));
    }
    el.addEventListener("pointermove", montrer);
    el.addEventListener("pointerdown", montrer);
    el.addEventListener("pointerleave", cacher);
  };

  P.ui = ui;
})(window.Prepa = window.Prepa || {});
