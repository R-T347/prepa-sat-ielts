/* ==========================================================================
   paliers.js — paliers d'heures (10, 25, 50… h) : badge et petite animation de
   célébration quand on en franchit un, UNE SEULE FOIS par palier.
   Les paliers déjà fêtés sont enregistrés dans la liste « paliersFetes », avec un
   identifiant fixe (ex. "sat-50") : la fusion téléphone/ordinateur ne les double pas,
   et un palier fêté sur un appareil ne l'est pas une deuxième fois sur l'autre.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats;
  const Pal = {};
  const file = []; // célébrations en attente (une à la fois)

  Pal.id = (examen, palier) => examen + "-" + palier;
  Pal.fete = (examen, palier) => S.trouver("paliersFetes", Pal.id(examen, palier));

  /* Vérifie les deux examens. Les paliers atteints et pas encore fêtés sont enregistrés ;
     seul le plus haut est célébré (si on en franchit plusieurs d'un coup, par exemple en
     réglant les heures faites avant l'appli, on ne fait pas défiler une série d'animations). */
  Pal.verifier = function () {
    if (S.lectureSeule) return;
    ["sat", "ielts"].forEach(examen => {
      const heures = st.totalSec(examen) / 3600;
      const nouveaux = st.paliers(examen).filter(p => p <= heures && !Pal.fete(examen, p));
      if (!nouveaux.length) return;
      nouveaux.forEach(p => S.definir("paliersFetes", Pal.id(examen, p), { examen: examen, heures: p, jour: u.aujourdhui() }));
      file.push({ examen: examen, palier: nouveaux[nouveaux.length - 1] });
    });
    Pal.suivant();
  };

  // Montre la prochaine célébration en attente, sauf si un écran de fête ou de fin de séance est déjà ouvert.
  Pal.suivant = function () {
    if (file.length && !document.querySelector(".fete, .fin-seance")) celebrer(file.shift());
  };

  function celebrer(c) {
    const nom = P.PROGRAMME[c.examen].nom;
    const prochain = st.prochainPalier(c.examen);
    const objectif = st.objectifH(c.examen);
    let suite = prochain !== null ? "Prochain palier : " + u.nombre(prochain) + " h." : "Tous les paliers sont franchis.";
    if (objectif && c.palier >= objectif) suite = "Objectif de " + u.nombre(objectif) + " h atteint.";

    const r = 52, circ = 2 * Math.PI * r;
    let eclats = "";
    for (let i = 0; i < 12; i++) eclats += '<span class="fete-eclat" style="--angle:' + (i * 30) + 'deg"></span>';

    const el = document.createElement("div");
    el.className = "fete";
    el.setAttribute("role", "status");
    el.innerHTML =
      '<div class="fete-carte">' +
      '<div class="fete-badge">' + eclats +
      '<svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">' +
      '<circle class="fete-fond" cx="60" cy="60" r="' + r + '"/>' +
      '<circle class="fete-anneau" cx="60" cy="60" r="' + r + '" style="stroke-dasharray:' + circ.toFixed(1) + ";--circ:" + circ.toFixed(1) + '" transform="rotate(-90 60 60)"/>' +
      '<text x="60" y="56" text-anchor="middle" class="fete-heures">' + u.nombre(c.palier) + '</text><text x="60" y="80" text-anchor="middle" class="fete-unite">heures</text>' +
      "</svg></div>" +
      '<p class="fete-titre">Palier franchi</p>' +
      "<p>" + u.nombre(c.palier) + " heures de révision " + nom + ". " + u.esc(suite) + "</p>" +
      '<button type="button" class="btn btn-primaire">Continuer</button>' +
      "</div>";
    document.body.appendChild(el);
    P.ui.majBlocageDefilement();

    function fermer() {
      el.classList.add("sortie");
      setTimeout(() => {
        el.remove();
        P.ui.majBlocageDefilement();
        Pal.suivant();
      }, 250);
    }
    el.querySelector("button").addEventListener("click", fermer);
    el.addEventListener("click", ev => { if (ev.target === el) fermer(); });
    el.querySelector("button").focus({ preventScroll: true });
  }

  P.paliers = Pal;
})(window.Prepa = window.Prepa || {});
