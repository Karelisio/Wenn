# Wenn 🌸

Application de suivi de cycle menstruel, pensée pour être utilisée **à deux** : les
données (règles, douleurs, symptômes, humeur, notes) sont synchronisées en temps réel
entre le compte de la titulaire du cycle et celui de son/sa partenaire.

- **Frontend** : React + TypeScript (Vite)
- **App native** : Capacitor (Android + iOS), avec notifications locales fiables
  même app fermée (`@capacitor/local-notifications`), widgets d'écran d'accueil
  Android, et mise à jour installable directement depuis l'app
- **Backend** : Supabase (Postgres + Auth + Realtime + Storage)
- **Design** : Material Design 3, thématisation dynamique "Material You" (suit le
  fond d'écran sur Android, ou une image choisie sur iOS/web)

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Modèle de comptes](#modèle-de-comptes)
- [Mise en route (développement local)](#mise-en-route-développement-local)
- [Configuration Supabase](#configuration-supabase)
- [Configuration de l'envoi d'e-mails (SMTP)](#configuration-de-lenvoi-demails-smtp)
- [Application native (Capacitor)](#application-native-capacitor)
- [Widgets d'écran d'accueil (Android)](#widgets-décran-daccueil-android)
- [CI/CD — GitHub Actions](#cicd--github-actions)
- [Signature Android — génération du keystore](#signature-android--génération-du-keystore)
- [Secrets GitHub à configurer](#secrets-github-à-configurer)
- [Sécurité & vie privée](#sécurité--vie-privée)

## Fonctionnalités

- Enregistrement des règles (intensité du flux : léger / moyen / abondant)
- Suivi des douleurs (mêmes 3 niveaux que le flux), des symptômes (crampes,
  fatigue, maux de tête, ballonnements, seins sensibles, acné, dos douloureux,
  nausées, sécrétions, rapport sexuel, autre douleur) et de l'humeur (emoji)
- Notes libres par jour
- Calendrier visuel mensuel : règles, prédiction, fenêtre fertile, ovulation, et
  un résumé en emoji de ce qui a été renseigné chaque jour
- Prédiction du prochain cycle et de la fenêtre d'ovulation à partir de l'historique
- Tendances : graphiques en courbes de la régularité du cycle, du flux, des
  douleurs, et un comparatif des deux
- Notifications natives avant le début des règles prévues
- Deux widgets d'écran d'accueil Android au choix (voir plus bas)
- Mode **Solo** (aucun compte, données 100 % locales) ou **Duo** (compte partagé,
  synchronisé), au choix au premier lancement et modifiable depuis Réglages
- Thème clair / sombre / système, en plus de la thématisation Material You
- Sauvegarde : export/import JSON de l'historique, et mirroir local silencieux en
  mode duo (filet de sécurité en cas de perte d'accès au compte)
- Vérification, téléchargement et installation des mises à jour directement
  depuis Réglages (pas de passage par le navigateur)

> La V1 ne couvre volontairement pas les fonctionnalités liées à la fertilité au-delà
> de l'estimation indicative de la fenêtre fertile affichée dans le calendrier.

## Modèle de comptes

Un « couple » relie deux comptes Supabase :

- **Titulaire** (`owner`) : peut tout lire et tout modifier (règles, douleurs,
  symptômes, humeur, notes), et renommer l'espace partagé.
- **Partenaire** (`partner`) : accès en **lecture seule** aux données de cycle, et
  peut ajouter des « mots doux »/rappels visibles par la titulaire (table
  `partner_notes`), sans jamais pouvoir modifier les données de cycle elles-mêmes.

La liaison se fait via un **code d'invitation** à 8 caractères, généré automatiquement
à la création de l'espace par la titulaire, et visible dans ses réglages. Réglages →
Couple lié affiche l'état de la synchronisation et permet de quitter l'espace (pour
changer de rôle) ou de renommer l'espace partagé.

## Mise en route (développement local)

```bash
npm install
cp .env.example .env
# renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env
npm run dev
```

## Configuration Supabase

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécute l'intégralité du fichier [`supabase/schema.sql`](./supabase/schema.sql)
   **une seule fois, sur un projet neuf**. Il crée :
   - les tables `profiles`, `couples`, `cycle_days`, `partner_notes` ;
   - toutes les policies **Row Level Security** (la titulaire écrit, le/la
     partenaire lit) ;
   - les fonctions sécurisées `join_couple(invite_code)` et `leave_couple()` ;
   - l'activation de **Realtime** sur les tables partagées ;
   - le bucket de **Storage** `theme-images` (public en lecture, écriture réservée
     aux utilisateurs authentifiés) pour l'image de fond du thème.

   Sur un projet **déjà déployé**, ne rejoue jamais tout le fichier : colle
   uniquement les blocs de migration additive ajoutés en fin de fichier au fil
   des versions (chacun commence par un commentaire expliquant ce qu'il fait),
   dans le SQL Editor.
3. Dans **Authentication > Providers**, l'authentification par e-mail (lien
   magique / OTP) est activée par défaut. En usage réel, configure un SMTP
   personnalisé (voir section suivante) : le SMTP par défaut de Supabase a une
   limite de débit trop basse pour un usage à deux.
4. Dans **Authentication > URL Configuration**, ajoute l'URL de ton frontend
   (ex. `http://localhost:5173`, puis l'URL de production) à la liste des
   *Redirect URLs*.
5. Récupère `Project URL` et `anon public key` dans **Project Settings > API**
   et renseigne-les dans `.env` (local) et dans les secrets GitHub (CI, voir plus
   bas).

Toutes les données sont protégées par RLS : un utilisateur ne peut **jamais**
accéder aux données d'un couple auquel il n'appartient pas, et seule la titulaire
peut écrire dans `cycle_days`.

## Configuration de l'envoi d'e-mails (SMTP)

Le SMTP intégré de Supabase limite l'envoi à quelques e-mails par heure — largement
insuffisant dès que deux personnes se connectent régulièrement. Symptôme typique :
erreur **"email rate limit exceeded"** au moment de demander le lien magique.

Dans **Authentication > Settings > SMTP Settings**, active "Enable Custom SMTP" et
renseigne un fournisseur externe, par exemple avec un compte Gmail :

1. Active la validation en deux étapes sur le compte Gmail à utiliser, puis génère
   un **mot de passe d'application** (myaccount.google.com > Sécurité > Mots de
   passe des applications).
2. Renseigne dans Supabase : `Host` = `smtp.gmail.com`, `Port` = `587`, `Username`
   = l'adresse Gmail complète, `Password` = le mot de passe d'application (16
   caractères, sans espaces), `Sender email` = la même adresse Gmail.
3. Sauvegarde, puis utilise le bouton **"Send test email"** pour vérifier la
   configuration indépendamment du flux de connexion de l'app.

Si la connexion échoue ensuite avec une erreur **HTTP 504**, c'est un timeout entre
Supabase et le serveur SMTP : revérifie le mot de passe d'application (pas de
troncature/espace lors du copier-coller), essaie le port 587 si 465 était utilisé
(ou inversement), et confirme via "Send test email" que le SMTP répond.

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

Les mises à jour (Réglages → Mises à jour) sont téléchargées via le pont réseau
natif de Capacitor (`CapacitorHttp`, pas `fetch()`) : les assets de release
GitHub ne renvoient pas d'en-têtes CORS, ce qu'une requête `fetch()` classique
dans la WebView refuserait silencieusement. L'APK est ensuite installé via
l'installeur système (`ApkInstallerPlugin`).

## Widgets d'écran d'accueil (Android)

Deux widgets sont disponibles au choix dans le sélecteur de widgets Android
(appui long sur l'écran d'accueil > Widgets > Wenn) :

- **Jours restants** : le nombre de jours avant les prochaines règles, en texte.
- **Orbite** : reprend le motif de l'icône de l'app (anneau + point). Le point
  avance dans l'anneau au fil du cycle, comme une aiguille d'horloge lente (un
  widget ne peut pas animer en continu, il se rafraîchit à chaque changement de
  donnée), avec le nombre de jours restants affiché au centre.

Les deux se mettent à jour automatiquement à chaque changement de données (Solo
comme Duo), et périodiquement en secours (~3h) si l'app n'est pas rouverte.

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

**Versioning, changelog & mise à jour in-app.** Chaque push sur `main` crée et
pousse automatiquement le tag `v*` suivant (patch +1 depuis le dernier tag
existant). Les notes de la Release GitHub sont extraites de la section
`## Non publié` de [`CHANGELOG.md`](./CHANGELOG.md) : ajoute une puce sous cette
section à chaque changement visible pour l'utilisatrice avant de pousser sur
`main`. Le workflow archive ensuite cette section sous `## vX.Y.Z — DATE` et la
repousse sur `main` (un `git pull` peut donc être nécessaire avant un nouveau
push). Le bouton **Réglages → Mises à jour** compare la version installée à la
dernière Release publiée, affiche ces notes, et propose le téléchargement si
elle diffère. Pour un vrai bump majeur/mineur (ex. `v2.0.0`), pousse le tag
toi-même — les auto-tags suivants repartiront de lui :

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
