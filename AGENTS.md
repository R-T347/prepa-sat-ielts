# Prépa SAT · IELTS : règles pour les assistants IA

Ce fichier s'adresse à toute IA qui travaille sur ce projet (OpenCode, Claude Code, Copilot…). Lis-le en entier avant de toucher au code.

## La personne avec qui tu travailles

- Un élève de Terminale qui prépare le SAT et l'IELTS. **Il n'est pas développeur.**
- Parle-lui en français, en le tutoyant, avec des phrases simples et sans jargon. Explique ce que tu fais et pourquoi.
- **Propose d'abord, puis attends son accord avant de modifier quoi que ce soit.** Pour une demande importante, présente un plan court et attends qu'il valide.
- Ne publie jamais sur GitHub sans son accord explicite.

## Ce qu'est l'appli

Une appli web (PWA) de suivi de révision : timer, progression, programme, cours SAT, plan, tests blancs, journal d'erreurs, tâches, glossaire, et pour l'IELTS vocabulaire, writing et speaking. Elle est en ligne sur https://r-t347.github.io/prepa-sat-ielts/ (GitHub Pages, branche `main`, racine du dépôt). Un ami l'utilise aussi.

## Règles techniques (à ne jamais enfreindre)

1. **HTML, CSS et JavaScript « vanilla » uniquement.** Pas de framework, pas de npm, pas d'étape de compilation, et **aucune bibliothèque ni police externe (pas de CDN)** : l'appli doit marcher hors ligne.
2. **Pas de modules ES.** Les fichiers sont des scripts classiques qui partagent l'objet global `window.Prepa` (noté `P`), pour que l'appli marche aussi en double-cliquant sur `index.html`. L'ordre des `<script>` dans `index.html` compte.
3. **Ne jamais casser les données de l'utilisateur.**
   - Elles sont dans le `localStorage` du téléphone (clé `prepa.donnees`) et synchronisées dans son Google Drive.
   - Ne renomme ni ne supprime un champ ou une liste existante.
   - Une nouvelle liste s'ajoute dans `LISTES` (`js/store.js`) : `completer()` la crée vide.
   - Tout changement de structure passe par une migration dans `MIGRATIONS` et une hausse de `VERSION_SCHEMA` (actuellement 1).
   - Les suppressions sont « douces » (`supprimeLe`). La fusion se fait par `id`, et la date `modifieLe` la plus récente gagne.
4. **Service worker : à chaque modification d'un fichier, augmente `VERSION` dans `sw.js`** (ex. `prepa-v15` devient `prepa-v16`). Sinon les téléphones gardent l'ancienne version. Un nouveau fichier doit aussi être ajouté à la liste `FICHIERS` de `sw.js`.
5. **Rien de personnel dans le dépôt.** Le site et le dépôt sont publics : jamais de nom de famille, d'e-mail, de scores, de ville ou de pays de l'utilisateur, ni de clé secrète. Le pseudo GitHub R-T347 est le seul identifiant accepté.
6. **N'utilise jamais `git push --force`**, et ne réécris pas l'historique.

## Règles d'interface

- Tous les textes sont en **français**. Le cours SAT (`js/cours-sat.js`) reste en anglais.
- **Mobile d'abord** : tout doit marcher à 360-390 px de large, sans défilement horizontal.
- **Une seule couleur d'accent**, réglable par l'utilisateur : utilise `var(--accent)`, jamais une couleur fixe.
- Pas d'emoji. Les icônes sont des tracés Phosphor (licence MIT) recopiés dans `js/icones.js` : `P.icone("nom")`.
- Thèmes sombre (par défaut) et clair : les couleurs sont des variables CSS au début de `style.css`. Style « verre dépoli ».
- Respecte `prefers-reduced-motion` : `P.ui.calme()` renvoie vrai quand il faut couper les animations.

## Carte du projet

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page unique et l'ordre de chargement des scripts |
| `app.js` | Démarrage, routeur (adresses `#/…`), menu, transitions de page, barre du timer |
| `programme.js` | Programme SAT et IELTS : sections, domaines, compétences (avec leurs identifiants) |
| `js/utils.js` | Outils : dates (`u.aujourdhui()`, `u.jourLong()`…), durées, échappement HTML (`u.esc`) |
| `js/store.js` | Données : lecture et écriture, migrations, export et import, fusion |
| `js/synchro.js` | Synchronisation Google Drive (dossier caché de l'appli). Ne pas changer l'identifiant Google |
| `js/stats.js` | Tous les calculs (heures, séries, objectif du jour…) |
| `js/ui.js` | Fenêtres, toasts, anneaux, menus en cascade, animation des cases cochées |
| `js/fond.js` | Fonds dessinés et animés (6 paysages) |
| `js/cours-sat.js` / `js/cours.js` | Texte du cours SAT / découpage par compétence et méthode en 7 étapes |
| `js/vues/*.js` | Une vue par écran, avec `rendre(r)` (renvoie le HTML) et `monter(el, r)` (branche les événements) |
| `sw.js` | Service worker : appli hors ligne et mises à jour |
| `confidentialite.html` | Règles de confidentialité (demandées par Google) |

Après une modification, `P.app.rafraichir()` redessine la page.

## Tester

- Le plus simple : double-cliquer sur `index.html` pour l'ouvrir dans Chrome. Les données de test restent alors dans ce navigateur.
- Teste à la taille d'un téléphone (outils de développement, puis vue mobile), en thème sombre et clair, et regarde la console pour les erreurs.
- Si tu testes sur un serveur local, désinscris le service worker et vide les caches avant de recharger, sinon tu verras d'anciens fichiers.
- N'utilise jamais les vraies données de l'utilisateur pour tester.

## Publier (seulement avec son accord)

```bash
git add -A
git commit -m "Description en français de ce qui change"
git push
```

GitHub Pages met environ une minute à publier. Sur le téléphone, la nouvelle version s'affiche à la 2e ouverture de l'appli.

En cas de problème avant publication, `git restore .` annule toutes les modifications non enregistrées.
