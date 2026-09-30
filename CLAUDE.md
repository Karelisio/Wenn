# Wenn — mémo pour Claude

App de suivi de cycle menstruel pour une seule utilisatrice réelle (la copine de
l'utilisateur), en mode **Duo** avec son partenaire. Utilisateur non technique :
il relaie des retours/screenshots de sa copine, teste peu lui-même. **Toujours
répondre en français, court et direct.**

## Stack

- React + TypeScript + Vite, `HashRouter` (nécessaire pour Capacitor : pas de
  serveur pour gérer les routes côté fichier `file://`).
- Capacitor 7 (Android + iOS). Android est la plateforme réellement utilisée et
  testée par les utilisatrices ; iOS compile mais n'est quasiment jamais vérifié.
- Supabase : Postgres + Auth (lien magique) + Realtime + Storage.
- Material Design 3 / Material You (thème dynamique à partir du fond d'écran
  Android, ou d'une image choisie sur iOS/web).
- `recharts` pour les graphiques de Tendances.
- CI/CD : GitHub Actions build + signe l'APK, auto-tag et release à chaque push
  sur `main`.

## Repo map

```
src/
  context/       CoupleContext (mode Duo), SoloContext (mode Solo, localStorage),
                 CycleDataContext (façade commune aux deux), AuthContext, ModeContext,
                 ThemeModeContext (clair/sombre/système)
  pages/         Calendar, Trends, Settings, Login, Onboarding, ModeSelect
  components/    DaySheet (saisie du jour), BottomNav, WidgetSync (pousse les
                 données vers les widgets Android), OrbitMark (logo)
  lib/           cyclePredictions (prédiction cycle/ovulation), backup (export/
                 import JSON), appUpdate (mise à jour in-app), widgetSync,
                 materialYou, wallpaperColor, notifications, supabase, deepLink
  types/index.ts Types + constantes partagées (emoji, labels, options de saisie)

android/app/src/main/java/io/karelisio/wenn/
  MainActivity.java        enregistre les plugins Capacitor custom
  WidgetDataPlugin.java    pont JS -> widgets (SharedPreferences + refresh)
  WennWidgetProvider.java  widget "jours restants" (texte)
  WennOrbitWidgetProvider.java  widget "Orbite" (anneau + point, motif de l'icône)
  ApkInstallerPlugin.java  lance l'installeur système pour l'APK téléchargé
  WallpaperColorPlugin.java lit la couleur dominante du fond d'écran (thème)

supabase/schema.sql   schéma complet + policies RLS + migrations additives en fin de fichier
CHANGELOG.md           source des notes de version (voir workflow ci-dessous)
```

## Modèle de données / comptes

- **Solo** : aucun compte, tout en `localStorage` (`SoloContext`).
- **Duo** : deux comptes Supabase liés par un code d'invitation. La **titulaire**
  (`owner`) lit/écrit tout ; le/la **partenaire** (`partner`) lit tout et peut
  ajouter des notes (`partner_notes`), jamais modifier les données de cycle.
  RLS Postgres fait respecter ça, pas seulement l'UI.
- `CycleDay` (table `cycle_days`) : `flow`, `vaginal_pain` (label affiché
  "Douleurs", même 3 niveaux léger/moyen/abondant que `flow`), `symptoms[]`
  (inclut sécrétions, rapport sexuel, autre douleur), `mood`, `note`.
- `couples.name` est renommable par la titulaire (Réglages → Couple lié).
- `leave_couple()` (RPC) permet de quitter un espace Duo pour changer de rôle —
  utile en test, la titulaire ne peut pas redevenir partenaire autrement.
  **Attention : côté titulaire, il supprime la ligne `couples`, ce qui efface
  en cascade tout l'historique Wenn ET toutes les données Orbit** (même
  projet, FK `on delete cascade`) — les deux apps exigent donc de taper
  « SUPPRIMER » après un avertissement qui cite les deux. Ne jamais le tester
  sur le vrai couple.
- Sécurité de `couples` (2026-09-30) : `join_couple`/`leave_couple`
  exécutables par `authenticated` seulement (plus `anon`/`PUBLIC`),
  `join_couple` refuse une session absente et compare le code en minuscules ;
  un trigger empêche de modifier `owner_id`/`partner_id`/`invite_code` par un
  UPDATE direct depuis l'API (seules les fonctions SECURITY DEFINER le
  peuvent) ; un compte n'appartient qu'à un seul espace (index uniques +
  policy INSERT). Vérifier avec les advisors Supabase (type `security`) après
  toute nouvelle fonction : `revoke execute ... from public, anon` explicite.

