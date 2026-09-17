# Changelog

Historique des changements de Wenn, visibles directement dans l'app (Réglages
→ Mises à jour) au moment de chaque mise à jour.

## Non publié

## v1.0.13 — 2026-09-17

- Titre manquant ajouté au graphique de longueur de cycle (Tendances).

## v1.0.12 — 2026-09-17

- Correctif widgets : le clic ouvrait plus rien, et certains lanceurs
  affichaient "Impossible de charger le widget" (taille min/max mal
  déclarée). Les deux widgets s'ouvrent maintenant sur l'app au tap et
  s'adaptent à n'importe quelle taille de redimensionnement.

## v1.0.11 — 2026-09-17



## v1.0.10 — 2026-09-17

- "Douleurs vaginales" renommé en "Douleurs" (saisie du jour, Tendances).
- Graphiques flux/douleurs/comparaison épurés : les valeurs qui se
  chevauchaient au-dessus de chaque point sont retirées (visibles au tap sur
  un point) et seuls les 14 derniers jours renseignés sont affichés.
- Nouveau widget "Orbite" au choix (en plus de celui déjà existant) : reprend
  le motif de l'icône de l'app, avec un point qui avance dans l'anneau au fil
  du cycle (comme une horloge lente) et le nombre de jours restants au centre.

## v1.0.9 — 2026-09-17
- Les graphiques de Tendances passent de barres à des courbes avec points et
  valeurs affichées (régularité du cycle, flux, douleurs vaginales,
  comparaison), plus lisibles.

## v1.0.8 — 2026-09-17
- Nouveau widget d'écran d'accueil Android affichant le nombre de jours
  restants avant les prochaines règles.

## v1.0.7 — 2026-09-17
- Suivi de l'intensité des douleurs vaginales, des sécrétions, des rapports
  sexuels et des autres douleurs (nouveaux symptômes, comme les existants).
- Le calendrier affiche désormais des emoji résumant ce qui a été enregistré
  chaque jour (flux, douleurs, symptômes...).
- Tendances : nouveaux graphiques flux, douleurs vaginales, et comparaison
  des deux.

## v1.0.6 — 2026-09-17
- Correction du bouton "Installer la version..." qui échouait toujours
  ("le téléchargement a échoué") : le fichier est servi par un stockage
  tiers qui bloque les requêtes directes depuis l'app, contournée en
  passant par le réseau natif au lieu du navigateur intégré.

## v1.0.5 — 2026-09-17
- Calendrier : meilleur contraste entre règles, prédiction et fenêtre
  fertile (les couleurs se confondaient trop pour bien les distinguer).
- Réglages > Couple lié permet maintenant de renommer l'espace partagé
  (ex. "Nos règles" → autre nom), visible côté titulaire et partenaire.

## v1.0.4 — 2026-09-17
- Réglages affiche désormais clairement l'état de la synchronisation Duo
  ("🔗 Connecté·e avec ...") avec l'adresse e-mail de l'autre personne.
- Suppression de la carte "Apparence — Material You" sur Android (le thème
  suit déjà le fond d'écran, elle n'avait plus d'utilité).
- Correction d'un défaut visuel : une ligne de coupure de couleur apparaissait
  en scrollant dans Réglages.

## v1.0.3 — 2026-09-17
- Les mises à jour se téléchargent et s'installent directement depuis l'app
  (Réglages → Mises à jour), sans passer par le navigateur.

## v1.0.2 — 2026-09-17
- Le bouton "Choisir une image" du thème n'apparaît plus sur Android (le
  thème suit déjà le fond d'écran automatiquement).
- Possibilité de quitter un espace Duo (Réglages → Couple lié) pour changer
  de rôle titulaire/partenaire.

## v1.0.0 — 2026-09-17
- Première version : suivi des règles, prédictions de cycle, calendrier,
  tendances, notifications, mode Solo (local) et Duo (synchronisé), thème
  Material You, sauvegarde et export des données.
