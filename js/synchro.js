/* ==========================================================================
   synchro.js — synchronisation entre appareils via TON Google Drive.

   - Connexion avec ton compte Google (bouton dans les Paramètres).
   - Les données sont rangées dans un dossier caché de ton Drive, réservé à
     l'appli (« appDataFolder ») : elles n'apparaissent pas dans tes fichiers
     et aucune autre appli ne peut les lire.
   - À chaque synchronisation : on lit le fichier du Drive, on le FUSIONNE avec
     les données de l'appareil (même règle que Importer › Fusionner : la version
     la plus récente de chaque élément gagne, aucun doublon), puis on renvoie
     le résultat sur le Drive.
   - Synchronisation automatique : à la connexion, à l'ouverture de l'appli,
     au retour sur l'appli, et quelques secondes après chaque modification.
   - Google limite la connexion à 1 heure : ensuite, un bouton « Reconnecter »
     apparaît (les données restent enregistrées sur l'appareil en attendant).

   Pour que ça marche, il faut un identifiant d'appli Google (CLIENT_ID, ci-dessous),
   créé gratuitement dans Google Cloud Console (voir README).
   ========================================================================== */
(function (P) {
  "use strict";

  const CLIENT_ID = "991823601805-2girhsrp0e0ib55i5ji864dv4p5fpacc.apps.googleusercontent.com";
  const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const NOM_FICHIER = "prepa-sat-ielts-donnees.json";

  const u = P.u, S = P.store;
  const Y = { etat: "deconnecte", message: "" }; // deconnecte | connexion | synchro | ok | expire | erreur
  let jeton = null, expireA = 0, clientJeton = null, minuterie = null, enCours = false, aRefaire = false;

  const appareil = () => S.appareil().synchro || {};
  const memoriser = champs => S.majAppareil({ synchro: Object.assign({}, appareil(), champs) });

  Y.configuree = () => !!CLIENT_ID;
  Y.disponible = () => /^https:$/.test(location.protocol) || location.hostname === "localhost";
  Y.active = () => !!appareil().active;
  Y.derniere = () => appareil().derniere || null;
  Y.jetonValide = () => !!jeton && Date.now() < expireA - 60000;

  function changer(etat, message) {
    Y.etat = etat;
    Y.message = message || "";
    document.dispatchEvent(new CustomEvent("synchro"));
  }

  // Charge (une seule fois) la bibliothèque de connexion de Google.
  let chargement = null;
  function chargerGoogle() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (chargement) return chargement;
    chargement = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = () => ok();
      s.onerror = () => { chargement = null; ko(new Error("Impossible de joindre Google (connexion Internet ?)")); };
      document.head.appendChild(s);
    });
    return chargement;
  }

  let demandeEnCours = false; // une fenêtre Google est déjà ouverte
  let pauseAutoJusqua = 0;     // après un refus, on ne relance pas tout seul pendant un moment

  // Prépare le client de connexion Google (la bibliothèque doit être chargée).
  function preparerClient() {
    if (clientJeton) return;
    clientJeton = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: rep => {
        demandeEnCours = false;
        if (rep.error || !rep.access_token) {
          pauseAutoJusqua = Date.now() + 10 * 60000;
          changer(Y.active() ? "expire" : "deconnecte", "Connexion annulée");
          return;
        }
        jeton = rep.access_token;
        expireA = Date.now() + (Number(rep.expires_in) || 3600) * 1000;
        memoriser({ active: true });
        Y.synchroniser();
      },
      error_callback: () => {
        demandeEnCours = false;
        pauseAutoJusqua = Date.now() + 10 * 60000; // fenêtre fermée ou bloquée : pas de nouvel essai automatique avant 10 min
        changer(Y.active() ? "expire" : "deconnecte", "Connexion annulée");
      }
    });
  }

  // Demande un accès au Drive. À appeler depuis un clic (Google ouvre une fenêtre).
  Y.connecter = function () {
    if (!Y.configuree()) { P.ui.toast("Synchronisation pas encore configurée (identifiant Google manquant)."); return; }
    changer("connexion");
    chargerGoogle().then(() => {
      preparerClient();
      demandeEnCours = true;
      clientJeton.requestAccessToken({ prompt: Y.active() ? "" : "consent" });
    }).catch(e => changer("erreur", e.message));
  };

  /* Reconnexion automatique : quand l'heure accordée par Google est passée, le premier
     toucher n'importe où dans l'appli relance la connexion. Comme tu as déjà autorisé
     l'appli, la fenêtre Google s'ouvre et se referme toute seule. Le navigateur exige
     que la fenêtre parte directement d'un geste : la bibliothèque est donc chargée
     à l'avance, au démarrage. */
  function reconnexionAuToucher(ev) {
    if (!Y.active() || !Y.configuree() || !Y.disponible() || Y.jetonValide()) return;
    if (demandeEnCours || Date.now() < pauseAutoJusqua || !clientJeton) return;
    if (ev.target.closest && ev.target.closest('[data-action="synchro-connecter"], [data-action="synchro-deconnecter"]')) return;
    demandeEnCours = true;
    changer("connexion");
    clientJeton.requestAccessToken({ prompt: "" });
  }

  Y.deconnecter = function () {
    if (jeton && window.google && google.accounts) { try { google.accounts.oauth2.revoke(jeton, () => {}); } catch (e) { /* rien */ } }
    jeton = null; expireA = 0;
    memoriser({ active: false });
    changer("deconnecte");
  };

  /* ---------- Échanges avec l'API Google Drive ---------- */

  async function api(url, options) {
    const rep = await fetch(url, Object.assign({}, options, { headers: Object.assign({ Authorization: "Bearer " + jeton }, (options || {}).headers) }));
    if (rep.status === 401) { jeton = null; throw Object.assign(new Error("Connexion expirée"), { expire: true }); }
    if (!rep.ok) throw new Error("Google Drive a répondu " + rep.status);
    return rep;
  }

  async function trouverFichier() {
    const q = encodeURIComponent("name = '" + NOM_FICHIER + "'");
    const rep = await api("https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=" + q);
    const f = (await rep.json()).files || [];
    return f.length ? f[0].id : null;
  }

  async function envoyer(id, texte) {
    const meta = id ? {} : { name: NOM_FICHIER, parents: ["appDataFolder"] };
    const limite = "prepa" + Math.random().toString(36).slice(2);
    const corps = "--" + limite + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(meta) +
      "\r\n--" + limite + "\r\nContent-Type: application/json\r\n\r\n" + texte + "\r\n--" + limite + "--";
    const url = id ? "https://www.googleapis.com/upload/drive/v3/files/" + id + "?uploadType=multipart"
      : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
    await api(url, { method: id ? "PATCH" : "POST", headers: { "Content-Type": "multipart/related; boundary=" + limite }, body: corps });
  }

  // Lit le Drive, fusionne avec l'appareil, renvoie le résultat.
  Y.synchroniser = async function () {
    if (!Y.active()) return;
    if (!Y.jetonValide()) { changer("expire"); return; }
    if (enCours) { aRefaire = true; return; }
    enCours = true;
    changer("synchro");
    try {
      let modifie = false;
      const id = await trouverFichier();
      if (id) {
        const texte = await (await api("https://www.googleapis.com/drive/v3/files/" + id + "?alt=media")).text();
        const distant = S.lireImport(texte);
        const b = S.fusionner(distant, { silencieux: true });
        modifie = b.ajoutes + b.misAJour > 0 || b.parametres;
      }
      await envoyer(id, S.texteExport());
      memoriser({ derniere: u.iso() });
      changer("ok");
      if (modifie && P.app) P.app.rafraichir();
    } catch (e) {
      if (e.expire) changer("expire"); else changer("erreur", e.message);
    } finally {
      enCours = false;
      if (aRefaire) { aRefaire = false; Y.planifier(); }
    }
  };

  // Synchronisation quelques secondes après une modification (regroupe les changements).
  Y.planifier = function () {
    if (!Y.active() || enCours) { if (enCours) aRefaire = true; return; }
    clearTimeout(minuterie);
    minuterie = setTimeout(() => { if (Y.jetonValide()) Y.synchroniser(); else changer("expire"); }, 4000);
  };

  // Au démarrage : si la synchro était active, on attend un clic sur « Reconnecter »
  // (Google n'autorise pas l'ouverture de sa fenêtre sans geste de l'utilisateur).
  Y.demarrer = function () {
    if (Y.active() && Y.configuree() && Y.disponible()) {
      changer("expire");
      chargerGoogle().then(preparerClient).catch(() => { /* hors ligne : on réessaiera au clic sur Reconnecter */ });
    }
    document.addEventListener("click", reconnexionAuToucher, true);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && Y.active() && Y.jetonValide()) Y.synchroniser();
    });
  };

  P.synchro = Y;
})(window.Prepa = window.Prepa || {});
