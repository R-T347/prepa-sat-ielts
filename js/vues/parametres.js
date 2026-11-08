/* ==========================================================================
   vues/parametres.js — les Paramètres : thème, dates et objectifs des examens,
   paliers, variante IELTS, Pomodoro, son, seuil de série, sources d'erreurs,
   et gestion des données (export, import, copie de sécurité, réinitialisation).
   Chaque réglage est enregistré dès qu'il est modifié.
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u, S = P.store, T = P.timer, ui = P.ui;
  P.vues = P.vues || {};

  /* ---------- Petits constructeurs de champs ----------
     data-p = chemin du réglage dans les paramètres (ex. "sat.dateExamen")
     data-type = façon de lire et de vérifier la valeur saisie */

  function champ(lib, chemin, type, valeur, attrs, aide) {
    const v = valeur === null || valeur === undefined ? "" : valeur;
    const inputType = type === "jour" ? "date" : type === "paliers" ? "text" : "number";
    return '<label class="champ"><span>' + lib + "</span>" +
      '<input type="' + inputType + '" data-p="' + chemin + '" data-type="' + type + '" value="' + u.esc(v) + '" ' + (attrs || "") + ">" +
      (aide ? '<span class="aide">' + aide + "</span>" : "") + "</label>";
  }

  // Champ texte (ex. prénom), enregistré dans les paramètres.
  function champTexte(lib, chemin, valeur, attrs, aide) {
    return '<label class="champ"><span>' + lib + "</span>" +
      '<input type="text" data-p="' + chemin + '" data-type="texte" value="' + u.esc(valeur) + '" ' + (attrs || "") + ">" +
      (aide ? '<span class="aide">' + aide + "</span>" : "") + "</label>";
  }

  function selectBand(chemin, valeur) {
    let h = '<select data-p="' + chemin + '" data-type="band"><option value="">Non défini</option>';
    for (let b = 9; b >= 4; b -= 0.5) h += '<option value="' + b + '"' + (valeur === b ? " selected" : "") + ">" + u.nombre(b) + "</option>";
    return h + "</select>";
  }

  // Lit et vérifie une valeur. Renvoie undefined si elle est invalide.
  function lireValeur(c) {
    const type = c.dataset.type;
    const n = u.lireNombre(c.value);
    switch (type) {
      case "jour": return c.value === "" ? null : (u.estJour(c.value) ? c.value : undefined);
      case "objectif": return n === null ? null : (n > 0 && n <= 5000 ? n : undefined);
      case "heures0": return n === null ? 0 : (n >= 0 && n <= 5000 ? n : undefined);
      case "score-sat": return n === null ? null : (Number.isInteger(n) && n >= 400 && n <= 1600 && n % 10 === 0 ? n : undefined);
      case "band": return c.value === "" ? null : Number(c.value);
      case "entier": {
        const min = Number(c.dataset.min), max = Number(c.dataset.max);
        return n !== null && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
      }
      case "bool": return c.checked;
      case "choix": return c.value;
      case "texte": return c.value.trim().slice(0, 30);
      case "paliers": {
        const morceaux = c.value.split(/[;,\s]+/).filter(Boolean);
        const nombres = morceaux.map(u.lireNombre);
        if (nombres.some(x => x === null || x <= 0 || x > 5000)) return undefined;
        return Array.from(new Set(nombres)).sort((a, b) => a - b);
      }
      default: return undefined;
    }
  }

  const MESSAGES = {
    "jour": "Date invalide.",
    "objectif": "Indique un nombre d'heures positif, ou laisse vide.",
    "heures0": "Indique un nombre d'heures positif.",
    "score-sat": "Objectif SAT : entre 400 et 1600, par pas de 10.",
    "entier": "Valeur hors limites.",
    "paliers": "Paliers : des nombres d'heures positifs séparés par des virgules."
  };

  function definir(objet, chemin, valeur) {
    const cles = chemin.split(".");
    let o = objet;
    for (let i = 0; i < cles.length - 1; i++) o = o[cles[i]];
    o[cles[cles.length - 1]] = valeur;
  }

  /* ---------- Rendu ---------- */

  function rendre() {
    const p = S.d.parametres;
    const a = S.appareil();
    const theme = a.theme || "auto";
    let h = '<h1 class="titre-page">Paramètres</h1>';
    if (S.alerte) h += '<div class="bandeau bandeau-danger">' + u.esc(S.alerte) + "</div>";

    // Toi
    h += '<section class="carte"><h2>Toi</h2>' +
      champTexte("Ton prénom", "prenom", p.prenom || "", 'maxlength="30" autocomplete="given-name" placeholder="Ex. Sam"', "Pour l\'accueil : « Bonsoir, … ».") +
      "</section>";

    // Apparence
    const accent = a.accent || P.app.COULEURS[0][0];
    const photo = P.fond.photo();
    h += '<section class="carte"><h2>Apparence</h2><div class="segment" role="radiogroup" aria-label="Thème">' +
      [["auto", "Automatique"], ["clair", "Clair"], ["sombre", "Sombre"]].map(([v, l]) =>
        '<label><input type="radio" name="theme" value="' + v + '"' + (theme === v ? " checked" : "") + "><span>" + l + "</span></label>").join("") +
      '</div><p class="aide">« Automatique » suit le réglage clair ou sombre du système.</p>' +
      '<p class="legende mt">Couleur</p><div class="nuancier" role="radiogroup" aria-label="Couleur de l\'appli">' +
      P.app.COULEURS.map(([c, nom]) => '<label style="--c:' + c + '"><input type="radio" name="accent" value="' + c + '"' + (c === accent ? " checked" : "") +
        ' aria-label="' + nom + '"><span></span></label>').join("") + "</div>" +
      '<p class="legende mt">Fond</p>' +
      (photo
        ? '<div class="apercu-fond" style="background-image:url(' + photo + ')"></div>'
        : '<div class="vignettes" role="radiogroup" aria-label="Paysage du fond">' +
          P.fond.SCENES.concat(P.fond.MODES).map(([v, l]) => '<label class="vignette"><input type="radio" name="fondScene" value="' + v + '"' + (P.fond.choix() === v ? " checked" : "") + '>' +
            '<canvas data-vignette="' + v + '" aria-hidden="true"></canvas><span>' + l + "</span></label>").join("") + "</div>" +
          '<p class="aide">Paysages dessinés par l\'appli et teintés par ta couleur. « Selon l\'heure » : aube le matin, ciel clair l\'après-midi, coucher de soleil le soir, nuit étoilée tard. « Chaque jour » : un paysage différent chaque jour.</p>') +
      '<div class="rangee-boutons"><button class="btn" data-action="fond-photo">' + (photo ? "Changer de photo" : "Mettre ma photo") + "</button>" +
      (photo ? '<button class="btn" data-action="fond-retirer">Revenir aux paysages</button>' : "") + "</div>" +
      '<input type="file" accept="image/*" data-fond-fichier hidden>' +
      '<p class="legende mt">Animation du fond</p><div class="segment" role="radiogroup" aria-label="Animation du fond">' +
      [["partout", "Partout"], ["focus", "En focus"], ["jamais", "Jamais"]].map(([v, l]) =>
        '<label><input type="radio" name="fondAnime" value="' + v + '"' + (P.fond.modeAnimation() === v ? " checked" : "") + "><span>" + l + "</span></label>").join("") +
      '</div><p class="aide">Brume, étoiles, reflets : un mouvement lent et léger pour la batterie. En mode focus, la lumière se lève à mesure que tu avances vers ton objectif du jour. Coupé si ton téléphone est réglé pour réduire les animations.</p>' +
      '<p class="aide">Couleur et fond sont propres à cet appareil. Ta photo reste sur l\'appareil : elle n\'est ni exportée, ni synchronisée.</p></section>';

    // SAT
    h += '<section class="carte"><h2>SAT</h2>' +
      '<div class="grille-2">' +
      champ("Date de l'examen", "sat.dateExamen", "jour", p.sat.dateExamen) +
      champ("Objectif de score", "sat.objectifScore", "score-sat", p.sat.objectifScore, 'min="400" max="1600" step="10" inputmode="numeric"') +
      champ("Objectif d'heures", "sat.objectifHeures", "objectif", p.sat.objectifHeures, 'min="1" step="1" inputmode="decimal"') +
      champ("Heures faites avant l'appli", "sat.heuresAnterieures", "heures0", p.sat.heuresAnterieures, 'min="0" step="0.5" inputmode="decimal"') +
      "</div>" +
      champ("Paliers (heures)", "sat.paliers", "paliers", p.sat.paliers.join(", "), 'inputmode="numeric" autocomplete="off"', "Séparés par des virgules.") +
      "</section>";

    // IELTS
    h += '<section class="carte"><h2>IELTS</h2>' +
      '<div class="champ"><span class="legende">Version de l\'examen</span><div class="segment">' +
      [["academic", "Academic"], ["general", "General Training"]].map(([v, l]) =>
        '<label><input type="radio" name="variante" data-p="ielts.variante" data-type="choix" value="' + v + '"' + (p.ielts.variante === v ? " checked" : "") + "><span>" + l + "</span></label>").join("") +
      "</div></div>" +
      '<div class="grille-2">' +
      champ("Date de l'examen", "ielts.dateExamen", "jour", p.ielts.dateExamen) +
      '<label class="champ"><span>Objectif de band global</span>' + selectBand("ielts.objectifBand", p.ielts.objectifBand) + "</label>" +
      champ("Objectif d'heures", "ielts.objectifHeures", "objectif", p.ielts.objectifHeures, 'min="1" step="1" inputmode="decimal" placeholder="Non défini"') +
      champ("Heures faites avant l'appli", "ielts.heuresAnterieures", "heures0", p.ielts.heuresAnterieures, 'min="0" step="0.5" inputmode="decimal"') +
      "</div>" +
      champ("Paliers (heures)", "ielts.paliers", "paliers", p.ielts.paliers.join(", "), 'inputmode="numeric" autocomplete="off"', "Séparés par des virgules.") +
      "</section>";

    // Timer
    h += '<section class="carte"><h2>Timer</h2>' +
      '<div class="grille-2">' +
      champ("Pomodoro : travail (min)", "pomodoro.travailMin", "entier", p.pomodoro.travailMin, 'min="1" max="240" step="1" data-min="1" data-max="240" inputmode="numeric"') +
      champ("Pomodoro : pause (min)", "pomodoro.pauseMin", "entier", p.pomodoro.pauseMin, 'min="0" max="120" step="1" data-min="0" data-max="120" inputmode="numeric"') +
      "</div>" +
      '<div class="param-ligne"><div><strong>Signal sonore</strong><div class="aide">À chaque fin de phase Pomodoro, quand le navigateur le permet.</div></div>' +
      '<label class="interrupteur"><input type="checkbox" data-p="son" data-type="bool" aria-label="Signal sonore"' + (p.son ? " checked" : "") + "><span></span></label></div>" +
      '<div class="param-ligne"><span class="aide">Vérifie le volume de ton appareil.</span><button class="btn btn-petit" data-action="tester-son">Tester le son</button></div>' +
      '<div class="param-ligne"><div><strong>Respiration pendant les pauses</strong><div class="aide">Pendant une pause Pomodoro, un halo respire lentement : 4 s pour inspirer, 6 s pour expirer. Réglage propre à cet appareil.</div></div>' +
      '<label class="interrupteur"><input type="checkbox" data-appareil="respiration" aria-label="Respiration pendant les pauses"' + (a.respiration !== false ? " checked" : "") + "><span></span></label></div>" +
      '<div class="param-ligne"><div><strong>Écran allumé pendant une séance</strong><div class="aide">Le téléphone ne se met pas en veille tant que le timer tourne, si le navigateur le permet. Réglage propre à cet appareil.</div></div>' +
      '<label class="interrupteur"><input type="checkbox" data-appareil="ecranAllume" aria-label="Écran allumé pendant une séance"' + (a.ecranAllume !== false ? " checked" : "") + "><span></span></label></div>" +
      champ("Seuil d'un jour de série (min)", "seuilSerieMin", "entier", p.seuilSerieMin, 'min="0" max="600" step="1" data-min="0" data-max="600" inputmode="numeric"', "Un jour compte dans la série à partir de cette durée de révision.") +
      "</section>";

    // Journal
    h += '<section class="carte"><h2>Sources du journal d\'erreurs</h2><div class="puces">' +
      p.sourcesErreurs.map((s, i) => '<span class="puce">' + u.esc(s) +
        '<button type="button" data-action="retirer-source" data-i="' + i + '" aria-label="Retirer ' + u.esc(s) + '">×</button></span>').join("") +
      "</div>" +
      '<div class="ajout-ligne"><input data-nouvelle-source placeholder="Nouvelle source" maxlength="60" autocomplete="off"><button class="btn" data-action="ajouter-source">Ajouter</button></div>' +
      '<p class="aide">Retirer une source ne modifie pas les erreurs déjà saisies.</p></section>';

    // Vocabulaire IELTS
    h += '<section class="carte"><h2>Thèmes du vocabulaire (IELTS)</h2><div class="puces">' +
      p.themesVocabulaire.map((s, i) => '<span class="puce">' + u.esc(s) +
        '<button type="button" data-action="retirer-theme" data-i="' + i + '" aria-label="Retirer ' + u.esc(s) + '">×</button></span>').join("") +
      "</div>" +
      '<div class="ajout-ligne"><input data-nouveau-theme placeholder="Nouveau thème" maxlength="40" autocomplete="off"><button class="btn" data-action="ajouter-theme">Ajouter</button></div>' +
      '<p class="aide">Retirer un thème ne modifie pas les mots déjà saisis.</p></section>';

    // Installation sur le téléphone
    h += carteSynchro();
    h += carteInstallation();

    // Données
    const copie = S.copieSecurite();
    const dernierExport = a.dernierExport ? u.jourLong(u.jour(a.dernierExport)) + " à " + u.heureMin(Date.parse(a.dernierExport)) : "jamais";
    h += '<section class="carte"><h2>Mes données</h2>' +
      "<p>Dernier export depuis cet appareil : <strong>" + dernierExport + "</strong></p>" +
      '<div class="rangee-boutons"><button class="btn btn-primaire" data-action="exporter">Exporter mes données</button>' +
      '<button class="btn" data-action="importer">Importer un fichier</button></div>' +
      '<input type="file" accept=".json,application/json" data-fichier hidden>' +
      '<p class="aide">Tes données sont enregistrées dans ce navigateur, sur cet appareil seulement. Exporte-les régulièrement : le fichier est ta sauvegarde, et il permet de réunir les données du téléphone et de l\'ordinateur (Importer, puis Fusionner).</p>' +
      (copie ? '<div class="param-ligne mt"><div><strong>Copie de sécurité</strong><div class="aide">' + u.esc(copie.raison) + ", le " +
        u.jourCourt(u.jour(copie.date)) + " à " + u.heureMin(Date.parse(copie.date)) + '</div></div><button class="btn btn-petit" data-action="restaurer">Restaurer</button></div>' : "") +
      '<p class="aide mt">Espace utilisé : ' + S.tailleKo() + " Ko · schéma de données v" + S.VERSION_SCHEMA + "</p>" +
      "</section>";

    h += '<section class="carte zone-danger"><h2>Réinitialisation</h2>' +
      '<p class="aide">Efface toutes les données de cet appareil : séances, erreurs, tests blancs et réglages. Exporte-les avant.</p>' +
      '<button class="btn btn-danger mt" data-action="reinitialiser">Tout réinitialiser</button></section>';
    return h;
  }

  /* ---------- Installer l'appli ---------- */

  // Carte « Synchronisation Google Drive ».
  function carteSynchro() {
    const Y = P.synchro;
    let corps;
    if (!Y.disponible()) corps = "<p>La synchronisation marche sur la version en ligne de l'appli (adresse https), pas en ouvrant index.html en double-clic.</p>";
    else if (!Y.configuree()) corps = "<p>La synchronisation n'est pas encore configurée : il manque l'identifiant Google de l'appli (voir README).</p>";
    else if (!Y.active()) corps = "<p>Connecte ton compte Google pour retrouver les mêmes données sur ton téléphone et ton ordinateur. Elles sont rangées dans un dossier caché de ton Google Drive, réservé à l'appli.</p>" +
      '<button class="btn btn-primaire" data-action="synchro-connecter">Se connecter avec Google</button>';
    else {
      const der = Y.derniere() ? "Dernière synchronisation : " + u.jourCourt(u.jour(Y.derniere())) + " à " + u.heureMin(Date.parse(Y.derniere())) : "Pas encore synchronisé";
      const etats = { ok: der, synchro: "Synchronisation…", connexion: "Connexion…", expire: "Connexion expirée : touche Reconnecter pour reprendre la synchronisation.", erreur: "Problème : " + Y.message, deconnecte: der };
      corps = '<p data-synchro-etat>' + u.esc(etats[Y.etat] || der) + "</p>" +
        '<div class="rangee-boutons">' + (Y.jetonValide() ? '<button class="btn btn-primaire" data-action="synchro-maintenant">Synchroniser maintenant</button>' : '<button class="btn btn-primaire" data-action="synchro-connecter">Reconnecter</button>') +
        '<button class="btn" data-action="synchro-deconnecter">Déconnecter</button></div>' +
        '<p class="aide">Google limite chaque connexion à 1 heure. Ensuite, l\'appli se reconnecte toute seule au premier toucher ; tes données restent enregistrées sur l\'appareil en attendant.</p>';
    }
    return '<section class="carte"><h2>Synchronisation Google Drive</h2>' + corps + "</section>";
  }

  function carteInstallation() {
    const e = P.app.etatInstallation();
    let corps;
    if (e.installee) {
      corps = "<p>L'appli est installée sur cet appareil et fonctionne hors ligne.</p>";
    } else if (!e.enLigne) {
      corps = "<p>Pour installer l'appli sur ton téléphone, elle doit d'abord être mise en ligne (adresse en https). " +
        "Le fichier README.md explique comment faire, gratuitement, en quelques minutes.</p>";
    } else if (e.invitation) {
      corps = "<p>Installe l'appli : elle s'ouvrira comme une vraie application, depuis l'écran d'accueil, même sans connexion.</p>" +
        '<button class="btn btn-primaire" data-action="installer">Installer l\'appli</button>';
    } else if (e.ios) {
      corps = "<p>Sur iPhone : dans Safari, touche le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut), " +
        "puis <strong>Sur l'écran d'accueil</strong>, puis <strong>Ajouter</strong>.</p>" +
        '<p class="aide">Attention : sur iPhone, l\'appli installée ne voit pas les données saisies dans Safari. Installe-la d\'abord et utilise ensuite uniquement l\'icône de l\'écran d\'accueil, ou transfère tes données avec Exporter puis Importer.</p>';
    } else {
      corps = "<p>Sur Android (Chrome) : ouvre le menu <strong>⋮</strong>, puis <strong>Installer l'application</strong> (ou « Ajouter à l'écran d'accueil »).</p>" +
        '<p class="aide">Sur ordinateur, Chrome et Edge affichent une icône d\'installation dans la barre d\'adresse.</p>';
    }
    return '<section class="carte"><h2>Installer l\'appli</h2>' + corps + "</section>";
  }

  /* ---------- Données : import, restauration, réinitialisation ---------- */

  function erreur(titre, message) {
    ui.modale({ titre: titre, html: "<p>" + u.esc(message) + "</p>", boutons: [{ texte: "OK", classe: "btn-primaire" }] });
  }

  function importer(fichier) {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      let d;
      try { d = S.lireImport(String(lecteur.result)); }
      catch (e) { erreur("Import impossible", e.message); return; }
      const r = S.resume(d);
      ui.modale({
        titre: "Importer « " + fichier.name + " »",
        html: "<p>Ce fichier contient " + r.seances + " " + u.accord(r.seances, "séance") + ", " + r.erreurs + " " + u.accord(r.erreurs, "erreur") +
          " et " + r.testsBlancs + " " + u.accord(r.testsBlancs, "test blanc", "tests blancs") + ".</p>" +
          "<p><strong>Fusionner</strong> ajoute ce qui manque et garde la version la plus récente de chaque élément. C'est le bon choix pour réunir le téléphone et l'ordinateur.</p>" +
          "<p><strong>Remplacer</strong> efface toutes les données actuelles de cet appareil et met celles du fichier à la place.</p>",
        boutons: [
          { texte: "Annuler" },
          { texte: "Remplacer…", classe: "btn-danger", action: () => remplacer(d) },
          { texte: "Fusionner", classe: "btn-primaire", action: () => {
            const b = S.fusionner(d);
            ui.toast("Fusion terminée : " + b.ajoutes + " " + u.accord(b.ajoutes, "élément ajouté", "éléments ajoutés") + ", " +
              b.misAJour + " " + u.accord(b.misAJour, "mis à jour", "mis à jour") + (b.parametres ? ", réglages mis à jour" : ""), 5000);
            P.app.rafraichir();
          } }
        ]
      });
    };
    lecteur.onerror = () => erreur("Import impossible", "Le fichier n'a pas pu être lu.");
    lecteur.readAsText(fichier);
  }

  function remplacer(d) {
    const act = S.resume(S.d);
    ui.confirmer("Les données actuelles de cet appareil (" + act.seances + " " + u.accord(act.seances, "séance") + ", " + act.erreurs + " " +
      u.accord(act.erreurs, "erreur") + ", " + act.testsBlancs + " " + u.accord(act.testsBlancs, "test", "tests") +
      ") seront remplacées par celles du fichier. Une copie de sécurité est faite juste avant.", { titre: "Remplacer toutes les données ?", ok: "Remplacer", danger: true })
      .then(ok => {
        if (!ok) return;
        S.remplacer(d);
        ui.toast("Données remplacées");
        P.app.rafraichir();
      });
  }

  function restaurer() {
    const c = S.copieSecurite();
    if (!c) return;
    ui.confirmer("Les données actuelles seront remplacées par la copie de sécurité (" + c.raison + "). Les données actuelles deviendront à leur tour la copie de sécurité : tu pourras revenir en arrière.", { titre: "Restaurer la copie de sécurité ?", ok: "Restaurer" })
      .then(ok => {
        if (!ok) return;
        try { S.restaurerCopie(); ui.toast("Copie de sécurité restaurée"); P.app.rafraichir(); }
        catch (e) { erreur("Restauration impossible", e.message); }
      });
  }

  function reinitialiser() {
    ui.confirmer("Toutes tes séances, erreurs, tests blancs et réglages seront effacés de cet appareil. Une copie de sécurité est gardée, mais exporte tes données d'abord.", { titre: "Tout réinitialiser ?", ok: "Continuer", danger: true })
      .then(ok => ok && ui.confirmer("Dernière confirmation : tape EFFACER ci-dessous.", {
        titre: "Confirmer la réinitialisation",
        ok: "Tout effacer",
        danger: true,
        html: '<input name="mot" autocomplete="off" aria-label="Tape EFFACER pour confirmer" placeholder="EFFACER">',
        verifier: el => {
          const bon = el.querySelector('[name="mot"]').value.trim().toUpperCase() === "EFFACER";
          if (!bon) ui.toast("Tape EFFACER pour confirmer.");
          return bon;
        }
      }))
      .then(ok => {
        if (!ok) return;
        S.reinitialiser();
        T.charger();
        P.app.appliquerTheme();
        ui.toast("Données réinitialisées");
        P.app.rafraichir();
      });
  }

  /* ---------- Événements ---------- */

  // Petites images des paysages (redessinées quand la couleur ou le thème change).
  function dessinerVignettes(el) {
    el.querySelectorAll("[data-vignette]").forEach(cv => P.fond.vignette(cv, cv.dataset.vignette));
  }

  function monter(el) {
    dessinerVignettes(el);
    el.addEventListener("change", ev => {
      const c = ev.target;
      if (c.name === "accent") {
        S.majAppareil({ accent: c.value });
        P.app.appliquerTheme();
        dessinerVignettes(el);
        return;
      }
      if (c.name === "fondScene") {
        S.majAppareil({ fondScene: c.value });
        P.fond.dessiner();
        return;
      }
      if (c.name === "fondAnime") {
        S.majAppareil({ fondAnime: c.value });
        P.fond.majAnimation();
        return;
      }
      if (c.matches && c.matches("[data-fond-fichier]")) {
        const f = c.files && c.files[0];
        c.value = "";
        if (f) P.fond.definirPhoto(f).then(() => { ui.toast("Fond mis à jour"); P.app.rafraichir(); }).catch(e => ui.toast(e.message, 4000));
        return;
      }
      if (c.name === "theme") {
        S.majAppareil({ theme: c.value === "auto" ? null : c.value });
        P.app.appliquerTheme();
        dessinerVignettes(el);
        return;
      }
      if (c.dataset && c.dataset.appareil) {
        S.majAppareil({ [c.dataset.appareil]: c.checked });
        ui.toast("Enregistré", 1200);
        return;
      }
      if (!c.dataset || !c.dataset.p) return;
      const val = lireValeur(c);
      if (val === undefined) {
        c.classList.add("champ-invalide");
        ui.toast(MESSAGES[c.dataset.type] || "Valeur invalide.", 3500);
        return;
      }
      c.classList.remove("champ-invalide");
      S.reglages(p => definir(p, c.dataset.p, val));
      if (c.dataset.type === "paliers") c.value = val.join(", ");
      ui.toast("Enregistré", 1200);
    });

    el.addEventListener("click", ev => {
      const b = ev.target.closest("[data-action]");
      if (!b) return;
      const a = b.dataset.action;
      if (a === "tester-son") T.testerSon();
      else if (a === "exporter") S.exporterAvecMessage();
      else if (a === "importer") el.querySelector("[data-fichier]").click();
      else if (a === "restaurer") restaurer();
      else if (a === "reinitialiser") reinitialiser();
      else if (a === "retirer-source") {
        const i = Number(b.dataset.i);
        S.reglages(p => { p.sourcesErreurs.splice(i, 1); });
        P.app.rafraichir();
      } else if (a === "ajouter-source") {
        const champ = el.querySelector("[data-nouvelle-source]");
        const s = champ.value.trim();
        if (!s) return;
        if (S.d.parametres.sourcesErreurs.some(x => x.toLowerCase() === s.toLowerCase())) { ui.toast("Cette source existe déjà."); return; }
        S.reglages(p => { p.sourcesErreurs.push(s); });
        P.app.rafraichir();
      } else if (a === "retirer-theme") {
        const i = Number(b.dataset.i);
        S.reglages(p => { p.themesVocabulaire.splice(i, 1); });
        P.app.rafraichir();
      } else if (a === "ajouter-theme") {
        const champ = el.querySelector("[data-nouveau-theme]");
        const s = champ.value.trim();
        if (!s) return;
        if (S.d.parametres.themesVocabulaire.some(x => x.toLowerCase() === s.toLowerCase())) { ui.toast("Ce thème existe déjà."); return; }
        S.reglages(p => { p.themesVocabulaire.push(s); });
        P.app.rafraichir();
      } else if (a === "synchro-connecter") P.synchro.connecter();
      else if (a === "synchro-maintenant") P.synchro.synchroniser();
      else if (a === "synchro-deconnecter") { P.synchro.deconnecter(); P.app.rafraichir(); }
      else if (a === "fond-photo") el.querySelector("[data-fond-fichier]").click();
      else if (a === "fond-retirer") { P.fond.retirerPhoto(); P.app.rafraichir(); }
      else if (a === "installer") {
        P.app.proposerInstallation();
      }
    });

    [["[data-nouvelle-source]", "ajouter-source"], ["[data-nouveau-theme]", "ajouter-theme"]].forEach(([sel, action]) => {
      el.querySelector(sel).addEventListener("keydown", ev => {
        if (ev.key === "Enter") { ev.preventDefault(); el.querySelector('[data-action="' + action + '"]').click(); }
      });
    });

    const fichier = el.querySelector("[data-fichier]");
    fichier.addEventListener("change", () => {
      if (fichier.files && fichier.files[0]) importer(fichier.files[0]);
      fichier.value = "";
    });
  }

  P.vues.parametres = { rendre: rendre, monter: monter };
})(window.Prepa = window.Prepa || {});
