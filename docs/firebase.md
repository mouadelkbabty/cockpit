# Activer la synchronisation

Sans cette étape, Cockpit fonctionne déjà : les données restent dans le navigateur de l'appareil.
Avec elle, tu retrouves les mêmes données sur ton téléphone et ton ordinateur après connexion avec ton compte Google.

Tout se fait dans l'offre gratuite de Firebase (« Spark »). Aucune carte bancaire n'est demandée.

## 1. Créer le projet

1. Ouvre <https://console.firebase.google.com> et connecte-toi avec ton compte Google.
2. « Créer un projet », nomme-le `cockpit`. Google Analytics : désactive-le, il ne sert à rien ici.

## 2. Activer la connexion Google

1. Menu de gauche : Créer, puis Authentication, puis « Commencer ».
2. Onglet « Mode de connexion » : choisis Google, active-le, enregistre.
3. Onglet « Paramètres », puis « Domaines autorisés » : ajoute `mouadelkbabty.github.io`.

## 3. Créer la base de données

1. Menu de gauche : Créer, puis Firestore Database, puis « Créer une base de données ».
2. Emplacement : `eur3 (Europe)`. Mode : « production ».
3. Onglet « Règles » : remplace tout le contenu par celui de [`firestore.rules`](firestore.rules),
   en mettant ton adresse Google à la place de `TON_ADRESSE_GOOGLE`. Clique sur « Publier ».

Ne mets pas ton adresse dans le fichier du dépôt : il est public. Elle va seulement dans la console Firebase.

## 4. Relier le site au projet

1. Roue dentée en haut à gauche, puis « Paramètres du projet ».
2. En bas, « Vos applications » : clique sur l'icône `</>` (Web), nomme l'application `cockpit`, sans Firebase Hosting.
3. Firebase affiche un bloc `const firebaseConfig = { ... }`. Copie l'objet entre accolades.
4. Dans le dépôt, ouvre `src/firebase-config.js` et remplace la dernière ligne :

   ```js
   export default null
   ```

   par :

   ```js
   export default {
     apiKey: '...',
     authDomain: '...',
     projectId: '...',
     storageBucket: '...',
     messagingSenderId: '...',
     appId: '...',
   }
   ```

5. Enregistre (commit sur `main`). Le site se remet en ligne tout seul en une à deux minutes.

Ces identifiants ne sont pas des secrets : ils désignent ton projet, ils n'ouvrent rien.
Ce qui protège tes données, ce sont la connexion Google et les règles de l'étape 3.

## 5. Reprendre les données déjà saisies

Si tu avais commencé sans synchronisation, fais-le dans cet ordre :

1. Avant l'étape 4 : Réglages, « Exporter mes données ».
2. Après l'étape 4 : connecte-toi, puis Réglages, « Importer un fichier ».

## En cas de problème

- « Ce site n'est pas dans les domaines autorisés » : reprends l'étape 2.3.
- « Ce compte n'a pas accès aux données » : l'adresse des règles (étape 3.3) n'est pas celle du compte connecté.
