/* ==========================================================================
   vues/accueil.js — le tableau de bord : une carte par examen, le bouton
   « Lancer une séance », les erreurs à refaire aujourd'hui et le rappel d'export.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, st = P.stats, ui = P.ui;
  P.vues = P.vues || {};

  // Rappel discret si aucun export depuis plus de 7 jours (et qu'il y a des données à protéger).
  function rappelExport() {
    const a = S.appareil();
    const aDesDonnees = S.liste("seances").length + S.liste("erreurs").length + S.liste("testsBlancs").length > 0;
    if (!aDesDonnees) return null;
    if (!a.dernierExport) {
      const depuis = a.premierLancement ? (Date.now() - Date.parse(a.premierLancement)) / 86400000 : Infinity;
      return depuis > 7 ? "Tu n'as encore jamais exporté tes données. L'export est ta seule sauvegarde en dehors de ce navigateur." : null;
    }
    const jours = Math.floor((Date.now() - Date.parse(a.dernierExport)) / 86400000);
    return jours > 7 ? "Dernier export il y a " + jours + " jours. Pense à sauvegarder tes données." : null;
  }

  function carteExamen(ex) {
    const nom = P.PROGRAMME[ex].nom;
    const total = st.totalSec(ex);
    const objectif = st.objectifH(ex);
    const palier = st.prochainPalier(ex);
    const jours = st.joursAvantExamen(ex);
    const serie = st.series(ex);

    let palierTxt = "";
    if (palier !== null) palierTxt = "Prochain palier : <strong>" + u.nombre(palier) + " h</strong> (encore " + u.heuresReste(palier * 3600 - total) + " h)";
    else if (st.paliers(ex).length) palierTxt = "Tous les paliers sont franchis";

    let compte;
    if (jours === null) compte = { val: "-", lib: '<a href="#/parametres">Date d\'examen à définir</a>' };
    else if (jours > 0) compte = { val: jours, lib: u.accord(jours, "jour") + " avant l'examen" };
    else if (jours === 0) compte = { val: "J-0", lib: "C'est aujourd'hui" };
    else compte = { val: "-", lib: "Examen passé" };

    let serieLib = u.accord(serie.actuelle, "jour") + " de série";
    if (serie.actuelle && !serie.aujourdhuiValide) serieLib += ", à prolonger aujourd'hui";

    return '<section class="carte carte-examen">' +
      '<div class="carte-tete"><h2>' + nom + '</h2><a href="#/' + ex + '/progression">Progression</a></div>' +
      '<div class="carte-examen-corps">' + ui.anneau(st.pourcentage(ex), 104) +
      "<div>" +
      '<div class="gros-chiffre">' + u.heures(total) + " h " +
      (objectif ? '<span class="sur">/ ' + u.nombre(objectif) + " h</span>" : "") + "</div>" +
      (objectif ? "" : '<div class="ligne-info"><a href="#/parametres">Objectif d\'heures à définir</a></div>') +
      (palierTxt ? '<div class="ligne-info">' + palierTxt + "</div>" : "") +
      "</div></div>" +
      '<div class="mini-stats">' +
      '<div><span class="mini-val">' + compte.val + '</span><span class="mini-lib">' + compte.lib + "</span></div>" +
      '<div><span class="mini-val">' + serie.actuelle + '</span><span class="mini-lib">' + serieLib + "</span></div>" +
      "</div></section>";
  }

  // Carte « Aujourd'hui » : temps fait aujourd'hui / temps à faire pour tenir l'objectif, et bouton de lancement.
  function carteJour(t) {
    const exLancement = t ? t.examen : (S.appareil().dernierExamen || "sat");
    const enCours = ex => (t && t.examen === ex) ? P.timer.calcul(t).compte / 1000 : 0;
    const lignes = ["sat", "ielts"].map(ex => ({ ex: ex, obj: st.objectifDuJour(ex, enCours(ex)) })).filter(x => x.obj);
    let corps;
    if (!lignes.length) {
      corps = '<p class="aide">Règle la date de l\'examen et ton objectif d\'heures dans les <a href="#/parametres">Paramètres</a> pour voir ton objectif du jour.</p>';
    } else {
      corps = lignes.map(({ ex, obj }) => {
        const reste = obj.cibleSec - obj.faitSec;
        let msg = obj.cibleSec <= 0 ? "Objectif d'heures atteint" : reste > 30 ? "Plus que " + u.duree(reste) + " aujourd'hui" : "Objectif du jour atteint";
        if (lignes.length > 1) msg = P.PROGRAMME[ex].nom + " · " + msg;
        return '<div class="aujd-ligne">' + ui.anneau(obj.pct, lignes.length > 1 ? 72 : 88) +
          '<div><div class="aujd-valeur">' + u.duree(obj.faitSec) + ' <span class="sur">/ ' + u.duree(obj.cibleSec) + "</span></div>" +
          '<div class="ligne-info">' + msg + "</div></div></div>";
      }).join("");
    }
    return '<section class="carte carte-jour"><div class="carte-tete"><h2>Aujourd\'hui</h2><span class="item-meta">' + u.esc(u.jourLong(u.aujourdhui())) + "</span></div>" +
      corps +
      '<a class="btn btn-primaire btn-geant" href="#/' + exLancement + '/timer">' + P.icone(t ? "timer" : "play") + (t ? "Voir la séance en cours" : "Lancer une séance") + "</a></section>";
  }

  // Carte réduite pour un examen pas encore configuré (ni date ni objectif, aucune heure).
  function carteAConfigurer(ex) {
    return '<section class="carte carte-compacte"><div><h2>' + P.PROGRAMME[ex].nom + "</h2>" +
      '<p class="aide">Ajoute la date de l\'examen et ton objectif pour suivre ta progression.</p></div>' +
      '<a class="btn btn-petit" href="#/parametres">Configurer</a></section>';
  }
  const aConfigurer = ex => !u.estJour(S.d.parametres[ex].dateExamen) && !st.objectifH(ex) && st.totalSec(ex) === 0;


  // En-tête : « Bonsoir, <prénom> », série en cours, grand compte à rebours vers l'examen le plus proche.
  function entete() {
    const heure = new Date().getHours();
    const bonjour = heure >= 5 && heure < 18 ? "Bonjour" : "Bonsoir";
    const prenom = (S.d.parametres.prenom || "").trim();
    // Examen le plus proche dont la date est encore à venir
    const proches = ["sat", "ielts"].map(ex => ({ ex: ex, j: st.joursAvantExamen(ex) })).filter(x => x.j !== null && x.j >= 0).sort((a, b) => a.j - b.j);
    const ex = proches.length ? proches[0].ex : "sat";
    const serie = st.series(ex).actuelle;
    let h = '<h1 class="salut">' + bonjour + (prenom ? ",<br><b>" + u.esc(prenom) + "</b>" : "") + "</h1><div class=\"trait\"></div>";
    h += '<span class="puce-info"><i></i>' + (serie ? "Série de " + serie + " " + u.accord(serie, "jour") : "Lance ta série aujourd'hui") + "</span>";
    if (proches.length) {
      const p = proches[0];
      h += '<div class="compte-hero"><span class="n">' + p.j + '</span><span class="u">' + (p.j === 0 ? "C'est aujourd'hui :<br>" : u.accord(p.j, "jour") + " avant<br>") +
        "le " + P.PROGRAMME[p.ex].nom + " · " + u.esc(u.jourCourt(S.d.parametres[p.ex].dateExamen)) + "</span></div>";
    } else {
      h += '<p class="aide mt">Ajoute la date de ton examen dans les <a href="#/parametres">Paramètres</a> pour voir le compte à rebours.</p>';
    }
    return h;
  }

  // Deux grandes tuiles : heures de l'examen principal et erreurs à refaire.
  function tuiles() {
    const ex = S.appareil().dernierExamen || "sat";
    const objectif = st.objectifH(ex);
    const nSat = st.erreursARefaire("sat").length, nIelts = st.erreursARefaire("ielts").length;
    const exRefaire = nIelts > nSat ? "ielts" : "sat";
    const n = nSat + nIelts;
    const fleche = '<span class="fleche">' + P.icone("fleche") + "</span>";
    return '<div class="tuiles-accueil">' +
      '<a class="carte tuile-grande pleine" href="#/' + ex + '/progression"><span class="lib">Heures ' + P.PROGRAMME[ex].nom + "</span>" +
      '<span class="chiffre">' + u.heures(st.totalSec(ex)) + (objectif ? " <small>/ " + u.nombre(objectif) + " h</small>" : " <small>h</small>") + "</span>" + fleche + "</a>" +
      '<a class="carte tuile-grande" href="#/' + exRefaire + "/journal" + (n ? "/reprises" : "") + '"><span class="lib">À refaire aujourd\'hui</span>' +
      '<span class="chiffre">' + n + " <small>" + u.accord(n, "erreur") + "</small></span>" + fleche + "</a>" +
      "</div>";
  }

  /* ---------- Checklist du jour J (les 7 derniers jours avant l'examen) ---------- */

  let editionJJ = null; // examen dont la checklist est en mode modification

  const examensJJ = () => ["sat", "ielts"].filter(ex => { const j = st.joursAvantExamen(ex); return j !== null && j >= 0 && j <= 7; });

  function compteJJ(ex) {
    const l = S.liste("checklist", ex);
    return { faits: l.filter(x => x.fait).length, total: l.length };
  }

  function carteJourJ(ex) {
    const j = st.joursAvantExamen(ex);
    const nom = P.PROGRAMME[ex].nom;
    const quand = j === 0 ? "C'est aujourd'hui" : j === 1 ? "Demain" : "Dans " + j + " jours";
    const edition = editionJJ === ex;
    const items = S.liste("checklist", ex).sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
    const c = compteJJ(ex);
    // Le jour même, le matin passe en premier.
    const moments = j === 0 ? [["matin", "Le matin"], ["veille", "La veille"]] : [["veille", "La veille"], ["matin", "Le matin"]];
    let h = '<section class="carte carte-jj" data-jj="' + ex + '">' +
      '<div class="carte-tete"><h2>Jour J · ' + nom + '</h2><span class="puce-info"><i></i>' + quand + "</span></div>" +
      '<div class="jj-progres"><div class="barre"><i data-jj-barre style="width:' + (c.total ? (c.faits / c.total) * 100 : 0).toFixed(1) + '%"></i></div>' +
      '<span data-jj-compte>' + c.faits + " / " + c.total + "</span></div>";
    moments.forEach(([m, titre]) => {
      const liste = items.filter(x => x.moment === m);
      h += '<h3 class="sous-titre">' + titre + '</h3><ul class="jj-liste">';
      liste.forEach(x => {
        h += "<li>" + (edition
          ? '<span class="jj-texte">' + u.esc(x.texte) + '</span><button class="rond rond-petit" data-action="jj-retirer" data-id="' + x.id + '" aria-label="Retirer">' + P.icone("fermer") + "</button>"
          : '<label class="jj-item"><input type="checkbox" data-jj-coche="' + x.id + '"' + (x.fait ? " checked" : "") + '><span class="jj-case">' + P.icone("coche") + '</span><span class="jj-texte">' + u.esc(x.texte) + "</span></label>") +
          "</li>";
      });
      if (!liste.length && !edition) h += '<li class="aide">Rien pour l\'instant.</li>';
      h += "</ul>";
      if (edition) h += '<form class="jj-ajout" data-jj-ajout="' + m + '"><input name="texte" maxlength="120" autocomplete="off" placeholder="Ajouter un élément"><button class="btn btn-petit">Ajouter</button></form>';
    });
    h += '<div class="rangee-boutons mt">' +
      (edition ? '<button class="btn btn-petit btn-primaire" data-action="jj-fin">Terminé</button>'
        : '<button class="btn btn-petit" data-action="jj-modifier">Modifier la liste</button>' +
          (c.faits ? '<button class="btn btn-petit" data-action="jj-decocher">Tout décocher</button>' : "")) +
      "</div></section>";
    return h;
  }

  P.vues.accueil = {
    rendre: function () {
      const t = P.timer.e;
      let h = entete();
      if (S.alerte) h += '<div class="bandeau bandeau-danger">' + u.esc(S.alerte) + "</div>";
      const rappel = rappelExport();
      if (rappel) h += '<div class="bandeau"><span>' + u.esc(rappel) + '</span><button class="btn btn-petit" data-action="exporter">Exporter maintenant</button></div>';

      if (P.synchro.active() && P.synchro.etat === "expire") h += '<div class="bandeau"><span>Synchronisation Google Drive en pause (connexion expirée).</span><button class="btn btn-petit" data-action="synchro-connecter">Reconnecter</button></div>';
      // À J-1 et le jour même, la checklist passe avant tout le reste.
      const jj = examensJJ();
      const urgent = jj.filter(ex => st.joursAvantExamen(ex) <= 1);
      h += urgent.map(carteJourJ).join("");
      h += carteJour(t);
      h += tuiles();
      h += jj.filter(ex => urgent.indexOf(ex) === -1).map(carteJourJ).join("");
      h += '<div class="grille-cartes">' + ["sat", "ielts"].map(ex => (aConfigurer(ex) ? carteAConfigurer(ex) : carteExamen(ex))).join("") + "</div>";
      return h;
    },

    monter: function (el) {
      el.addEventListener("click", ev => {
        const b = ev.target.closest("[data-action]");
        if (b && b.dataset.action === "exporter") S.exporterAvecMessage();
        if (b && b.dataset.action === "synchro-connecter") P.synchro.connecter();
        // Checklist du jour J
        const carte = ev.target.closest("[data-jj]");
        if (!b || !carte) return;
        const ex = carte.dataset.jj, a = b.dataset.action;
        if (a === "jj-modifier") { editionJJ = ex; P.app.rafraichir(); }
        else if (a === "jj-fin") { editionJJ = null; P.app.rafraichir(); }
        else if (a === "jj-retirer") { S.supprimer("checklist", b.dataset.id); P.app.rafraichir(); }
        else if (a === "jj-decocher") {
          P.ui.confirmer("Toutes les cases de la checklist " + P.PROGRAMME[ex].nom + " seront décochées.", { titre: "Tout décocher ?", ok: "Décocher" }).then(ok => {
            if (!ok) return;
            S.liste("checklist", ex).filter(x => x.fait).forEach(x => S.modifier("checklist", x.id, { fait: false }));
            P.app.rafraichir();
          });
        }
      });
      // Cocher ou décocher : enregistré tout de suite, sans redessiner la page.
      el.addEventListener("change", ev => {
        const c = ev.target.closest("[data-jj-coche]");
        if (!c) return;
        S.modifier("checklist", c.dataset.jjCoche, { fait: c.checked });
        const carte = c.closest("[data-jj]"), n = compteJJ(carte.dataset.jj);
        carte.querySelector("[data-jj-compte]").textContent = n.faits + " / " + n.total;
        carte.querySelector("[data-jj-barre]").style.width = (n.total ? (n.faits / n.total) * 100 : 0).toFixed(1) + "%";
      });
      el.addEventListener("submit", ev => {
        const f = ev.target.closest("[data-jj-ajout]");
        if (!f) return;
        ev.preventDefault();
        const texte = f.texte.value.trim();
        if (!texte) return;
        const ex = f.closest("[data-jj]").dataset.jj;
        const ordre = S.liste("checklist", ex).reduce((m, x) => Math.max(m, x.ordre || 0), 0) + 1;
        S.ajouter("checklist", { examen: ex, moment: f.dataset.jjAjout, texte: texte, fait: false, ordre: ordre });
        P.app.rafraichir();
        const champ = document.querySelector('[data-jj="' + ex + '"] [data-jj-ajout="' + f.dataset.jjAjout + '"] input');
        if (champ) champ.focus();
      });
    }
  };
})(window.Prepa = window.Prepa || {});
