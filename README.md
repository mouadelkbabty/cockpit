# Cockpit

Tableau de bord personnel : épargne, candidatures et sport au même endroit, sur téléphone et sur ordinateur.

Le site est en ligne sur <https://mouadelkbabty.github.io/cockpit/>. Ce dépôt ne contient que le code : les données
restent dans ton navigateur, ou dans ton compte après avoir activé la synchronisation.

## Utiliser

- Onglet **Aujourd'hui** : ce qui demande une action le jour même.
- Onglet **Argent** : épargne et prévision, versement du mois, comptes, budget, échéances.
- Onglet **Emploi** : candidatures par étape, relances à faire.
- Onglet **Sport** : séance du jour, charges de la dernière fois, progression, poids.
- **Réglages** : import, export et effacement des données.

Pour l'installer sur téléphone : ouvre le site, puis « Sur l'écran d'accueil » (iPhone, menu Partager de Safari)
ou « Installer l'application » (Android, menu de Chrome).

## Synchroniser téléphone et ordinateur

Suis [docs/firebase.md](docs/firebase.md). Une dizaine de minutes, gratuit.

## Développer

```sh
npm install
npm run dev     # site local avec rechargement
npm test        # tests des calculs
npm run build   # site prêt à publier dans dist/
```

Chaque envoi sur `main` lance les tests puis met le site en ligne (`.github/workflows/deploy.yml`).
La conception est décrite dans [docs/conception.md](docs/conception.md).
