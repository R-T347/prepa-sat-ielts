# Prépa SAT · IELTS

Application web personnelle pour suivre ta préparation au SAT et à l'IELTS : timer de révision, heures cumulées, journal d'erreurs avec reprises, tests blancs, programme, plan, vocabulaire, Writing et Speaking.
Elle fonctionne entièrement hors ligne, sans serveur et sans bibliothèque externe.

## Ouvrir l'appli

**Sur ordinateur :** double-clique sur `index.html`. Chrome, Edge et Firefox conviennent.
**Sur téléphone :** mets d'abord l'appli en ligne, puis installe-la (voir plus bas).

Tes données sont enregistrées dans le navigateur (localStorage), pas dans le dossier.

## Sauvegarder tes données

Les données restent sur l'appareil et dans le navigateur où tu les as saisies. Le téléphone et l'ordinateur ont donc chacun leurs propres données.

- **Exporter** (Paramètres › Mes données) télécharge un fichier `prepa-sat-ielts_AAAA-MM-JJ.json`. C'est ta sauvegarde. Range-le dans OneDrive, par exemple.
- **Importer › Fusionner** ajoute les éléments absents et garde la version la plus récente de chacun. C'est ce qu'il faut pour réunir le téléphone et l'ordinateur : exporte sur l'un, puis importe et fusionne sur l'autre.
- **Importer › Remplacer** écrase tout, après confirmation.
- Avant chaque import, migration ou réinitialisation, l'appli garde une **copie de sécurité**, que tu peux restaurer depuis les Paramètres.
- L'Accueil te le rappelle si tu n'as pas exporté depuis plus de 7 jours.

Attention : effacer les données de navigation du navigateur efface aussi celles de l'appli. Exporte avant de le faire.

## L'appli en ligne

**Adresse : https://r-t347.github.io/prepa-sat-ielts/**

