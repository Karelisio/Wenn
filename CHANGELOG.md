# Changelog

Historique des changements de Wenn, visibles directement dans l'app (Réglages
→ Mises à jour) au moment de chaque mise à jour.

## Non publié

## v1.0.20 — 2026-09-30

- Correctif : au-delà de 1000 jours enregistrés, les plus récents ne se
  chargeaient plus (ni dans le calendrier, ni dans la prédiction, ni dans
  l'export). Tout l'historique est maintenant chargé.
- Correctif : dans la fiche du jour, ce qui était en cours de saisie pouvait
  être remplacé d'un coup par la version enregistrée (mise à jour reçue en
  arrière-plan). Une fois un choix fait, la saisie n'est plus touchée.
- Se déconnecter ou quitter l'espace efface maintenant du téléphone la copie
  de l'historique (et les dates affichées par les widgets). Si des
  modifications n'ont pas encore pu être envoyées, l'app prévient avant de
  se déconnecter.
- Sauvegarde : l'export contient aussi les mots doux, et le fichier porte la
  bonne date (plus celle de la veille après minuit). À la restauration, une
  entrée abîmée est ignorée au lieu d'effacer ce qui existe déjà, et l'app
  indique combien de jours ont été restaurés ou ignorés.
- Réglages : le délai du rappel de règles affiché est bien celui enregistré
  (il pouvait rester sur « 2 jours avant »). Les boutons « Copier » disent
  quand la copie est impossible, et le choix d'une image de thème ne reste
  plus bloqué sur « Chargement... ».
- Un double appui sur « Ajouter » n'envoie plus deux fois le même mot doux.
- Le jour d'aujourd'hui reste entouré dans le calendrier, aussi pendant la
  fenêtre fertile et les jours de règles moyennes ou abondantes.
- Affichage : plus de bande noire en haut de l'écran (la barre avec l'heure
  reste visible au-dessus de l'app), plus de bandes sur les côtés avec la
  taille d'affichage « Petite », et plus d'écran noir furtif au lancement.
- Les polices de caractères sont maintenant incluses dans l'app : lancement
  plus rapide sur un réseau lent, et même apparence sans connexion.
- Accessibilité : avec la lecture d'écran, chaque jour du calendrier est
  annoncé en entier (date, règles, fenêtre fertile...) ainsi que les flèches
  de mois. Dans le navigateur, la page peut de nouveau être agrandie.
- Connexion plus sûre : le lien reçu par e-mail ne marche plus que sur le
  téléphone qui l'a demandé (demande-le et ouvre-le sur le même téléphone,
  le plus récent s'il y en a plusieurs). Si un lien ne marche pas, l'écran
  de connexion explique pourquoi.

## v1.0.19 — 2026-09-30

- Supprimer l'espace (titulaire) : l'avertissement précise maintenant que
  toutes les données Orbit sont aussi effacées, l'app propose d'exporter une
  sauvegarde avant, et il faut taper « SUPPRIMER » pour confirmer.
- Sans réseau, l'app n'affiche plus l'écran de bienvenue (« Es-tu celle qui
  suit son cycle ? ») : elle montre la dernière copie enregistrée sur le
  téléphone, ou un bouton « Réessayer » s'il n'y en a pas encore.
- Correctif : les saisies faites sans réseau pouvaient se perdre. Elles sont
  maintenant bien mises de côté puis envoyées au retour de la connexion. Si un
  enregistrement échoue pour une autre raison, un message s'affiche et la
  fiche du jour reste ouverte.
- Prédiction plus fiable : un spotting n'est plus pris pour le début des
  règles (il pouvait décaler la date prévue d'environ deux semaines), et un
  cycle inhabituellement long ou court pèse moins dans la durée du cycle.
- Correctif : l'app se rechargeait d'elle-même environ toutes les heures (la
  fiche du jour en cours de saisie se fermait et le calendrier revenait au
  mois actuel). Les données se mettent aussi à jour en revenant dans l'app.
- Une suppression faite sur l'autre téléphone apparaît maintenant tout de
  suite, sans avoir à relancer l'app.
- Les widgets se mettent à jour tout seuls chaque jour, même sans ouvrir
  l'app (le compte à rebours restait figé).
- Correctif : le nombre de jours avant les règles pouvait être décalé d'un
  jour entre minuit et 2 h du matin.
- Si l'app se ferme toute seule, un rapport s'affiche ensuite dans Réglages
  pour aider à corriger le problème.
- Le rappel de règles se recale tout seul quand la date prévue change (plus
  besoin de réappuyer sur « Activer les rappels »). Réglages indique si la
  date du rappel est déjà passée au lieu d'annoncer « Notification
  programmée », et la carte n'est plus proposée au/à la partenaire.
- Nouvelle carte « Alarmes et rappels » dans Réglages, tant que ce réglage
  du téléphone n'est pas autorisé : sans lui, le rappel peut arriver en
  retard.
- Correctif : se connecter avec le lien reçu par e-mail fonctionne aussi
  quand l'app était complètement fermée.
- Le code d'invitation est accepté en majuscules comme en minuscules, et le
  clavier ne le corrige plus automatiquement.

## v1.0.18 — 2026-09-20

- La prédiction des règles se projette maintenant sur plusieurs cycles à
  venir : naviguer sur le calendrier des mois suivants continue d'afficher
  les règles prédites, au lieu de s'arrêter après le tout prochain cycle.

## v1.0.17 — 2026-09-20

- Le calendrier affiche la quantité de sang (spotting à abondant) par une
  couleur plus ou moins marquée sur le jour, en plus de l'emoji.
- Nouveau marqueur 💭 sur le calendrier quand une humeur est enregistrée un
  jour (en plus du flux, des douleurs et des symptômes).
- Ajout d'un champ pour enregistrer une humeur spécifique, en plus des emoji
  proposés.

## v1.0.16 — 2026-09-18

- Nouveau réglage "Taille de l'affichage" (Réglages) : texte et éléments
  plus grands ou plus petits, propre à chaque téléphone.
- La barre d'état (heure, batterie) est masquée dans l'app.
- Correctif : le bouton "Activer les rappels" restait affiché comme pressé ;
  il indique maintenant "Rappels activés ✅" et ne redevient actif que si tu
  changes le délai.
- Ajout du "Spotting" dans les niveaux de saignement.
- La fleur du calendrier est remplacée par l'icône de l'app.
- Ajout d'un champ pour enregistrer une douleur spécifique, en plus de la
  liste de symptômes.

## v1.0.15 — 2026-09-17

## v1.0.14 — 2026-09-17

- Mode Duo utilisable hors connexion : la dernière copie enregistrée
  s'affiche automatiquement sans réseau (au lieu de rester bloqué sur
  "Chargement..."), et les modifications faites hors ligne sont mises en
  attente puis envoyées automatiquement dès le retour de la connexion.
- Correctif export (Réglages → Sauvegarde) : le bouton ne faisait rien sur
  Android (le téléchargement web ne fonctionne pas dans l'app). Il ouvre
  maintenant le partage natif pour enregistrer le fichier où tu veux. La
  restauration accepte aussi les fichiers .json que le picker Android
  détectait mal.

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
