/* ==========================================================================
   programme.js — CONTENU OFFICIEL DES EXAMENS
   --------------------------------------------------------------------------
   C'est le seul fichier à modifier pour changer le contenu des examens.

   Structure : examen › sections › domaines › compétences.
   Chaque élément a :
     - id  : identifiant technique. NE LE CHANGE JAMAIS pour un élément existant :
             tes séances et tes erreurs y font référence. Si tu le changes, elles
             s'afficheront avec la mention « inconnu ».
     - nom : nom officiel (en anglais). Tu peux le modifier librement.
     - fr  : courte explication en français. Tu peux la modifier librement.

   Pour AJOUTER une compétence : copie une ligne { id: ..., nom: ..., fr: ... },
   colle-la dans la bonne liste et donne-lui un id nouveau (lettres minuscules,
   chiffres et tirets, sans espace ni accent).

   IELTS : une section peut porter `variante: "academic"` ou `variante: "general"`.
   Elle ne s'affiche alors que si cette variante est choisie dans les Paramètres.
   Une section sans `variante` s'affiche dans les deux cas.
   ========================================================================== */

window.Prepa = window.Prepa || {};

Prepa.PROGRAMME = {

  /* ------------------------------------------------------------------ SAT */
  sat: {
    nom: "SAT",
    // Lignes de la carte « Format de l'examen »
    format: [
      "SAT digital, adaptatif par module : 2 sections, chacune en 2 modules.",
      "Le 2e module de chaque section s'adapte au résultat du 1er (plus facile ou plus difficile).",
      "Score total de 400 à 1600 (200 à 800 par section).",
      "Calculatrice Desmos autorisée sur toute la section Math."
    ],
    sections: [
      {
        id: "rw", nom: "Reading and Writing", fr: "Lecture et écriture",
        info: "54 questions, 64 min, en 2 modules de 27 questions (32 min chacun)",
        domaines: [
          {
            id: "info", nom: "Information and Ideas", fr: "Comprendre les informations et les idées d'un texte",
            competences: [
              { id: "central", nom: "Central Ideas and Details", fr: "Idée principale et détails importants" },
              { id: "evid-text", nom: "Command of Evidence (Textual)", fr: "Choisir la citation qui appuie une affirmation" },
              { id: "evid-quant", nom: "Command of Evidence (Quantitative)", fr: "Utiliser un tableau ou un graphique pour appuyer une affirmation" },
              { id: "infer", nom: "Inferences", fr: "Déduire la fin logique d'un texte" }
            ]
          },
          {
            id: "craft", nom: "Craft and Structure", fr: "Construction et structure du texte",
            competences: [
              { id: "words", nom: "Words in Context", fr: "Choisir le mot juste selon le contexte" },
              { id: "structure", nom: "Text Structure and Purpose", fr: "Structure du texte et intention de l'auteur" },
              { id: "cross", nom: "Cross-Text Connections", fr: "Mettre deux textes en relation" }
            ]
          },
          {
            id: "expr", nom: "Expression of Ideas", fr: "Expression des idées",
            competences: [
              { id: "synth", nom: "Rhetorical Synthesis", fr: "Utiliser des notes pour atteindre un objectif donné" },
              { id: "trans", nom: "Transitions", fr: "Choisir le bon mot de liaison" }
            ]
          },
          {
            id: "conv", nom: "Standard English Conventions", fr: "Règles de l'anglais écrit standard",
            competences: [
              { id: "bound", nom: "Boundaries", fr: "Ponctuation entre phrases et propositions" },
              { id: "form", nom: "Form, Structure, and Sense", fr: "Accords, temps, pronoms, modificateurs…" }
            ]
          }
        ]
      },
      {
        id: "math", nom: "Math", fr: "Mathématiques",
        info: "44 questions, 70 min, en 2 modules de 22 questions (35 min chacun). Desmos autorisé",
        domaines: [
          {
            id: "alg", nom: "Algebra", fr: "Algèbre",
            competences: [
              { id: "lin-1var", nom: "Linear equations in one variable", fr: "Équations du premier degré à une inconnue" },
              { id: "lin-2var", nom: "Linear equations in two variables", fr: "Équations linéaires à deux inconnues" },
              { id: "lin-fn", nom: "Linear functions", fr: "Fonctions affines" },
              { id: "systemes", nom: "Systems of two linear equations in two variables", fr: "Systèmes de deux équations linéaires" },
              { id: "inequations", nom: "Linear inequalities in one or two variables", fr: "Inéquations linéaires" }
            ]
          },
          {
            id: "adv", nom: "Advanced Math", fr: "Algèbre avancée",
            competences: [
              { id: "equiv", nom: "Equivalent expressions", fr: "Expressions équivalentes (factoriser, développer…)" },
              { id: "nonlin-eq", nom: "Nonlinear equations in one variable and systems of equations in two variables", fr: "Équations non linéaires et systèmes" },
              { id: "nonlin-fn", nom: "Nonlinear functions", fr: "Fonctions non linéaires (second degré, exponentielles…)" }
            ]
          },
          {
            id: "psda", nom: "Problem-Solving and Data Analysis", fr: "Résolution de problèmes et analyse de données",
            competences: [
              { id: "ratios", nom: "Ratios, rates, proportional relationships, and units", fr: "Ratios, taux, proportionnalité, unités" },
              { id: "pourcentages", nom: "Percentages", fr: "Pourcentages" },
              { id: "donnees-1var", nom: "One-variable data (distributions, center, spread)", fr: "Statistiques à une variable : répartition, moyenne, dispersion" },
              { id: "donnees-2var", nom: "Two-variable data (models and scatterplots)", fr: "Statistiques à deux variables : modèles et nuages de points" },
              { id: "probas", nom: "Probability and conditional probability", fr: "Probabilités et probabilités conditionnelles" },
              { id: "echantillons", nom: "Inference from sample statistics and margin of error", fr: "Tirer des conclusions d'un échantillon, marge d'erreur" },
              { id: "etudes", nom: "Evaluating statistical claims (observational studies and experiments)", fr: "Évaluer une conclusion statistique (études et expériences)" }
            ]
          },
          {
            id: "geo", nom: "Geometry and Trigonometry", fr: "Géométrie et trigonométrie",
            competences: [
              { id: "aires", nom: "Area and volume", fr: "Aires et volumes" },
              { id: "angles", nom: "Lines, angles, and triangles", fr: "Droites, angles et triangles" },
              { id: "trigo", nom: "Right triangles and trigonometry", fr: "Triangles rectangles et trigonométrie" },
              { id: "cercles", nom: "Circles", fr: "Cercles" }
            ]
          },
          {
            id: "bonus", nom: "Bonus", fr: "Compétence personnelle",
            competences: [
              { id: "desmos", nom: "Maîtrise de Desmos", fr: "Utiliser la calculatrice Desmos pour aller plus vite" }
            ]
          }
        ]
      },
      {
        id: "strat", nom: "Stratégie", fr: "Compétences transversales, valables pour les deux sections",
        info: "Compétences transversales",
        domaines: [
          {
            id: "transversal", nom: "Compétences transversales", fr: "Méthode de travail pendant l'épreuve",
            competences: [
              { id: "temps", nom: "Gestion du temps par module", fr: "Répartir son temps sur les questions d'un module" },
              { id: "elimination", nom: "Méthode d'élimination", fr: "Écarter les mauvaises réponses une à une" },
              { id: "relecture", nom: "Relecture", fr: "Garder du temps pour vérifier ses réponses" }
            ]
          }
        ]
      }
    ]
  },

  /* ---------------------------------------------------------------- IELTS */
  ielts: {
    nom: "IELTS",
    format: [
      "Listening ~30 min · Reading 60 min · Writing 60 min · Speaking 11 à 14 min.",
      "Score en bands de 0 à 9, par demi-band.",
      "Band global : moyenne des 4 épreuves, arrondie au demi-band le plus proche (une moyenne en .25 ou .75 est arrondie vers le haut)."
    ],
    sections: [
      {
        id: "listening", nom: "Listening", fr: "Compréhension orale",
        info: "4 parties, 40 questions, ~30 min",
        domaines: [
          {
            id: "parties", nom: "Parts", fr: "Les 4 parties de l'épreuve",
            competences: [
              { id: "p1", nom: "Part 1", fr: "Conversation de la vie quotidienne" },
              { id: "p2", nom: "Part 2", fr: "Monologue de la vie quotidienne" },
              { id: "p3", nom: "Part 3", fr: "Conversation en contexte d'études" },
              { id: "p4", nom: "Part 4", fr: "Cours magistral" }
            ]
          },
          {
            id: "types", nom: "Question types", fr: "Types de questions",
            competences: [
              { id: "qcm", nom: "Multiple choice", fr: "Questions à choix multiples" },
              { id: "matching", nom: "Matching", fr: "Associer des éléments" },
              { id: "labelling", nom: "Plan/map/diagram labelling", fr: "Légender un plan, une carte ou un schéma" },
              { id: "completion", nom: "Form/note/table/flow-chart/summary completion", fr: "Compléter un formulaire, des notes, un tableau, un organigramme ou un résumé" },
              { id: "phrases", nom: "Sentence completion", fr: "Compléter des phrases" },
              { id: "courtes", nom: "Short-answer questions", fr: "Réponses courtes" }
            ]
          }
        ]
      },
      {
        id: "reading", variante: "academic", nom: "Reading", fr: "Compréhension écrite (Academic)",
        info: "3 textes longs, 40 questions, 60 min",
        domaines: [
          {
            id: "types", nom: "Question types", fr: "Types de questions",
            competences: [
              { id: "qcm", nom: "Multiple choice", fr: "Questions à choix multiples" },
              { id: "tfng", nom: "True/False/Not Given", fr: "Vrai / Faux / Non mentionné (informations du texte)" },
              { id: "ynng", nom: "Yes/No/Not Given", fr: "Oui / Non / Non mentionné (opinions de l'auteur)" },
              { id: "headings", nom: "Matching headings", fr: "Associer un titre à chaque paragraphe" },
              { id: "m-info", nom: "Matching information", fr: "Retrouver le paragraphe qui contient une information" },
              { id: "m-features", nom: "Matching features", fr: "Associer des affirmations à des personnes, dates…" },
              { id: "m-endings", nom: "Matching sentence endings", fr: "Associer des débuts et des fins de phrases" },
              { id: "phrases", nom: "Sentence completion", fr: "Compléter des phrases" },
              { id: "resume", nom: "Summary/note/table/flow-chart completion", fr: "Compléter un résumé, des notes, un tableau ou un organigramme" },
              { id: "diagramme", nom: "Diagram label completion", fr: "Légender un schéma" },
              { id: "courtes", nom: "Short-answer questions", fr: "Réponses courtes" }
            ]
          },
          {
            id: "competences", nom: "Skills", fr: "Compétences de lecture",
            competences: [
              { id: "skimming", nom: "Skimming", fr: "Lecture rapide pour saisir l'idée générale" },
              { id: "scanning", nom: "Scanning", fr: "Repérer vite une information précise" },
              { id: "paraphrase", nom: "Paraphrase / synonymes", fr: "Reconnaître une idée reformulée avec d'autres mots" }
            ]
          }
        ]
      },
      {
        id: "reading", variante: "general", nom: "Reading", fr: "Compréhension écrite (General Training)",
        info: "3 sections, 40 questions, 60 min : textes de la vie courante et du travail",
        domaines: [
          {
            id: "sections-gt", nom: "Sections", fr: "Les 3 sections de l'épreuve",
            competences: [
              { id: "s1", nom: "Section 1", fr: "Textes courts de la vie quotidienne (annonces, horaires…)" },
              { id: "s2", nom: "Section 2", fr: "Textes liés au travail (contrats, consignes…)" },
              { id: "s3", nom: "Section 3", fr: "Un texte long d'intérêt général" }
            ]
          },
          {
            id: "types", nom: "Question types", fr: "Types de questions",
            competences: [
              { id: "qcm", nom: "Multiple choice", fr: "Questions à choix multiples" },
              { id: "tfng", nom: "True/False/Not Given", fr: "Vrai / Faux / Non mentionné (informations du texte)" },
              { id: "ynng", nom: "Yes/No/Not Given", fr: "Oui / Non / Non mentionné (opinions de l'auteur)" },
              { id: "headings", nom: "Matching headings", fr: "Associer un titre à chaque paragraphe" },
              { id: "m-info", nom: "Matching information", fr: "Retrouver le paragraphe qui contient une information" },
              { id: "m-features", nom: "Matching features", fr: "Associer des affirmations à des personnes, dates…" },
              { id: "m-endings", nom: "Matching sentence endings", fr: "Associer des débuts et des fins de phrases" },
              { id: "phrases", nom: "Sentence completion", fr: "Compléter des phrases" },
              { id: "resume", nom: "Summary/note/table/flow-chart completion", fr: "Compléter un résumé, des notes, un tableau ou un organigramme" },
              { id: "diagramme", nom: "Diagram label completion", fr: "Légender un schéma" },
              { id: "courtes", nom: "Short-answer questions", fr: "Réponses courtes" }
            ]
          },
          {
            id: "competences", nom: "Skills", fr: "Compétences de lecture",
            competences: [
              { id: "skimming", nom: "Skimming", fr: "Lecture rapide pour saisir l'idée générale" },
              { id: "scanning", nom: "Scanning", fr: "Repérer vite une information précise" },
              { id: "paraphrase", nom: "Paraphrase / synonymes", fr: "Reconnaître une idée reformulée avec d'autres mots" }
            ]
          }
        ]
      },
      {
        id: "writing", variante: "academic", nom: "Writing", fr: "Expression écrite (Academic)",
        info: "2 tâches, 60 min",
        domaines: [
          {
            id: "t1", nom: "Task 1", fr: "Au moins 150 mots, ~20 min : décrire un document visuel",
            competences: [
              { id: "graphique", nom: "Graph / chart", fr: "Décrire un graphique (courbes, barres, secteurs)" },
              { id: "tableau", nom: "Table", fr: "Décrire un tableau" },
              { id: "diagramme", nom: "Diagram", fr: "Décrire un diagramme" },
              { id: "carte", nom: "Map", fr: "Décrire une carte et son évolution" },
              { id: "processus", nom: "Process", fr: "Décrire les étapes d'un processus" }
            ]
          },
          {
            id: "t2", nom: "Task 2", fr: "Au moins 250 mots, ~40 min, compte double : un essai",
            competences: [
              { id: "opinion", nom: "Opinion essay", fr: "Donner son avis" },
              { id: "discussion", nom: "Discussion essay", fr: "Présenter deux points de vue" },
              { id: "probleme", nom: "Problem/solution essay", fr: "Causes ou problèmes, et solutions" },
              { id: "avantages", nom: "Advantages/disadvantages essay", fr: "Avantages et inconvénients" },
              { id: "deux-parties", nom: "Two-part question", fr: "Répondre à deux questions dans le même essai" }
            ]
          },
          {
            id: "criteres", nom: "Assessment criteria", fr: "Critères de notation",
            competences: [
              { id: "ta-tr", nom: "Task Achievement / Task Response", fr: "Répondre complètement à la consigne (Task 1 / Task 2)" },
              { id: "cc", nom: "Coherence and Cohesion", fr: "Organisation des idées et liens logiques" },
              { id: "lr", nom: "Lexical Resource", fr: "Richesse et précision du vocabulaire" },
              { id: "gra", nom: "Grammatical Range and Accuracy", fr: "Variété et correction de la grammaire" }
            ]
          }
        ]
      },
      {
        id: "writing", variante: "general", nom: "Writing", fr: "Expression écrite (General Training)",
        info: "2 tâches, 60 min",
        domaines: [
          {
            id: "t1", nom: "Task 1", fr: "Au moins 150 mots, ~20 min : rédiger une lettre",
            competences: [
              { id: "formelle", nom: "Formal letter", fr: "Lettre formelle" },
              { id: "semi-formelle", nom: "Semi-formal letter", fr: "Lettre semi-formelle" },
              { id: "informelle", nom: "Informal letter", fr: "Lettre informelle" }
            ]
          },
          {
            id: "t2", nom: "Task 2", fr: "Au moins 250 mots, ~40 min, compte double : un essai",
            competences: [
              { id: "opinion", nom: "Opinion essay", fr: "Donner son avis" },
              { id: "discussion", nom: "Discussion essay", fr: "Présenter deux points de vue" },
              { id: "probleme", nom: "Problem/solution essay", fr: "Causes ou problèmes, et solutions" },
              { id: "avantages", nom: "Advantages/disadvantages essay", fr: "Avantages et inconvénients" },
              { id: "deux-parties", nom: "Two-part question", fr: "Répondre à deux questions dans le même essai" }
            ]
          },
          {
            id: "criteres", nom: "Assessment criteria", fr: "Critères de notation",
            competences: [
              { id: "ta-tr", nom: "Task Achievement / Task Response", fr: "Répondre complètement à la consigne (Task 1 / Task 2)" },
              { id: "cc", nom: "Coherence and Cohesion", fr: "Organisation des idées et liens logiques" },
              { id: "lr", nom: "Lexical Resource", fr: "Richesse et précision du vocabulaire" },
              { id: "gra", nom: "Grammatical Range and Accuracy", fr: "Variété et correction de la grammaire" }
            ]
          }
        ]
      },
      {
        id: "speaking", nom: "Speaking", fr: "Expression orale",
        info: "3 parties, 11 à 14 min",
        domaines: [
          {
            id: "parts", nom: "Parts", fr: "Les 3 parties de l'entretien",
            competences: [
              { id: "p1", nom: "Part 1", fr: "4 à 5 min : questions sur toi" },
              { id: "p2", nom: "Part 2", fr: "3 à 4 min : cue card, 1 min de préparation puis jusqu'à 2 min de parole" },
              { id: "p3", nom: "Part 3", fr: "4 à 5 min : discussion plus abstraite" }
            ]
          },
          {
            id: "criteres", nom: "Assessment criteria", fr: "Critères de notation",
            competences: [
              { id: "fc", nom: "Fluency and Coherence", fr: "Aisance et enchaînement des idées" },
              { id: "lr", nom: "Lexical Resource", fr: "Richesse et précision du vocabulaire" },
              { id: "gra", nom: "Grammatical Range and Accuracy", fr: "Variété et correction de la grammaire" },
              { id: "pron", nom: "Pronunciation", fr: "Prononciation" }
            ]
          }
        ]
      }
    ]
  }
};
