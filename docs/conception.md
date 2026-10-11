# Conception

## À quoi sert Cockpit

Un seul endroit, sur téléphone et sur ordinateur, pour répondre chaque jour à trois questions :
où en est mon épargne, où en sont mes candidatures, quelle séance je fais aujourd'hui.
L'écran d'accueil rassemble ce qui demande une action le jour même.

## Choix

| Sujet | Choix | Raison |
| --- | --- | --- |
| Hébergement | GitHub Pages (branche `gh-pages`, remplie par GitHub Actions) | Gratuit, sans serveur à entretenir |
| Interface | Vue 3 et Vite | Léger, un seul paquet à installer côté navigateur |
| Données | Sur l'appareil par défaut, Firestore après configuration | Le site est utilisable tout de suite ; la synchronisation s'ajoute sans rien réécrire |
| Connexion | Compte Google (Firebase Authentication) | Pas de mot de passe à gérer |
| Hors réseau | Service worker (vite-plugin-pwa) et cache local Firestore | Utilisable à la salle sans réseau |
| Coût | Zéro : aucune interface payante, aucun appel à un service tiers en mode local | Contrainte de départ |

Le dépôt est public. Il ne contient donc que du code : aucune donnée personnelle, aucun montant.
Les données d'origine s'importent depuis un fichier JSON gardé hors du dépôt.

## Organisation du code

- `src/lib/` : calculs sans interface (dates, épargne, échéances, candidatures, sport, mouvement). Couverts par les tests de `tests/`.
- `src/store/` : une seule interface de stockage, deux implémentations (`local.js`, `firestore.js`). Le reste du code ignore laquelle est active.
- `src/components/` : feuille modale, formulaire générique, courbe, icônes.
- `src/views/` : un fichier par onglet.

### Données

Chaque collection est une liste de documents identifiés. En mode synchronisé elles vivent sous `users/{uid}/`.

| Collection | Contenu |
| --- | --- |
| `settings` | `goal` (objectif d'épargne, versement mensuel) et `program` (séances et semaine type) |
| `accounts` | Comptes : type, solde, taux, plafond |
| `budget` | Lignes mensuelles : revenu ou dépense, mois de fin éventuel |
| `deadlines` | Échéances, uniques ou répétées, avec les occurrences cochées |
| `applications` | Candidatures : étape, dates, prochaine action |
| `sessions` | Une séance par jour : séries de chaque exercice |
| `weights` | Une pesée par jour |

### Règles de calcul

- Épargne : somme des comptes marqués « dans l'épargne ».
- Versement du mois : va d'abord au livret le mieux rémunéré, dans la limite de son plafond.
- Prévision : épargne actuelle, plus le versement mensuel, plus les sommes « à recevoir » non cochées.
- Candidature à relancer : date prévue atteinte, sinon 7 jours sans mouvement après l'envoi.
- Séance du jour : celle de la semaine type, avec les charges de la dernière fois en repère.

## Interface

Idiome Apple en mode sombre : police système, grands titres, listes groupées, barre d'onglets translucide.
Une couleur par domaine (vert argent, bleu emploi, orange sport), vérifiée pour le daltonisme sur fond noir.

Les feuilles modales sont animées par un ressort plutôt que par une durée fixe :
elles suivent le doigt, gardent la vitesse du geste au relâchement, résistent quand on les tire vers le haut
et se rattrapent en plein mouvement. Avec « réduire les animations », elles apparaissent en fondu.

## Limites connues

- Le mode synchronisé n'a pas pu être essayé avant la mise en ligne : il demande un projet Firebase, à créer en suivant `docs/firebase.md`.
- Une saisie de séance en cours n'est pas rafraîchie si la même séance est modifiée au même moment sur un autre appareil.
- Renommer un exercice dans le programme coupe son historique.