## Widgets Android (deux, au choix dans le sélecteur de widgets)

Les deux lisent les mêmes `SharedPreferences` (`WennWidgetPrefs`), écrites par
`WidgetDataPlugin.update()` côté natif, appelé depuis `WidgetSync.tsx` (monté
dans `AppShell`, donc actif en Solo comme en Duo via `CycleDataContext`) à
chaque changement de prédiction :
- `daysRemaining` (int) → widget texte classique.
- `cycleProgress` (float 0–1, position dans le cycle moyen) → widget "Orbite",
  qui dessine un anneau + un point positionné par angle via `Canvas`/`Bitmap`
  (un `RemoteViews` ne peut pas héberger de vue custom ni animer en continu —
  le point avance d'un cran à chaque rafraîchissement, pas en temps réel).

Toute nouvelle donnée à exposer à un widget suit ce chemin : calculer dans
`WidgetSync.tsx` → ajouter un champ à `WidgetDataPlugin.update()` (JS + Java) →
lire depuis `SharedPreferences` dans le(s) `AppWidgetProvider`.

Les deux entiers ci-dessus ne sont plus qu'un repli : le JS pousse aussi
`nextPeriodStart`/`lastPeriodStart`/`averageCycleLength`, et
`WennWidgetProvider.readState()` recalcule jours restants et progression à
partir de la date du jour à chaque rendu (`updatePeriodMillis` = 1 h), avec
exactement les mêmes calculs que le JS — sinon le widget restait figé tant
que l'app n'était pas rouverte. Comme dans Orbit, **chaque mise à jour de
widget est enveloppée `try { … } catch (Throwable ignored)`** (le rendu tourne
dans le processus de l'app), `CrashLogPlugin` (installé en premier dans
`MainActivity`) garde la dernière fermeture brutale pour Réglages, et un
`ErrorBoundary` entoure la racine React.

## Hors ligne (mode Duo) — supabase-js ne lève pas d'exception

Sans réseau, supabase-js **renvoie** `{ error, status: 0 }` au lieu de lever :
toute lecture/écriture doit tester `error` (`isNetworkError()` dans
`lib/supabase.ts`), jamais compter sur un `catch`. `CoupleContext` retombe
alors sur la copie locale (`saveDuoCache`), n'affiche jamais l'onboarding à
cause d'une erreur (écran « Réessayer » s'il n'y a pas de copie), met les
écritures en file (`offlineQueue.ts`, rejouée dans l'ordre avant chaque
rechargement) et dépend de `user?.id`, pas de l'objet `user` (recréé à chaque
rafraîchissement de jeton, ce qui démontait toute l'UI). La permission
`ACCESS_NETWORK_STATE` est nécessaire pour que la WebView tienne
`navigator.onLine` et l'événement `online` à jour. Les DELETE temps réel sont
écoutés sans filtre (Supabase ne les livre pas sur un abonnement filtré).
`npm run check` (tsc + `scripts/smoke-test.ts`, prédiction du cycle) à lancer
avant chaque push.

## Mise à jour in-app — piège CORS déjà résolu, ne pas régresser

`src/lib/appUpdate.ts` télécharge l'APK avec `CapacitorHttp.request()`, **pas**
`fetch()`. Les assets de release GitHub (`release-assets.githubusercontent.com`
/ Azure Blob) ne renvoient **aucun** header CORS ; un `fetch()` dans la WebView
Capacitor échoue silencieusement ("Failed to fetch") même si la requête réussit
côté réseau. `CapacitorHttp` passe par le pont natif et contourne le problème.
Si un futur refactor réintroduit `fetch()` ici, le téléchargement recassera.

## Workflow Git/CI — à suivre à chaque changement

La branche de travail est `claude/wenn-cycle-tracking-app-km6x7a`. Le push sur
`main` déclenche le build + un **auto-tag patch** + une **Release GitHub**
(APK signé). Le workflow lit la section `## Non publié` de `CHANGELOG.md`
comme notes de release, et **seulement après** un APK signé construit et la
Release publiée (tag créé sur le commit construit), archive ces puces sous
`## vX.Y.Z — DATE` et **repousse ce commit directement sur `main`** avec son
propre identifiant git (`scripts/release-changelog.mjs`, testé par le
smoke-test). `versionCode` = majeur×1 000 000 + mineur×1 000 + patch (v1.0.20 →
1000020) : **ne jamais revenir à `run_number`** (codes bien plus petits →
Android refuserait la mise à jour comme un retour en arrière).

Conséquence : **toute deuxième session de push sur `main` dans la même
fenêtre de travail entre en conflit sur `CHANGELOG.md`.** Séquence standard :

1. Avant de commiter une modif utilisateur-visible, ajouter une puce sous
   `## Non publié` dans `CHANGELOG.md` (c'est ce que la copine verra dans
   Réglages → Mises à jour).
2. Commiter, pousser sur la branche de travail (jamais directement sur `main`).
3. Lancer le workflow sur cette branche :
   `mcp__github__actions_run_trigger` (workflow `build-android.yml`,
   `ref: claude/wenn-cycle-tracking-app-km6x7a`), attendre ~110s, vérifier le
   run via `mcp__github__actions_list` (`conclusion: success`). Ne jamais
   pousser sur `main` sans ce vert — le code natif Android ne peut pas être
   testé autrement depuis cet environnement.
4. `git fetch origin main`. Si `origin/main` a avancé (commit "Changelog :
   vX.Y.Z" de la CI) : `git merge origin/main --no-edit`, résoudre le conflit
   dans `CHANGELOG.md` en gardant les puces locales de `## Non publié` suivies
   immédiatement du `## vX.Y.Z` entrant (pas de ligne vide ni de doublon),
   `git add CHANGELOG.md && git commit --no-edit`, revalider (`npx tsc
   --noEmit`).
5. Pousser sur la branche de travail **et** sur `main`
   (`git push origin claude/wenn-cycle-tracking-app-km6x7a:main`).

## Migrations Supabase — additif uniquement

`supabase/schema.sql` est le schéma complet (pour un nouveau projet, on
l'exécute une fois en entier). Chaque évolution du schéma sur un projet déjà
déployé s'ajoute en fin de fichier comme un bloc `alter table ... add column
if not exists ...` séparé, et **l'utilisateur doit le coller lui-même dans le
SQL Editor Supabase** — jamais lui redemander de rejouer tout le fichier. Il
n'a pas toujours confirmé l'avoir fait ; si une fonctionnalité liée à une
migration récente semble ne pas marcher côté copine, penser à vérifier ça
avant de chercher un bug côté code.

## Connexion par lien magique (PKCE)

`flowType: "pkce"` (`lib/supabase.ts`) : le lien reçu par e-mail ne contient
plus de session en clair mais un `?code=`, échangé par `deepLink.ts`
(`exchangeCodeForSession`) avec un secret gardé par l'appareil qui a demandé
le lien — **le lien ne marche que sur ce téléphone, et seulement le plus
récent**. Des jetons bruts dans une URL ne sont plus jamais acceptés (un lien
piégé pouvait connecter l'app à un autre compte). En natif, `emailRedirectTo`
vise le domaine des App Links (`https://wenn-five.vercel.app`), jamais
`window.location.origin` (= https://localhost dans l'app).

## RLS : performance (2026-09-30)

Toutes les policies utilisent `(select auth.uid())` (évalué une fois par
requête, pas par ligne) et une seule policy permissive par (rôle, action) ;
chaque clé étrangère a son index (fin de `supabase/schema.sql`, déjà appliqué
sur le projet). Garder cette forme pour toute nouvelle policy (advisor
Supabase `performance`).

## Config Supabase Auth (SMTP)

Le SMTP par défaut de Supabase a une limite de débit d'e-mails très basse
(quelques-uns par heure), ce qui bloque vite le lien magique en usage réel à
deux. L'utilisateur a configuré un SMTP custom (Gmail avec mot de passe
d'application) dans Authentication → Settings → SMTP Settings. Si un login
échoue avec "email rate limit exceeded", c'est ça ; si "HTTP 504" après
config SMTP, c'est un timeout de connexion au serveur SMTP côté Supabase (à
vérifier : mot de passe d'appli correct, port 587 vs 465, bouton "Send test
email" de Supabase pour isoler le problème du reste du flux).

## Style de commit / conventions

- Commits et code sans mention de modèle Claude ; l'attribution va dans les
  lignes `Co-Authored-By`/`Claude-Session` fournies par le système, en fin de
  message.
- Pas de sur-ingénierie : cette app sert deux utilisatrices, pas un produit à
  grande échelle — préférer la solution la plus directe.
