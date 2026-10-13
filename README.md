# Mercan Voyages

Site français d'une agence de voyage tunisienne, réalisé avec Express, des vues
HTML/EJS, CSS et JavaScript natif, et MongoDB Atlas.

## Arborescence

```text
admin/                 Interface d'administration et gestion des contenus
db/
  mongo.js             Connexion Atlas, index et identifiants séquentiels
  session-store.js     Sessions Express persistées dans MongoDB
  seed.js              Création des données de démonstration et du compte admin
  migrate-mysql-to-mongo.js  Import ponctuel des données MySQL existantes
  schema.sql           Ancien schéma MySQL, conservé pour l’import
middleware/            Contrôles de session et de rôle
public/
  css/                 Styles responsives et thèmes clair/sombre
  js/                  Interactions accessibles côté navigateur
  images/              Logo remplaçable et images locales
  uploads/             Images ajoutées depuis l'administration
routes/                Pages publiques, authentification et API
views/
  admin/               Vues de connexion et de gestion
  partials/            En-tête, navigation et pied de page
  pages/               Pages rendues côté serveur
server.js              Configuration Express et démarrage HTTP
.env.example           Configuration locale documentée
```

## Données MongoDB

La base configurée par `MONGODB_DB_NAME` utilise les collections `users`,
`hotels`, `packages`, `requests`, `contact_messages`,
`newsletter_subscribers`, `slides`, `partners` et `sessions`. Les galeries,
programmes et listes sont enregistrés comme tableaux/documents MongoDB ; un
prix `null` signifie « Sur demande ». Des index uniques protègent les e-mails
et les slugs. Les identifiants numériques sont conservés pour maintenir les
liens entre demandes, comptes et offres.

## Installation et lancement

1. Créer un cluster MongoDB Atlas, un utilisateur de base de données et
   autoriser l’adresse IP du serveur dans l’Access List Atlas.
2. Copier `.env.example` en `.env`, puis renseigner `MONGODB_URI`,
   `MONGODB_DB_NAME`, un `SESSION_SECRET` long et un mot de passe
   administrateur robuste. Si le mot de passe Atlas contient des caractères
   spéciaux, encoder ceux-ci dans l’URI.
3. Installer les dépendances : `npm install`.
4. Insérer les exemples : `npm run seed`.
5. Lancer le serveur : `npm start`, puis ouvrir `http://localhost:3000`.

L'administration est accessible à `/admin`. Le premier compte administrateur
est créé par la commande seed à partir de `ADMIN_EMAIL` et `ADMIN_PASSWORD`.

## Importer l’ancienne base MySQL

Pour conserver les comptes, offres, demandes, messages, inscriptions, slides,
partenaires et sessions existants, gardez temporairement l’ancienne base
MySQL accessible. Dans `.env`, renseignez aussi `DB_HOST`, `DB_PORT`, `DB_NAME`,
`DB_USER` et `DB_PASSWORD`, puis exécutez **avant** le seed :

```bash
npm run migrate:mysql-to-mongo
npm run seed
```

La commande de migration copie les identifiants et dates existants et peut
être relancée après une importation partielle. Elle ne supprime ni ne modifie
les données MySQL. Après vérification des données sur Atlas, les variables
`DB_*` et MySQL peuvent être retirés du déploiement. `mysql2` reste uniquement
installé pour cet outil d’import.

## Déploiement sur Vercel

`server.js` exporte l’application Express pour permettre sa détection et son
déploiement automatique sur Vercel. Les fichiers présents dans `public/` sont
servis par Vercel ; les nouvelles images envoyées depuis l’administration sont
enregistrées dans Vercel Blob plutôt que sur le disque temporaire des Functions.

1. Pousser le projet sur un dépôt Git et l’importer depuis le tableau de bord
   Vercel. Le framework Express est détecté automatiquement.
2. Créer un store Blob public dans **Storage** et le connecter au projet
   Vercel pour activer l’authentification OIDC des uploads. Pour le
   développement local, renseigner `BLOB_READ_WRITE_TOKEN` dans `.env`.
3. Ajouter dans **Settings > Environment Variables** : `MONGODB_URI`,
   `MONGODB_DB_NAME`, `SESSION_SECRET` (au moins 32 caractères),
   `ADMIN_EMAIL` et `ADMIN_PASSWORD`. Vercel configure l’environnement de
   production automatiquement. Ne pas ajouter de secrets au dépôt Git ni les
   envoyer dans un message.
4. Vérifier que la liste d’accès réseau Atlas autorise les connexions depuis
   le déploiement, puis lancer le déploiement.
5. Exécuter `npm run seed` une seule fois depuis un environnement local
   connecté à Atlas afin de créer les exemples et le compte administrateur.

Les uploads de l’administration sont limités à 4 Mo pour rester sous la limite
de requête des Functions Vercel. Si Blob n’est pas configuré, l’endpoint
d’upload renvoie une erreur explicite au lieu de perdre les fichiers dans le
disque éphémère.

La limitation des requêtes utilise le stockage mémoire d’Express : sur Vercel,
elle s’applique par instance et non globalement entre toutes les Functions.