Elle est hébergée gratuitement par GitHub Pages, à partir du dépôt [github.com/R-T347/prepa-sat-ielts](https://github.com/R-T347/prepa-sat-ielts). **Tes données ne sont jamais envoyées sur Internet** : seul le code de l'appli est en ligne, les données restent dans chaque appareil.

Dans Settings › Pages, laisse le champ **Custom domain** vide. Il ne sert que si tu achètes ton propre nom de domaine.

### Publier une modification

Le dossier `prepa-sat-ielts` de ton ordinateur est relié au dépôt GitHub par Git. Après une modification (par exemple dans `programme.js`) :

- **le plus simple :** demande à Claude de publier ;
- **ou toi-même :** ouvre Git Bash dans le dossier (clic droit › « Open Git Bash here ») et tape :

```
git add -A
git commit -m "Ce que j'ai changé"
git push
```

Le site est mis à jour une à deux minutes plus tard, et chaque version reste dans l'historique du dépôt. Sur le téléphone, la nouvelle version apparaît à la deuxième ouverture de l'appli.

Si tu modifies un fichier directement sur github.com, tape d'abord `git pull` dans Git Bash avant de modifier le dossier sur ton ordinateur.

## Autres façons de mettre l'appli en ligne

Celles-ci ne servent que si tu veux héberger l'appli ailleurs.

### Avant de commencer : sauvegarde

Si tu as déjà saisi des données en ouvrant `index.html` en double-clic, exporte-les (Paramètres › Exporter mes données). La version en ligne ne les verra pas : il faudra les importer.

### Option 1 : Netlify Drop (environ 5 minutes)

Attention : sur l'offre gratuite, Netlify ajoute en bas à droite de chaque page un badge « Powered by Netlify » qui recouvre une partie du menu sur téléphone. Il n'est pas possible de le retirer sans payer.

1. Va sur [app.netlify.com/signup](https://app.netlify.com/signup) et crée un compte gratuit (avec ton adresse e-mail, Google ou GitHub). Avec un compte, ton projet est gardé sans limite de durée et tu pourras le mettre à jour.
2. Une fois connecté, va sur [app.netlify.com/drop](https://app.netlify.com/drop).
3. Ouvre l'explorateur de fichiers, prends le dossier **`prepa-sat-ielts`** entier et fais-le glisser sur « Drop here ». Tu peux aussi cliquer sur « folder » et choisir le dossier. Attends la fin de l'envoi, quelques secondes.
4. Netlify affiche l'adresse de ton projet, du type `https://nom-au-hasard.netlify.app`. Clique dessus : l'appli s'ouvre. Si Netlify te propose de « réclamer » (claim) le projet, accepte : c'est ce qui le rattache à ton compte.
5. Facultatif : pour une adresse plus simple, ouvre les réglages du projet sur Netlify (Project configuration), puis **Change project name**, et choisis par exemple `prepa-sat-ielts`. L'adresse devient `https://prepa-sat-ielts.netlify.app`.
6. **Pour une mise à jour plus tard :** ouvre ton projet sur Netlify, onglet **Deploys**, et fais glisser à nouveau le dossier dans la zone prévue.

### Option 2 : GitHub Pages

1. Crée un compte sur [github.com](https://github.com).
2. Clique sur **New repository**. Nom : `prepa-sat-ielts`. Coche **Public**, puis **Create repository**.
3. Sur la page du dépôt, clique sur **uploading an existing file**.
4. Ouvre le dossier `prepa-sat-ielts` sur ton ordinateur, sélectionne **tout son contenu** (pas le dossier lui-même) et fais-le glisser dans la page. `index.html` doit être à la racine. Clique sur **Commit changes**.
5. Va dans **Settings › Pages**. Dans « Build and deployment › Source », choisis **Deploy from a branch**, puis la branche **main** et le dossier **/ (root)**. Clique sur **Save**.
6. Une ou deux minutes plus tard, l'appli est en ligne à l'adresse `https://ton-pseudo.github.io/prepa-sat-ielts/`. Elle s'affiche en haut de la page Settings › Pages.
7. **Pour une mise à jour plus tard :** recommence l'étape 3 avec les fichiers modifiés, puis Commit changes.

Le code devient public, mais pas tes données.

## Installer l'appli sur ton téléphone

1. Sur le téléphone, ouvre l'adresse de ton site.
2. **Android (Chrome) :** menu **⋮** › **Installer l'application** (ou « Ajouter à l'écran d'accueil »). Tu peux aussi utiliser Paramètres › Installer l'appli.
3. **iPhone (Safari obligatoirement) :** bouton **Partager** (le carré avec une flèche vers le haut) › **Sur l'écran d'accueil** › **Ajouter**.
4. Ouvre l'appli depuis sa nouvelle icône. Elle fonctionne ensuite **sans connexion**.
5. Transfère tes données : sur l'ordinateur, Paramètres › Exporter mes données. Envoie-toi le fichier (e-mail, WhatsApp, OneDrive…). Sur le téléphone, dans l'appli installée : Paramètres › Importer un fichier › Remplacer (ou Fusionner).

**Important sur iPhone :** l'appli installée sur l'écran d'accueil ne voit pas les données saisies dans un onglet Safari. Après l'installation, utilise uniquement l'icône. L'appli installée est aussi la meilleure protection contre l'effacement automatique des données par Safari.

**Mises à jour :** l'appli s'ouvre toujours avec la version gardée sur le téléphone, puis vérifie s'il en existe une plus récente. Après une mise à jour en ligne, la nouvelle version apparaît à la **deuxième** ouverture.

## Synchroniser le téléphone et l'ordinateur (Google Drive)

Dans Paramètres › Synchronisation Google Drive, connecte ton compte Google sur chaque appareil. Les données sont rangées dans un dossier caché de ton Google Drive, réservé à l'appli, et fusionnées sans doublon (même règle que Importer › Fusionner). Google limite chaque connexion à 1 heure : ensuite, touche « Reconnecter ».

« Tout réinitialiser » n'efface pas la copie du Drive : à la synchronisation suivante, les données reviennent.

L'appli a besoin d'un identifiant Google (gratuit), à créer une fois dans [Google Cloud Console](https://console.cloud.google.com) : projet › API Google Drive activée › écran de consentement OAuth › identifiant « Application Web » avec l'origine `https://r-t347.github.io`. L'identifiant se colle dans `js/synchro.js` (constante `CLIENT_ID`).

## Importer ton carnet d'erreurs Google Sheets

1. Dans Google Sheets : Fichier › Télécharger › Valeurs séparées par des virgules (.csv).
2. Dans l'appli, ouvre SAT (ou IELTS) › Journal d'erreurs › **Importer un CSV**.
3. Un aperçu indique ce qui sera ajouté et ce qui pose problème. Confirme l'import.

Les colonnes doivent être, dans cet ordre : Date, Source, Section, Compétence, Domaine, Réf. question, Ma rép. → bonne, Type d'erreur, La règle, Sec., Fini à temps ?, À refaire le, Refait juste ?, Statut.

- La ligne de titres est ignorée. Les dates peuvent être au format `04/11/2026` ou `2026-11-04`.
- Les sections, domaines et compétences sont reconnus d'après leur nom, en anglais ou en français. Un nom non reconnu n'est pas perdu : il est recopié dans la référence de la question.
- Tu peux réimporter le même fichier sans risque : les lignes déjà importées sont ignorées.

## Modifier le contenu des examens

Tout le contenu officiel est dans **`programme.js`** : sections, domaines, compétences, explications en français et lignes de la carte « Format de l'examen ». Les types d'essai de l'onglet Writing en viennent aussi (Writing › Task 1 / Task 2).

- Tu peux changer librement les `nom` et les `fr`.
- **Ne change jamais l'`id`** d'un élément existant : tes séances et tes erreurs y font référence.
- Pour ajouter une compétence, copie une ligne et donne-lui un `id` nouveau, en minuscules, sans espace ni accent.
- Une fois l'appli en ligne, remets-la en ligne après chaque modification (voir « Pour une mise à jour plus tard »).

## Organisation des fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | structure de la page |
| `style.css` | apparence, thèmes clair et sombre |
| `programme.js` | contenu des examens (à modifier ici) |
| `app.js` | démarrage, navigation, mise à jour du timer en cours, installation |
| `manifest.webmanifest`, `sw.js`, `icones/` | version installable et fonctionnement hors ligne |
| `js/utils.js` | dates, formats, accès au programme |
| `js/store.js` | sauvegarde, version du schéma, migrations, export/import/fusion |
| `js/moteur-timer.js` | calcul du temps à partir des horodatages, Pomodoro, son |
| `js/stats.js` | heures, pourcentages, séries, rythme, reprises, révision du vocabulaire |
| `js/ui.js` | fenêtres, menus en cascade, anneau et courbe en SVG |
| `js/graphiques.js` | heures par semaine, calendrier, répartition (SVG) |
| `js/paliers.js` | badges et célébration des paliers d'heures |
| `js/import-csv.js` | import du carnet d'erreurs au format CSV |
| `js/vues/*.js` | un fichier par écran |

Chaque donnée porte un numéro de version de schéma (`versionSchema`). Si une future version change la structure, une fonction de migration dans `js/store.js` convertit les anciennes données au lieu de les effacer.
