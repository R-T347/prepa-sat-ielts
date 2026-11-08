/* ==========================================================================
   store.js — les données de l'appli.
   - Sauvegarde automatique dans le localStorage à chaque modification.
   - Numéro de version du schéma + migrations : les anciennes données sont
     converties, jamais effacées.
   - Export en fichier JSON, import « Remplacer » ou « Fusionner ».

   Clés utilisées dans le localStorage :
     prepa.donnees    toutes les données (c'est ce qui est exporté)
     prepa.timer      le timer en cours (propre à l'appareil, géré par moteur-timer.js)
     prepa.appareil   réglages propres à l'appareil : thème, derniers choix, date du dernier export
     prepa.sauvegarde copie automatique faite avant une migration, un import ou une réinitialisation
   ========================================================================== */
(function (P) {
  "use strict";

  const u = P.u;
  const CLES = { donnees: "prepa.donnees", timer: "prepa.timer", appareil: "prepa.appareil", sauvegarde: "prepa.sauvegarde" };
  const APP = "prepa-sat-ielts";
  const VERSION_SCHEMA = 1;

  // Date donnée aux éléments pré-remplis : toute modification réelle sera plus récente,
  // donc gagnera toujours lors d'une fusion.
  const DATE_SEMIS = "2000-01-01T00:00:00.000Z";

  // Toutes les listes d'objets enregistrés (certaines ne servent qu'en phase 2 ou 3).
  const LISTES = [
    "seances", "erreurs", "testsBlancs", "competences", "paliersFetes", "taches", "ressources",
    "planSemaines", "planPhases", "vocabulaire", "essais", "cueCards", "pratiquesSpeaking", "checklist", "methode", "glossaire"
  ];

  /* ---------- Valeurs par défaut ---------- */

  function parametresParDefaut() {
    const paliers = [10, 25, 50, 75, 100, 125, 150];
    return {
      modifieLe: DATE_SEMIS,
      prenom: "",
      sat: { dateExamen: "2026-12-05", objectifHeures: 150, heuresAnterieures: 0, paliers: paliers.slice(), objectifScore: 1500 },
      ielts: { dateExamen: null, objectifHeures: null, heuresAnterieures: 0, paliers: paliers.slice(), objectifBand: null, variante: "academic" },
      pomodoro: { travailMin: 25, pauseMin: 5 },
      son: true,
      seuilSerieMin: 15,
      sourcesErreurs: ["Bluebook", "Question Bank", "OnePrep", "CrackSAT", "UWorld", "Cambridge", "Autre"],
      themesVocabulaire: ["Éducation", "Environnement", "Technologie", "Santé", "Travail", "Société"]
    };
  }

  // Élément pré-rempli : identifiant fixe, pour que le téléphone et l'ordinateur
  // créent exactement le même et que la fusion ne le double pas.
  function semis(id, champs) {
    return Object.assign({ id: id, creeLe: DATE_SEMIS, modifieLe: DATE_SEMIS, supprimeLe: null }, champs);
  }

  function ressourcesParDefaut() {
    return [
      semis("res-bluebook", { examen: "sat", nom: "Bluebook", url: "https://bluebook.collegeboard.org", usage: "Examens blancs officiels" }),
      semis("res-question-bank", { examen: "sat", nom: "Question Bank officielle", url: "https://satsuiteeducatorquestionbank.collegeboard.org", usage: "Questions filtrables par compétence" }),
      semis("res-oneprep", { examen: "sat", nom: "OnePrep", url: "https://www.oneprep.xyz", usage: "Même banque, plus rapide, modules chronométrés" }),
      semis("res-cracksat", { examen: "sat", nom: "CrackSAT", url: "https://www.cracksat.net/digital/", usage: "Volume par compétence" })
    ];
  }

  // Checklist du jour J : moment "veille" ou "matin". Identifiants fixes, comme les ressources.
  const CHECKLIST = {
    sat: {
      veille: [
        "Mettre Bluebook à jour et faire la préparation de l'examen (exam setup)",
        "Récupérer le ticket d'admission (imprimé ou sur le téléphone)",
        "Noter l'adresse du centre et l'heure d'arrivée",
        "Charger l'ordinateur à 100 %",
        "Préparer le sac",
        "Se coucher tôt, sans grosse révision"
      ],
      matin: [
        "Prendre un vrai petit-déjeuner",
        "Pièce d'identité valide avec photo",
        "Ticket d'admission",
        "Ordinateur chargé et son chargeur",
        "Calculatrice (facultatif, Desmos est intégré)",
        "Crayons ou stylos",
        "En-cas et eau pour la pause",
        "Partir en avance"
      ]
    },
    ielts: {
      veille: [
        "Vérifier l'heure et le lieu de l'écrit et de l'oral (parfois deux jours différents)",
        "Préparer la pièce d'identité utilisée à l'inscription",
        "Se coucher tôt, sans grosse révision"
      ],
      matin: [
        "Prendre un vrai petit-déjeuner",
        "Pièce d'identité utilisée à l'inscription",
        "Crayons et gomme (version papier)",
        "Bouteille d'eau transparente sans étiquette",
        "Arriver en avance"
      ]
    }
  };
  // Ajoute la checklist de départ d'un examen qui n'en a encore aucune
  // (même supprimée : un élément retiré reste dans les données, il ne revient donc pas).
  function semerChecklist(d) {
    Object.keys(CHECKLIST).forEach(ex => {
      if (d.checklist.some(x => x.examen === ex)) return;
      ["veille", "matin"].forEach(moment => CHECKLIST[ex][moment].forEach((texte, i) => {
        d.checklist.push(semis("jj-" + ex + "-" + moment + "-" + (i + 1), { examen: ex, moment: moment, texte: texte, fait: false, ordre: i + 1 }));
      }));
    });
  }

  function donneesVides() {
    const d = { app: APP, versionSchema: VERSION_SCHEMA, parametres: parametresParDefaut() };
    LISTES.forEach(l => { d[l] = []; });
    d.ressources = ressourcesParDefaut();
    semerChecklist(d);
    return d;
  }

  /* ---------- Migrations ----------
     Quand une future version change la structure des données, on ajoute ici une
     fonction qui convertit la version N en version N+1, puis on augmente
     VERSION_SCHEMA. Exemple pour passer de la v1 à la v2 :

       1: function (d) {
         d.seances.forEach(s => { s.lieu = null; });   // nouveau champ
         return d;
       },

     Les migrations s'enchaînent : un export v1 importé en v3 passe par v1→v2 puis v2→v3. */
  const MIGRATIONS = {};

  function migrer(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) throw new Error("Ce fichier ne contient pas de données lisibles.");
    if (d.app !== APP) throw new Error("Ce fichier ne vient pas de cette application.");
    const v = Number(d.versionSchema);
    if (!Number.isInteger(v) || v < 1) throw new Error("Le numéro de version du schéma est absent ou invalide.");
    if (v > VERSION_SCHEMA) {
      throw new Error("Ces données viennent d'une version plus récente de l'appli (schéma v" + v + ", cette appli lit jusqu'à la v" + VERSION_SCHEMA + "). Mets d'abord l'appli à jour.");
    }
    d.versionSchema = v;
    while (d.versionSchema < VERSION_SCHEMA) {
      const f = MIGRATIONS[d.versionSchema];
      if (!f) throw new Error("Migration manquante depuis la v" + d.versionSchema + ".");
      d = f(d);
      d.versionSchema += 1;
    }
    return completer(d);
  }

  // Ajoute ce qui manque (liste absente, nouveau réglage) sans rien enlever.
  function completer(d) {
    delete d.exporteLe;
    LISTES.forEach(l => {
      if (!Array.isArray(d[l])) d[l] = [];
      d[l] = d[l].filter(x => x && typeof x === "object" && !Array.isArray(x));
      d[l].forEach(x => {
        // Réparation douce d'un élément incomplet (fichier modifié à la main, par exemple).
        if (typeof x.id !== "string" || !x.id) x.id = u.uuid();
        if (typeof x.creeLe !== "string") x.creeLe = DATE_SEMIS;
        if (typeof x.modifieLe !== "string") x.modifieLe = x.creeLe;
        if (x.supprimeLe === undefined) x.supprimeLe = null;
      });
    });
    d.parametres = fusionProfonde(parametresParDefaut(), d.parametres || {});
    semerChecklist(d);
    return d;
  }

  const estObjet = x => x !== null && typeof x === "object" && !Array.isArray(x);
  // Les valeurs enregistrées l'emportent ; les réglages absents prennent leur valeur par défaut.
  function fusionProfonde(def, val) {
    const r = Object.assign({}, def);
    Object.keys(val || {}).forEach(k => {
      r[k] = (estObjet(def[k]) && estObjet(val[k])) ? fusionProfonde(def[k], val[k]) : val[k];
    });
    return r;
  }

  /* ---------- Accès au localStorage ---------- */

  function lireBrut(cle) {
    try { return localStorage.getItem(cle); } catch (e) { return null; }
  }
  function ecrireBrut(cle, valeur) {
    localStorage.setItem(cle, valeur);
  }
  // Met de côté une copie (texte brut) avant toute opération risquée.
  function copieDeSecurite(contenu, raison) {
    if (!contenu) return;
    try { ecrireBrut(CLES.sauvegarde, JSON.stringify({ date: u.iso(), raison: raison, contenu: contenu })); }
    catch (e) { /* stockage plein : on n'empêche pas l'opération pour autant */ }
  }

  const S = {
    d: null,             // les données en mémoire
    alerte: null,        // message à afficher sur l'Accueil en cas de problème au chargement
    lectureSeule: false, // vrai si les données enregistrées ne peuvent pas être lues sans risque
    VERSION_SCHEMA: VERSION_SCHEMA,
    CLES: CLES
  };

  S.charger = function () {
    S.alerte = null;
    S.lectureSeule = false;
    const brut = lireBrut(CLES.donnees);
    if (!brut) {
      S.d = donneesVides();
      S.sauver();
      return;
    }
    let obj;
    try {
      obj = JSON.parse(brut);
    } catch (e) {
      // Données illisibles : on les met de côté au lieu de les écraser.
      copieDeSecurite(brut, "Données illisibles au démarrage");
      S.alerte = "Les données enregistrées étaient illisibles. Une copie brute a été mise de côté (Paramètres › Copie de sécurité). L'appli repart d'une base vide.";
      S.d = donneesVides();
      S.sauver();
      return;
    }
    try {
      const ancienne = Number(obj && obj.versionSchema) < VERSION_SCHEMA;
      if (ancienne) copieDeSecurite(brut, "Avant migration du schéma v" + obj.versionSchema + " vers v" + VERSION_SCHEMA);
      S.d = migrer(obj);
      if (ancienne) S.sauver();
    } catch (e) {
      // Données d'une version plus récente, ou non reconnues : on ne touche à rien.
      S.lectureSeule = true;
      S.alerte = e.message + " Rien ne sera enregistré tant que ce problème n'est pas réglé.";
      S.d = donneesVides();
    }
  };

  S.sauver = function () {
    if (S.lectureSeule) {
      if (P.ui) P.ui.toast("Lecture seule : rien n'est enregistré.");
      return false;
    }
    try {
      ecrireBrut(CLES.donnees, JSON.stringify(S.d));
      if (!S.sansSynchro && P.synchro) P.synchro.planifier(); // envoi vers Google Drive quelques secondes plus tard
      return true;
    } catch (e) {
      if (P.ui) P.ui.toast("Impossible d'enregistrer : stockage plein ou bloqué. Exporte tes données.", 6000);
      return false;
    }
  };

  /* ---------- Lecture et modification des listes ---------- */

  // Éléments non supprimés d'une liste, éventuellement pour un seul examen.
  S.liste = (nom, examen) => S.d[nom].filter(x => !x.supprimeLe && (!examen || x.examen === examen));
  S.trouver = (nom, id) => S.d[nom].find(x => x.id === id) || null;

  S.ajouter = function (nom, champs) {
    const t = u.iso();
    const obj = Object.assign({ id: u.uuid(), creeLe: t, modifieLe: t, supprimeLe: null }, champs);
    S.d[nom].push(obj);
    S.sauver();
    return obj;
  };

  // Ajoute plusieurs éléments d'un coup (une seule sauvegarde). Les champs peuvent fournir un id.
  S.ajouterPlusieurs = function (nom, liste) {
    const t = u.iso();
    liste.forEach(champs => S.d[nom].push(Object.assign({ id: u.uuid(), creeLe: t, modifieLe: t, supprimeLe: null }, champs)));
    return S.sauver();
  };

  S.modifier = function (nom, id, champs) {
    const obj = S.trouver(nom, id);
    if (!obj) return null;
    Object.assign(obj, champs, { modifieLe: u.iso() });
    S.sauver();
    return obj;
  };

  // Suppression « douce » : l'élément reste dans les données avec une date de suppression.
  // Sinon, une fusion avec un autre appareil qui l'a encore le ferait revenir.
  S.supprimer = (nom, id) => S.modifier(nom, id, { supprimeLe: u.iso() });

  // Crée ou met à jour un élément à identifiant fixe (ex. état d'une compétence).
  S.definir = function (nom, id, champs) {
    if (S.trouver(nom, id)) return S.modifier(nom, id, Object.assign({}, champs, { supprimeLe: null }));
    return S.ajouter(nom, Object.assign({}, champs, { id: id }));
  };

  // Modifie les paramètres : fn reçoit l'objet des paramètres et le change.
  S.reglages = function (fn) {
    fn(S.d.parametres);
    S.d.parametres.modifieLe = u.iso();
    return S.sauver();
  };

  /* ---------- Réglages propres à l'appareil (jamais exportés) ---------- */

  S.appareil = function () {
    try { return JSON.parse(lireBrut(CLES.appareil)) || {}; } catch (e) { return {}; }
  };
  S.majAppareil = function (champs) {
    const a = Object.assign(S.appareil(), champs);
    try { ecrireBrut(CLES.appareil, JSON.stringify(a)); } catch (e) { /* sans gravité */ }
    return a;
  };

  /* ---------- Export ---------- */

  S.texteExport = () => JSON.stringify(Object.assign({}, S.d, { exporteLe: u.iso() }), null, 2);
  S.nomFichierExport = () => "prepa-sat-ielts_" + u.aujourdhui() + ".json";

  // Télécharge un fichier JSON daté contenant toutes les données.
  // Sur téléphone (écran tactile), ouvre le menu de partage du système (WhatsApp, Drive,
  // Fichiers…) ; sinon, ou si le partage n'est pas possible, télécharge le fichier.
  // Renvoie une promesse : "partage", "telechargement" ou "annule".
  S.exporter = async function () {
    const texte = S.texteExport();
    const nom = S.nomFichierExport();
    const tactile = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (tactile && navigator.canShare && typeof File === "function") {
      const fichier = new File([texte], nom, { type: "application/json" });
      if (navigator.canShare({ files: [fichier] })) {
        try {
          await navigator.share({ files: [fichier], title: "Sauvegarde Prépa SAT · IELTS" });
          S.majAppareil({ dernierExport: u.iso() });
          return "partage";
        } catch (e) {
          if (e && e.name === "AbortError") return "annule"; // fenêtre de partage fermée
          // Autre problème : on passe au téléchargement classique.
        }
      }
    }
    const url = URL.createObjectURL(new Blob([texte], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    S.majAppareil({ dernierExport: u.iso() });
    return "telechargement";
  };

  // Export avec message de confirmation et mise à jour de l'écran (boutons « Exporter »).
  S.exporterAvecMessage = function () {
    return S.exporter().then(r => {
      if (r === "annule") return;
      P.ui.toast(r === "partage" ? "Sauvegarde envoyée" : "Sauvegarde téléchargée : " + S.nomFichierExport(), 3500);
      P.app.rafraichir();
    });
  };

  /* ---------- Import ---------- */

  // Lit et vérifie un fichier exporté. Lève une erreur avec un message clair si besoin.
  S.lireImport = function (texte) {
    let obj;
    try { obj = JSON.parse(texte); } catch (e) { throw new Error("Ce fichier n'est pas un fichier JSON valide."); }
    return migrer(obj);
  };

  // Résumé d'un jeu de données, pour la fenêtre de confirmation.
  S.resume = function (d) {
    const n = l => d[l].filter(x => !x.supprimeLe).length;
    return { seances: n("seances"), erreurs: n("erreurs"), testsBlancs: n("testsBlancs") };
  };

  // Remplacer : tout est écrasé (une copie de sécurité est faite avant).
  S.remplacer = function (d) {
    copieDeSecurite(lireBrut(CLES.donnees), "Avant import (Remplacer)");
    S.lectureSeule = false;
    S.alerte = null;
    S.d = d;
    return S.sauver();
  };

  // Fusionner : ajoute les éléments absents ; pour ceux qui existent des deux côtés
  // (même identifiant), garde la version modifiée le plus récemment. Une suppression
  // compte comme une modification. Pour les paramètres, le bloc le plus récent l'emporte.
  // opts.silencieux : fusion faite par la synchronisation (ni copie de sécurité, ni nouvel envoi).
  S.fusionner = function (autre, opts) {
    opts = opts || {};
    if (!opts.silencieux) copieDeSecurite(lireBrut(CLES.donnees), "Avant import (Fusionner)");
    const bilan = { ajoutes: 0, misAJour: 0, parametres: false };
    LISTES.forEach(l => {
      const parId = new Map(S.d[l].map((x, i) => [x.id, i]));
      autre[l].forEach(y => {
        const i = parId.get(y.id);
        if (i === undefined) {
          parId.set(y.id, S.d[l].length);
          S.d[l].push(y);
          bilan.ajoutes++;
        } else if ((y.modifieLe || "") > (S.d[l][i].modifieLe || "")) {
          S.d[l][i] = y;
          bilan.misAJour++;
        }
      });
    });
    if ((autre.parametres.modifieLe || "") > (S.d.parametres.modifieLe || "")) {
      S.d.parametres = autre.parametres;
      bilan.parametres = true;
    }
    S.sansSynchro = !!opts.silencieux;
    S.sauver();
    S.sansSynchro = false;
    return bilan;
  };

  /* ---------- Copie de sécurité et réinitialisation ---------- */

  S.copieSecurite = function () {
    try { return JSON.parse(lireBrut(CLES.sauvegarde)); } catch (e) { return null; }
  };

  // Restaure la copie de sécurité. Les données actuelles deviennent à leur tour
  // la copie de sécurité : on peut donc annuler une restauration.
  S.restaurerCopie = function () {
    const c = S.copieSecurite();
    if (!c || !c.contenu) throw new Error("Aucune copie de sécurité disponible.");
    const d = S.lireImport(c.contenu);
    copieDeSecurite(lireBrut(CLES.donnees), "Avant restauration de la copie de sécurité");
    S.lectureSeule = false;
    S.alerte = null;
    S.d = d;
    return S.sauver();
  };

  // Réinitialisation complète (après double confirmation dans les Paramètres).
  S.reinitialiser = function () {
    copieDeSecurite(lireBrut(CLES.donnees), "Avant réinitialisation complète");
    S.lectureSeule = false;
    S.alerte = null;
    S.d = donneesVides();
    S.sauver();
    try { localStorage.removeItem(CLES.timer); } catch (e) { /* sans gravité */ }
    const theme = S.appareil().theme;
    try { ecrireBrut(CLES.appareil, JSON.stringify({ theme: theme, premierLancement: u.iso() })); } catch (e) { /* sans gravité */ }
  };

  // Taille approximative des données enregistrées, en kilo-octets.
  S.tailleKo = () => Math.ceil(((lireBrut(CLES.donnees) || "").length * 2) / 1024);

  P.store = S;
})(window.Prepa = window.Prepa || {});
