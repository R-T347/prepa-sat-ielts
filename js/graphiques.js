/* ==========================================================================
   graphiques.js — les graphiques de l'onglet Progression, dessinés en SVG à la main
   (aucune bibliothèque) :
   - heures par semaine sur les 12 dernières semaines (barres) ;
   - calendrier type « heatmap » : une case par jour, plus foncée quand on a beaucoup révisé ;
   - répartition des heures par section et par domaine (barres horizontales).
   Chaque graphique affiche le détail au survol (ordinateur) ou au toucher (téléphone).
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats;
  const G = {};
  const NS = 'xmlns="http://www.w3.org/2000/svg"';

  // Graduation « ronde » d'un axe : renvoie { max, pas } avec au plus nbMax intervalles.
  G.echelle = function (valMax, nbMax) {
    nbMax = nbMax || 5;
    if (!(valMax > 0)) return { max: 5, pas: 1 };
    const pas = [0.5, 1, 2, 5, 10, 20, 25, 50, 100, 200, 500].find(p => valMax / p <= nbMax) || 1000;
    return { max: Math.ceil(valMax / pas) * pas, pas: pas };
  };

  // Barre aux coins supérieurs arrondis, posée sur la ligne de base.
  function barre(x, y, l, h, r) {
    r = Math.min(r, h, l / 2);
    return "M" + x + "," + (y + h) + "V" + (y + r) + "Q" + x + "," + y + " " + (x + r) + "," + y +
      "H" + (x + l - r) + "Q" + (x + l) + "," + y + " " + (x + l) + "," + (y + r) + "V" + (y + h) + "Z";
  }

  /* Bulle d'information : tout élément portant data-bulle="Titre|Détail" l'affiche
     au survol de la souris ou au toucher. */
  G.bulles = function (conteneur) {
    const bulle = document.createElement("div");
    bulle.className = "courbe-bulle";
    bulle.hidden = true;
    conteneur.appendChild(bulle);
    let actif = null;
    function cacher() {
      bulle.hidden = true;
      if (actif) actif.classList.remove("survol");
      actif = null;
    }
    function montrer(ev) {
      const cible = ev.target.closest ? ev.target.closest("[data-bulle]") : null;
      if (!cible || !conteneur.contains(cible)) { cacher(); return; }
      if (actif !== cible) {
        if (actif) actif.classList.remove("survol");
        actif = cible;
        cible.classList.add("survol");
        const morceaux = cible.getAttribute("data-bulle").split("|");
        bulle.innerHTML = "<b>" + u.esc(morceaux[0]) + "</b>" + (morceaux[1] ? "<span>" + u.esc(morceaux[1]) + "</span>" : "");
        bulle.hidden = false;
      }
      const rc = conteneur.getBoundingClientRect(), re = cible.getBoundingClientRect();
      const gauche = Math.max(0, Math.min(rc.width - bulle.offsetWidth, re.left + re.width / 2 - rc.left - bulle.offsetWidth / 2));
      let haut = re.top - rc.top - bulle.offsetHeight - 8;
      if (haut < 0) haut = re.bottom - rc.top + 8;
      bulle.style.left = gauche + "px";
      bulle.style.top = haut + "px";
    }
    conteneur.addEventListener("pointermove", montrer);
    conteneur.addEventListener("pointerdown", montrer);
    conteneur.addEventListener("pointerleave", cacher);
  };

  /* ---------- Heures par semaine (12 dernières semaines) ---------- */

  G.semaines = function (conteneur, examen) {
    const auj = u.aujourdhui();
    const lundiAuj = u.lundi(auj);
    const semaines = [];
    for (let i = 11; i >= 0; i--) {
      const lundi = u.ajouterJours(lundiAuj, -7 * i);
      semaines.push({ lundi: lundi, heures: st.periodeSec(examen, lundi, u.ajouterJours(lundi, 6)) / 3600 });
    }
    const reference = st.rythme(examen).necessaire; // heures par semaine nécessaires
    const ech = G.echelle(Math.max(reference || 0, ...semaines.map(s => s.heures)));

    const L = Math.max(280, Math.floor(conteneur.clientWidth || 600));
    const H = 220;
    const mg = { g: 40, d: 6, h: 24, b: 26 };
    const w = L - mg.g - mg.d, h = H - mg.h - mg.b;
    const col = w / 12;
    const ecart = Math.max(2, Math.round(col * 0.22));
    const y = v => mg.h + h - (v / ech.max) * h;

    let svg = "<svg " + NS + ' viewBox="0 0 ' + L + " " + H + '" width="' + L + '" height="' + H + '" role="img" aria-label="Heures de révision par semaine, 12 dernières semaines">';
    for (let v = 0; v <= ech.max + 1e-9; v += ech.pas) {
      svg += '<line class="' + (v === 0 ? "axe" : "grille") + '" x1="' + mg.g + '" x2="' + (L - mg.d) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>';
      svg += '<text x="' + (mg.g - 6) + '" y="' + y(v) + '" text-anchor="end" dominant-baseline="central">' + u.nombre(v) + " h</text>";
    }
    semaines.forEach((s, i) => {
      const x0 = mg.g + i * col;
      const hb = (s.heures / ech.max) * h;
      const enCours = i === 11;
      const fin = u.ajouterJours(s.lundi, 6);
      const bulle = u.duree(s.heures * 3600) + "|Semaine du " + u.jourCourt(s.lundi) + " au " + u.jourCourt(fin) + (enCours ? " (en cours)" : "");
      svg += '<g class="colonne" data-bulle="' + u.esc(bulle) + '">' +
        '<rect class="zone" x="' + x0 + '" y="' + mg.h + '" width="' + col + '" height="' + h + '" fill="transparent"/>' +
        (hb > 0 ? '<path class="barre-val" d="' + barre(x0 + ecart / 2, y(s.heures), col - ecart, hb, 4) + '"/>' : "") +
        "</g>";
    });
    // Rythme nécessaire : ligne de référence
    if (reference) {
      const yr = y(reference);
      svg += '<line class="objectif" x1="' + mg.g + '" x2="' + (L - mg.d) + '" y1="' + yr + '" y2="' + yr + '"/>';
    }
    // Valeur de la semaine en cours, écrite au-dessus de sa barre
    const der = semaines[11];
    const yv = y(der.heures) - 6;
    const gene = reference && Math.abs(yv - (y(reference) - 6)) < 16;
    svg += '<text class="val" x="' + (mg.g + 11.5 * col) + '" y="' + (gene ? Math.min(y(der.heures) + 16, mg.h + h - 4) : yv) + '" text-anchor="middle">' + u.nombre(Math.round(der.heures * 10) / 10) + "</text>";
    // Dates sous l'axe
    svg += '<text x="' + mg.g + '" y="' + (H - 7) + '" text-anchor="start">' + u.esc(u.jourCourt(semaines[0].lundi)) + "</text>";
    svg += '<text x="' + (mg.g + 6.5 * col) + '" y="' + (H - 7) + '" text-anchor="middle">' + u.esc(u.jourCourt(semaines[6].lundi)) + "</text>";
    svg += '<text x="' + (L - mg.d) + '" y="' + (H - 7) + '" text-anchor="end">cette semaine</text>';
    svg += "</svg>";

    conteneur.innerHTML = svg + (reference ? '<p class="legende-graph"><i></i>Rythme nécessaire : ' + u.nombre(reference) + " h par semaine</p>" : "");
    G.bulles(conteneur);
  };

  /* ---------- Calendrier (heatmap) ---------- */

  const SEUILS = [1, 2, 4]; // en heures : <1 h, 1–2 h, 2–4 h, 4 h et plus
  const niveau = sec => sec <= 0 ? 0 : sec < SEUILS[0] * 3600 ? 1 : sec < SEUILS[1] * 3600 ? 2 : sec < SEUILS[2] * 3600 ? 3 : 4;
  const fmtMoisLong = new Intl.DateTimeFormat("fr-FR", { month: "long" });
  const fmtMoisAnnee = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

  // Grille mois par mois, du 1er du mois en cours jusqu'au jour de l'examen.
  // Les mois déjà passés ne sont pas affichés : seule la période de révision qui reste compte.
  G.calendrier = function (conteneur, examen) {
    const parJour = st.secondesParJour(examen);
    const auj = u.aujourdhui();
    const dateEx = S.d.parametres[examen].dateExamen;
    const fin = u.estJour(dateEx) && dateEx >= auj && u.ecartJours(auj, dateEx) <= 366 ? dateEx : null;
    const nomEx = P.PROGRAMME[examen].nom;
    const premier = auj.slice(0, 8) + "01";
    const dernierMois = (fin || auj).slice(0, 7);
    let html = "", joursActifs = 0;
    for (let m = premier; m.slice(0, 7) <= dernierMois;) {
      const d = u.dateDuJour(m);
      const nbJours = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const titre = (d.getFullYear() === new Date().getFullYear() ? fmtMoisLong : fmtMoisAnnee).format(d);
      html += '<div class="cal-mois"><h3>' + u.esc(titre) + '</h3><div class="cal-grille">' +
        ["L", "M", "M", "J", "V", "S", "D"].map(j => '<span class="cal-entete">' + j + "</span>").join("");
      const decalage = (d.getDay() + 6) % 7;
      for (let i = 0; i < decalage; i++) html += "<span></span>";
      for (let n = 1; n <= nbJours; n++) {
        const jour = u.ajouterJours(m, n - 1);
        if (fin && jour > fin) break;
        let classe, bulle;
        if (jour === fin) {
          classe = "cal-jour cal-examen"; bulle = "Jour du " + nomEx + "|" + u.jourLong(jour);
        } else if (jour > auj) {
          classe = "cal-jour cal-futur"; bulle = "À venir|" + u.jourLong(jour);
        } else {
          const sec = parJour.get(jour) || 0;
          if (sec > 0) joursActifs++;
          classe = "cal-jour niv-" + niveau(sec) + (jour === auj ? " aujourdhui" : "");
          bulle = (sec > 0 ? u.duree(sec) : "Aucune révision") + "|" + u.jourLong(jour);
        }
        html += '<span class="' + classe + '" data-bulle="' + u.esc(bulle) + '">' + n + "</span>";
      }
      html += "</div></div>";
      m = u.ajouterJours(m, nbJours);
    }

    const legende = '<div class="legende-cal" aria-hidden="true">' +
      [["0", 0], ["moins d'1 h", 1], ["1 à 2 h", 2], ["2 à 4 h", 3], ["4 h et plus", 4]].map(([lib, n]) =>
        '<span><i class="niv-' + n + '"></i>' + lib + "</span>").join("") +
      (fin ? '<span><i class="cal-examen"></i>' + nomEx + "</span>" : "") + "</div>";
    const nbPasses = u.ecartJours(premier, auj) + 1;
    const reste = fin ? u.ecartJours(auj, fin) : null;
    conteneur.innerHTML = '<div class="cal-mois-liste">' + html + "</div>" + legende +
      '<p class="aide">' + joursActifs + " " + u.accord(joursActifs, "jour") + " de révision sur " + nbPasses + " depuis le 1er " + u.esc(fmtMoisLong.format(u.dateDuJour(premier))) +
      (reste ? ". Encore " + reste + " " + u.accord(reste, "jour") + " avant le " + nomEx + "." : ".") + "</p>";
    G.bulles(conteneur);
  };

  /* ---------- Répartition par section et par domaine ---------- */

  G.repartitionHTML = function (examen) {
    const seances = S.liste("seances", examen);
    const total = seances.reduce((a, s) => a + (s.dureeSec || 0), 0);
    if (!total) return '<p class="vide">Pas encore de séance pour calculer la répartition.</p>';
    const parSection = new Map(), parDomaine = new Map();
    const ajouter = (m, k, v) => m.set(k, (m.get(k) || 0) + v);
    seances.forEach(s => {
      const sec = s.dureeSec || 0;
      ajouter(parSection, s.section ? P.prog.chemin({ examen: examen, section: s.section }) : "Section non précisée", sec);
      if (s.domaine) ajouter(parDomaine, P.prog.chemin({ examen: examen, section: s.section, domaine: s.domaine }), sec);
      else ajouter(parDomaine, s.section ? P.prog.chemin({ examen: examen, section: s.section }) + " › domaine non précisé" : "Non précisé", sec);
    });
    const lignes = m => {
      const arr = Array.from(m).sort((a, b) => b[1] - a[1]);
      const max = arr[0][1];
      return arr.map(([lib, sec]) => '<div class="rep-ligne"><span>' + u.esc(lib) + "</span><b>" + u.duree(sec) + " · " + Math.round((sec / total) * 100) + " %</b>" +
        '<div class="barre"><i style="width:' + ((sec / max) * 100).toFixed(1) + '%"></i></div></div>').join("");
    };
    return '<h3 class="sous-titre">Par section</h3><div class="repartition">' + lignes(parSection) + "</div>" +
      '<h3 class="sous-titre">Par domaine</h3><div class="repartition">' + lignes(parDomaine) + "</div>" +
      (st.heuresAnterieuresSec(examen) ? '<p class="aide mt">Les heures faites avant l\'appli ne sont pas comptées ici : on ne sait pas sur quoi elles ont porté.</p>' : "");
  };

  P.graphiques = G;
})(window.Prepa = window.Prepa || {});
