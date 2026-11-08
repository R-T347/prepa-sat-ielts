/* ==========================================================================
   vues/progression.js — l'onglet Progression.
   Heures cumulées et pourcentage, rythme nécessaire comparé au rythme réel,
   graphiques (heures par semaine, calendrier, répartition), séries de jours,
   paliers avec badges.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats, ui = P.ui;
  P.vues = P.vues || {};

  function carteHeures(ex) {
    const total = st.totalSec(ex);
    const objectif = st.objectifH(ex);
    const anterieures = st.heuresAnterieuresSec(ex);
    let lignes;
    if (!objectif) {
      lignes = '<div class="ligne-info">Objectif non défini · <a href="#/parametres">le régler</a></div>';
    } else {
      lignes = '<div class="ligne-info">sur un objectif de <strong>' + u.nombre(objectif) + " h</strong></div>" +
        '<div class="ligne-info">' + (total >= objectif * 3600 ? "<strong>Objectif atteint</strong>"
          : "Reste <strong>" + u.heuresReste(objectif * 3600 - total) + " h</strong>") + "</div>";
    }
    return '<section class="carte"><h2>Heures cumulées</h2>' +
      '<div class="prog-tete">' + ui.anneau(st.pourcentage(ex), 132) +
      '<div><div class="gros-chiffre">' + u.heures(total) + " h</div>" + lignes + "</div></div>" +
      (anterieures ? '<p class="aide mt">Dont ' + u.heures(anterieures) + " h faites avant l'appli (réglage dans les Paramètres).</p>" : "") +
      "</section>";
  }

  function carteRythme(ex) {
    const ry = st.rythme(ex);
    const jours = st.joursAvantExamen(ex);
    const objectif = st.objectifH(ex);
    const dateExamen = S.d.parametres[ex].dateExamen;

    let libNecessaire = "par semaine";
    if (!objectif) libNecessaire = '<a href="#/parametres">Objectif d\'heures à définir</a>';
    else if (jours === null) libNecessaire = '<a href="#/parametres">Date d\'examen à définir</a>';
    else if (jours <= 0) libNecessaire = "l'examen est passé ou a lieu aujourd'hui";
    else libNecessaire = "par semaine jusqu'au " + u.jourCourt(dateExamen) + " (" + jours + " " + u.accord(jours, "jour") + ")";

    let libReel = "aucune séance pour l'instant";
    if (ry.reel !== null) libReel = ry.jours >= 28 ? "par semaine, sur les 28 derniers jours" : "par semaine, depuis le " + u.jourCourt(ry.depuis);

    let verdict = "";
    if (ry.necessaire !== null) {
      if (ry.resteH === 0) {
        verdict = '<p class="verdict ok">Objectif d\'heures atteint.</p>';
      } else if (ry.reel === null) {
        verdict = '<p class="verdict">Pour atteindre l\'objectif à temps, il faut environ ' + u.duree((ry.necessaire / 7) * 3600) + " de révision par jour.</p>";
      } else {
        const manque = ry.necessaire - ry.reel;
        verdict = manque <= 0.05
          ? '<p class="verdict ok">Ton rythme actuel suffit pour atteindre l\'objectif à temps.</p>'
          : '<p class="verdict ko">Il te manque ' + u.nombre(manque) + " h par semaine, soit environ " + u.duree((manque / 7) * 3600) +
            " de plus par jour. Au total, il faut environ " + u.duree((ry.necessaire / 7) * 3600) + " par jour.</p>";
      }
    }

    return '<section class="carte"><h2>Rythme</h2><div class="duo">' +
      '<div><span class="mini-lib">Nécessaire</span><div class="gros-chiffre">' + (ry.necessaire !== null ? u.nombre(ry.necessaire) + " h" : "-") + "</div>" +
      '<span class="mini-lib">' + libNecessaire + "</span></div>" +
      '<div><span class="mini-lib">Réel</span><div class="gros-chiffre">' + (ry.reel !== null ? u.nombre(ry.reel) + " h" : "-") + "</div>" +
      '<span class="mini-lib">' + libReel + "</span></div>" +
      "</div>" + verdict + "</section>";
  }

  function carteRegularite(ex) {
    const se = st.series(ex);
    const auj = u.aujourdhui();
    const aujourdhui = st.periodeSec(ex, auj, auj);
    const semaine = st.periodeSec(ex, u.lundi(auj), auj);
    const seuil = Number(S.d.parametres.seuilSerieMin) || 0;
    return '<section class="carte"><h2>Régularité</h2><div class="duo">' +
      '<div><span class="mini-lib">Série actuelle</span><div class="gros-chiffre">' + se.actuelle + ' <span class="sur">' + u.accord(se.actuelle, "jour") + "</span></div></div>" +
      '<div><span class="mini-lib">Record</span><div class="gros-chiffre">' + se.record + ' <span class="sur">' + u.accord(se.record, "jour") + "</span></div></div>" +
      '<div><span class="mini-lib">Aujourd\'hui</span><div class="gros-chiffre">' + u.duree(aujourdhui) + "</div></div>" +
      '<div><span class="mini-lib">Cette semaine</span><div class="gros-chiffre">' + u.duree(semaine) + '</div><span class="mini-lib">depuis lundi</span></div>' +
      "</div>" +
      '<p class="aide mt">Un jour compte dans la série à partir de ' + seuil + " min de révision (réglable dans les Paramètres)." +
      (se.actuelle && !se.aujourdhuiValide ? " Révise aujourd'hui pour la prolonger." : "") + "</p></section>";
  }

  // Un badge par palier : plein quand il est atteint (avec la date), en pointillés pour le prochain.
  function cartePaliers(ex) {
    const paliers = st.paliers(ex);
    const total = st.totalSec(ex);
    const prochain = st.prochainPalier(ex);
    if (!paliers.length) return '<section class="carte"><h2>Paliers</h2><p class="aide">Aucun palier défini (Paramètres).</p></section>';
    return '<section class="carte"><h2>Paliers</h2><ul class="paliers">' +
      paliers.map(x => {
        const atteint = x * 3600 <= total;
        const estProchain = x === prochain;
        const fete = P.paliers.fete(ex, x);
        let lib = "à venir";
        if (atteint) lib = fete && fete.jour ? "le " + u.jourCourt(fete.jour) : "atteint";
        else if (estProchain) lib = "encore " + u.heuresReste(x * 3600 - total) + " h";
        return '<li class="' + (atteint ? "atteint" : estProchain ? "prochain" : "") + '">' +
          '<span class="medaille"><b>' + u.nombre(x) + "</b><small>h</small></span>" +
          "<span>" + lib + "</span></li>";
      }).join("") +
      "</ul></section>";
  }

  // Cartes des graphiques : remplies après l'affichage (leur taille dépend de la largeur de l'écran).
  function cartesGraphiques(ex) {
    return '<section class="carte"><h2>Heures par semaine</h2><div class="graphique" data-graph="semaines"></div>' +
      '<p class="aide">12 dernières semaines. Touche une barre pour voir le détail.</p></section>';
  }
  function carteCalendrier() {
    return '<section class="carte"><h2>Calendrier des révisions</h2><div class="graphique" data-graph="calendrier"></div></section>';
  }
  function carteRepartition(ex) {
    return '<section class="carte"><h2>Répartition des heures</h2>' + P.graphiques.repartitionHTML(ex) + "</section>";
  }

  P.vues.progression = {
    rendre: function (r) {
      const ex = r.examen;
      return carteHeures(ex) + carteRythme(ex) + cartesGraphiques(ex) + carteRegularite(ex) + carteCalendrier() +
        carteRepartition(ex) + cartePaliers(ex);
    },
    monter: function (el, r) {
      P.graphiques.semaines(el.querySelector('[data-graph="semaines"]'), r.examen);
      P.graphiques.calendrier(el.querySelector('[data-graph="calendrier"]'), r.examen);
    }
  };
})(window.Prepa = window.Prepa || {});
