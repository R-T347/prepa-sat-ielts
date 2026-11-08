/* ==========================================================================
   fin-seance.js — l'écran plein qui s'ouvre quand on enregistre une séance :
   durée qui défile, anneau de l'objectif du jour qui se remplit, bilan
   (total, série, aujourd'hui), records battus, une phrase tirée des vrais
   chiffres, et trois boutons. Les séances de moins de 5 minutes n'y ont pas droit.
   Un palier franchi pendant la séance est fêté juste après la fermeture.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats;
  const F = {};
  F.DUREE_MIN = 300; // en secondes

  const calme = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Meilleures valeurs passées : séance la plus longue, meilleure journée, meilleure semaine.
  function records(ex) {
    const seances = S.liste("seances", ex);
    const parSemaine = new Map();
    let seance = 0;
    seances.forEach(s => {
      const sec = Number(s.dureeSec) || 0;
      seance = Math.max(seance, sec);
      const l = u.lundi(s.jour);
      parSemaine.set(l, (parSemaine.get(l) || 0) + sec);
    });
    let jour = 0;
    st.secondesParJour(ex).forEach(v => { jour = Math.max(jour, v); });
    let semaine = 0;
    parSemaine.forEach(v => { semaine = Math.max(semaine, v); });
    return { seance: seance, jour: jour, semaine: semaine };
  }

  // Photo des chiffres, à prendre juste avant d'enregistrer la séance.
  F.instantane = function (ex) {
    const auj = u.aujourdhui();
    return {
      total: st.totalSec(ex),
      objectif: st.objectifDuJour(ex, 0),
      aujourdhui: st.periodeSec(ex, auj, auj),
      serie: st.series(ex),
      records: records(ex)
    };
  };

  function joursActifs7(ex) {
    const auj = u.aujourdhui(), debut = u.ajouterJours(auj, -6);
    let n = 0;
    st.secondesParJour(ex).forEach((sec, j) => { if (sec > 0 && j >= debut && j <= auj) n++; });
    return n;
  }

  function phrase(ex, avant, apres) {
    const o = apres.objectif;
    if (o && avant.objectif && avant.objectif.pct < 100 && o.pct >= 100) return "Objectif du jour atteint. Ce que tu fais en plus, c'est de l'avance.";
    if (o && o.pct < 100) return "Encore " + u.duree(o.cibleSec - o.faitSec) + " pour finir la journée.";
    if (o) return "Objectif du jour déjà rempli : tu prends de l'avance.";
    const n = joursActifs7(ex);
    return n >= 2 ? n + " jours de révision sur les 7 derniers." : "Chaque séance compte.";
  }

  const R = 62, CIRC = 2 * Math.PI * R;
  const offset = pct => (CIRC * (1 - Math.max(0, Math.min(100, pct)) / 100)).toFixed(2);

  F.ouvrir = function (ex, avant, seance) {
    const apres = F.instantane(ex);
    const nom = P.PROGRAMME[ex].nom;
    const sec = Number(seance.dureeSec) || 0;
    const chemin = P.prog.chemin(seance) || "Sujet libre";

    // Anneau de l'objectif du jour
    const o = apres.objectif;
    const pctAvant = avant.objectif ? avant.objectif.pct : 0;
    const anneau = o
      ? '<div class="fin-anneau' + (o.pct >= 100 ? " plein" : "") + '"><svg viewBox="0 0 140 140" aria-hidden="true">' +
        '<circle class="fin-anneau-fond" cx="70" cy="70" r="' + R + '"/>' +
        '<circle class="fin-anneau-val" data-fin-anneau cx="70" cy="70" r="' + R + '" stroke-dasharray="' + CIRC.toFixed(2) + '" stroke-dashoffset="' + offset(pctAvant) + '" transform="rotate(-90 70 70)"/>' +
        '</svg><div class="fin-anneau-centre"><b data-fin-pct>' + Math.floor(pctAvant) + ' %</b><span>du jour</span></div></div>'
      : "";

    // Bilan
    const serie = apres.serie.actuelle;
    const recordSerie = serie > avant.serie.record && avant.serie.record > 0;
    const bilan = '<ul class="fin-bilan">' +
      "<li>" + P.icone("timer") + "<span>Total " + nom + "</span><b>" + u.heures(apres.total) + " h</b><small>+" + u.duree(sec) + "</small></li>" +
      "<li>" + P.icone("flamme") + "<span>Série</span><b>" + serie + " " + u.accord(serie, "jour") + "</b>" + (recordSerie ? "<small>record</small>" : "") + "</li>" +
      "<li>" + P.icone("soleil") + "<span>Aujourd'hui</span><b>" + u.duree(apres.aujourdhui) + "</b></li>" +
      "</ul>";

    // Records battus (seulement s'il y avait déjà un record à battre)
    const battus = [];
    if (avant.records.seance > 0 && apres.records.seance > avant.records.seance) battus.push("Ta plus longue séance");
    if (avant.records.jour > 0 && apres.records.jour > avant.records.jour) battus.push("Ta meilleure journée");
    if (avant.records.semaine > 0 && apres.records.semaine > avant.records.semaine) battus.push("Ta meilleure semaine");
    const recordsHTML = battus.length
      ? '<div class="fin-records">' + battus.map(t => '<span class="fin-record">' + P.icone("valide") + t + "</span>").join("") + "</div>" : "";

    const jours = st.joursAvantExamen(ex);
    const compte = jours !== null && jours > 0 ? '<p class="fin-compte">Plus que ' + jours + " " + u.accord(jours, "jour") + " avant le " + nom + ".</p>" : "";

    const el = document.createElement("div");
    el.className = "fin-seance";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", "Séance enregistrée");
    el.innerHTML = '<div class="fin-contenu">' +
      '<span class="puce-info"><i></i>Séance enregistrée · ' + nom + "</span>" +
      '<div class="fin-duree" data-fin-duree>' + (calme() ? u.duree(sec) : "0 min") + "</div>" +
      '<p class="fin-chemin">' + u.esc(chemin) + "</p>" +
      anneau +
      '<p class="fin-phrase">' + u.esc(phrase(ex, avant, apres)) + "</p>" +
      bilan + recordsHTML + compte +
      '<div class="fin-boutons">' +
      '<button class="btn btn-primaire btn-geant" data-fin="accueil">Retour à l\'accueil</button>' +
      '<button class="btn btn-geant" data-fin="relancer">' + P.icone("play") + "Relancer une séance</button>" +
      '<button class="btn btn-lien-fort" data-fin="erreur">' + P.icone("plus") + "Noter une erreur</button>" +
      "</div></div>";
    document.body.appendChild(el);
    P.ui.majBlocageDefilement();

    // Animations : la durée défile, l'anneau se remplit.
    if (!calme()) {
      const champ = el.querySelector("[data-fin-duree]");
      const pctEl = el.querySelector("[data-fin-pct]");
      const t0 = performance.now(), duree = 1200;
      const pas = t => {
        const k = Math.min(1, (t - t0) / duree), e = 1 - Math.pow(1 - k, 3);
        champ.textContent = u.duree(Math.round((sec * e) / 60) * 60 || (k >= 1 ? sec : 0));
        if (pctEl && o) pctEl.textContent = Math.floor(pctAvant + (o.pct - pctAvant) * e) + " %";
        if (k < 1 && el.isConnected) requestAnimationFrame(pas);
        else champ.textContent = u.duree(sec);
      };
      requestAnimationFrame(pas);
    } else if (o) {
      el.querySelector("[data-fin-pct]").textContent = Math.floor(o.pct) + " %";
    }
    if (o) {
      const c = el.querySelector("[data-fin-anneau]");
      requestAnimationFrame(() => requestAnimationFrame(() => c.setAttribute("stroke-dashoffset", offset(o.pct))));
    }

    function fermer(apresFermeture) {
      document.removeEventListener("keydown", clavier);
      el.classList.add("sortie");
      setTimeout(() => {
        el.remove();
        P.ui.majBlocageDefilement();
        if (apresFermeture) apresFermeture();
        if (P.paliers) P.paliers.suivant(); // palier franchi pendant la séance
      }, 220);
    }
    function clavier(ev) { if (ev.key === "Escape") fermer(); }
    document.addEventListener("keydown", clavier);
    el.addEventListener("click", ev => {
      const b = ev.target.closest("[data-fin]");
      if (!b) return;
      const a = b.dataset.fin;
      if (a === "accueil") fermer(() => P.app.aller("#/"));
      else if (a === "relancer") fermer(() => P.app.aller("#/" + ex + "/timer"));
      else if (a === "erreur") fermer(() => P.vues.journal.ouvrirFormulaire(ex, null, { section: seance.section, domaine: seance.domaine, competence: seance.competence }));
    });
    el.querySelector('[data-fin="accueil"]').focus({ preventScroll: true });
  };

  F.ouverte = () => !!document.querySelector(".fin-seance");

  P.finSeance = F;
})(window.Prepa = window.Prepa || {});
