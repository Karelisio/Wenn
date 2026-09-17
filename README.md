# Wenn 🌸

Application de suivi de cycle menstruel, pensée pour être utilisée **à deux** : les
données (règles, symptômes, humeur, notes) sont synchronisées en temps réel entre le
compte de la titulaire du cycle et celui de son/sa partenaire.

- **Frontend** : React + TypeScript (Vite)
- **App native** : Capacitor (Android + iOS), avec notifications locales fiables
  même app fermée (`@capacitor/local-notifications`)
- **Backend** : Supabase (Postgres + Auth + Realtime + Storage)
- **Design** : Material Design 3, thématisation dynamique "Material You" à partir
  d'une image choisie par l'utilisatrice

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Modèle de comptes](#modèle-de-comptes)
- [Mise en route (développement local)](#mise-en-route-développement-local)
- [Configuration Supabase](#configuration-supabase)
- [Application native (Capacitor)](#application-native-capacitor)
- [CI/CD — GitHub Actions](#cicd--github-actions)
- [Signature Android — génération du keystore](#signature-android--génération-du-keystore)
- [Secrets GitHub à configurer](#secrets-github-à-configurer)
- [Sécurité & vie privée](#sécurité--vie-privée)

## Fonctionnalités

- Enregistrement des règles (début/fin implicite, intensité du flux : léger / moyen /
  abondant)
- Prédiction du prochain cycle et de la fenêtre d'ovulation à partir de l'historique
- Calendrier visuel mensuel (règles, prédiction, fenêtre fertile, ovulation)
- Suivi des symptômes (crampes, fatigue, maux de tête, ballonnements, etc.)
- Suivi de l'humeur (emojis)
- Notes libres par jour
- Notifications natives avant le début des règles prévues
- Graphique de tendance de la régularité du cycle sur plusieurs mois
- Mode **Solo** (aucun compte, données 100 % locales) ou **Duo** (compte partagé,
  synchronisé), au choix au premier lancement et modifiable depuis Réglages
- Thème clair / sombre / système, en plus de la thématisation Material You
- Sauvegarde : export/import JSON de l'historique, et mirroir local silencieux en mode
  duo (filet de sécurité en cas de perte d'accès au compte)
- Vérification et téléchargement des mises à jour directement depuis Réglages

> La V1 ne couvre volontairement pas les fonctionnalités liées à la fertilité au-delà
> de l'estimation indicative de la fenêtre fertile affichée dans le calendrier.

## Modèle de comptes

Un « couple » relie deux comptes Supabase :

- **Titulaire** (`owner`) : peut tout lire et tout modifier (règles, symptômes,
  humeur, notes).
- **Partenaire** (`partner`) : accès en **lecture seule** aux données de cycle, et
  peut ajouter des « mots doux »/rappels visibles par la titulaire (table
  `partner_notes`), sans jamais pouvoir modifier les données de cycle elles-mêmes.

La liaison se fait via un **code d'invitation** à 8 caractères, généré automatiquement
à la création de l'espace par la titulaire, et visible dans ses réglages.

## Mise en route (développement local)

```bash
npm install
cp .env.example .env
# renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env
npm run dev
```

## Configuration Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécute l'intégralité du fichier [`supabase/schema.sql`](./supabase/schema.sql).
   Il crée :
   - les tables `profiles`, `couples`, `cycle_days`, `partner_notes` ;
   - toutes les policies **Row Level Security** (la titulaire écrit, le/la
     partenaire lit) ;
   - la fonction sécurisée `join_couple(invite_code)` pour lier un compte sans
     jamais exposer les `id` des autres utilisateurs ;
   - l'activation de **Realtime** sur les tables partagées ;
   - le bucket de **Storage** `theme-images` (public en lecture, écriture réservée
     aux utilisateurs authentifiés) pour l'image de fond du thème.
3. Dans **Authentication > Providers**, l'authentification par e-mail (lien
   magique / OTP) est activée par défaut — aucune configuration supplémentaire
   n'est nécessaire pour la V1.
4. Dans **Authentication > URL Configuration**, ajoute l'URL de ton frontend
   (ex. `http://localhost:5173`, puis l'URL de production) à la liste des
   *Redirect URLs*.
5. Récupère `Project URL` et `anon public key` dans **Project Settings > API**
   et renseigne-les dans `.env` (local) et dans les secrets GitHub (CI, voir plus
   bas).

Toutes les données sont protégées par RLS : un utilisateur ne peut **jamais**
accéder aux données d'un couple auquel il n'appartient pas, et seule la titulaire
peut écrire dans `cycle_days`.

## Application native (Capacitor)

```bash
npm run build
npx cap sync

# Android (nécessite Android Studio / SDK)
npx cap open android

# iOS (nécessite macOS + Xcode)
npx cap open ios
```

Les notifications locales (`@capacitor/local-notifications`) sont programmées via
le système d'alarme natif (AlarmManager sur Android, `UNUserNotificationCenter`
sur iOS) : elles se déclenchent même si l'application est fermée. La permission
est demandée automatiquement lors de l'activation des rappels dans **Réglages**.

## CI/CD — GitHub Actions

Le workflow [`.github/workflows/build-android.yml`](./.github/workflows/build-android.yml)
se déclenche à chaque push sur `main` et à chaque tag `v*` (ex. `v1.0.0`), ou
manuellement (`workflow_dispatch`). Il :

1. installe les dépendances (`npm ci`) ;
2. build le frontend React (`npm run build`), avec les variables Supabase
   injectées depuis les secrets GitHub ;
3. synchronise Capacitor (`npx cap sync android`) ;
4. décode le secret `ANDROID_KEYSTORE_BASE64` en fichier `.keystore` ;
5. build l'APK Android **release, signé**, via Gradle (`./gradlew assembleRelease`) ;
6. supprime le keystore décodé du runner ;
7. publie l'APK comme **artifact téléchargeable** (30 jours) sur chaque run, et
   comme **GitHub Release** (avec le fichier `.apk` attaché) quand le push est un
   tag `v*`.

L'APK étant toujours signé avec la **même clé**, il peut être installé par-dessus
une version précédente sans désinstallation, sur les deux téléphones.

**Versioning & mise à jour in-app.** Chaque push sur `main` crée et pousse
automatiquement le tag `v*` suivant (patch +1 depuis le dernier tag existant —
`v1.0.0`, `v1.0.1`, ...), ce qui déclenche une Release GitHub avec l'APK signé
attaché. Aucune action manuelle n'est nécessaire : le bouton **Réglages → Mises à
jour** compare la version installée à la dernière Release publiée et propose le
téléchargement si elle diffère. Pour un vrai bump majeur/mineur (ex. `v2.0.0`),
pousse le tag toi-même — les auto-tags suivants repartiront de lui :

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

## Signature Android — génération du keystore

À faire **une seule fois**, en local (garde précieusement le fichier généré et
son mot de passe : ils ne doivent **jamais** être perdus, sous peine de ne plus
pouvoir publier de mise à jour sur le même `applicationId`) :

```bash
keytool -genkeypair -v \
  -keystore wenn-release.keystore \
  -alias wenn-key \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

`keytool` te demandera un mot de passe de keystore, un mot de passe de clé
(peut être identique) et quelques informations (nom, organisation...).

Encode ensuite le fichier en base64, pour le stocker en secret GitHub :

```bash
base64 -w0 wenn-release.keystore > wenn-release.keystore.base64
# macOS : base64 -i wenn-release.keystore -o wenn-release.keystore.base64
```

Copie le **contenu** de `wenn-release.keystore.base64` dans le secret
`ANDROID_KEYSTORE_BASE64` (voir ci-dessous). Ne commite **jamais** le fichier
`.keystore` ni sa version base64 dans le dépôt (ils sont exclus par `.gitignore`).

## Secrets GitHub à configurer

Dans **Settings > Secrets and variables > Actions** du dépôt, crée les secrets
suivants (noms exacts, sensibles à la casse) :

| Secret                     | Description                                                      |
| --------------------------- | ------------------------------------------------------------------ |
| `VITE_SUPABASE_URL`         | URL du projet Supabase (`Project Settings > API`)                 |
| `VITE_SUPABASE_ANON_KEY`    | Clé publique `anon` du projet Supabase                             |
| `ANDROID_KEYSTORE_BASE64`   | Contenu base64 du fichier `wenn-release.keystore` généré ci-dessus |
| `ANDROID_KEYSTORE_PASSWORD` | Mot de passe du keystore (`-storepass` lors de la génération)      |
| `ANDROID_KEY_ALIAS`         | Alias de la clé (`wenn-key` dans l'exemple ci-dessus)               |
| `ANDROID_KEY_PASSWORD`      | Mot de passe de la clé (`-keypass`, peut être identique au précédent) |

Une fois ces six secrets renseignés, chaque push sur `main` produit un APK signé
téléchargeable depuis l'onglet **Actions > Build Android APK > Artifacts**, et
chaque tag `v*` publie en plus une **Release** GitHub avec l'APK attaché.

## Sécurité & vie privée

- Toutes les données de cycle sont protégées par **Row Level Security** côté
  Supabase : seuls les deux comptes d'un même couple peuvent lire leurs données,
  et seule la titulaire peut les modifier.
- Aucune donnée n'est accessible à un tiers : pas d'API publique, pas de
  partage par défaut.
- Le keystore de signature et les identifiants Supabase ne transitent jamais en
  clair dans le dépôt : ils sont fournis uniquement via les secrets GitHub
  Actions (CI) ou un fichier `.env` local ignoré par Git.
- L'authentification se fait par lien magique (pas de mot de passe stocké côté
  client).
