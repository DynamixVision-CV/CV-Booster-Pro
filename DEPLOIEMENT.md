# Guide de déploiement — CV Booster Pro

Ce guide t'explique, étape par étape, comment mettre ta plateforme en ligne **gratuitement**, sans avoir besoin de compétences techniques avancées. Il y a deux parties à mettre en place :

1. **Le Google Sheet + Google Apps Script** → la base de données (codes, soumissions clients)
2. **Le site web** → hébergé gratuitement sur GitHub Pages

---

## PARTIE 1 — Le Google Sheet (base de données)

### Étape 1.1 — Créer le Google Sheet

1. Va sur [sheets.google.com](https://sheets.google.com) et crée un nouveau classeur vide.
2. Renomme-le par exemple **"CV Booster Pro — Base de données"**.

### Étape 1.2 — Ajouter le script Google Apps Script

1. Dans ton Google Sheet, clique sur **Extensions → Apps Script**.
2. Une nouvelle fenêtre s'ouvre avec un fichier `Code.gs` vide.
3. Supprime tout son contenu et colle-y **l'intégralité** du contenu du fichier `gas/Code.gs` fourni dans ce projet.
4. **Important** : tout en haut du fichier, modifie cette ligne avec ton propre mot de passe administrateur :
   ```
   const ADMIN_PASSWORD = "CHANGE_MOI_AVANT_DEPLOIEMENT";
   ```
   Remplace `CHANGE_MOI_AVANT_DEPLOIEMENT` par un mot de passe fort que toi seul connaîtras (par exemple `DynamixVision2026!`).
5. Clique sur l'icône de disquette (💾) ou `Ctrl+S` pour sauvegarder.

### Étape 1.3 — Initialiser les feuilles

1. En haut de l'éditeur Apps Script, dans le menu déroulant des fonctions (à côté du bouton "Exécuter"), sélectionne **`initialiserFeuilles`**.
2. Clique sur **Exécuter** (▶️).
3. La première fois, Google va te demander d'autoriser le script à accéder à ton Google Sheet :
   - Clique sur **Vérifier les autorisations**
   - Choisis ton compte Google
   - Clique sur **Avancé** puis **Accéder à [nom du projet] (non sécurisé)** — c'est normal, c'est ton propre script.
   - Clique sur **Autoriser**.
4. Une fenêtre te confirme que les feuilles ont été créées. Retourne sur ton Google Sheet : tu dois voir 2 nouvelles feuilles **"Codes"** et **"Soumissions"**.

### Étape 1.4 — Générer les 500 codes d'accès

1. Toujours dans l'éditeur Apps Script, sélectionne la fonction **`genererCodes`** dans le menu déroulant.
2. Clique sur **Exécuter** (▶️).
3. Patiente quelques secondes — une fenêtre confirme que 500 codes ont été générés.
4. Retourne sur ton Google Sheet, feuille **"Codes"** : tu verras 500 lignes avec des codes au format `CVB-XXXX-XXXX`, tous marqués **"Disponible"**.

> 💡 C'est cette liste que tu donnes manuellement à un client après qu'il a payé. Quand il l'utilise pour télécharger son CV, le statut passe automatiquement à "Utilisé".

### Étape 1.4 bis — Générer les codes du module Scan ATS

Le module **Scan ATS** (analyse de CV face à une offre d'emploi) utilise ses propres codes, séparés de ceux de création de CV, au format `SCAN-XXXX-XXXX`.

1. Toujours dans l'éditeur Apps Script, sélectionne la fonction **`genererCodesScan`** dans le menu déroulant.
2. Clique sur **Exécuter** (▶️).
3. Une fenêtre confirme que 500 codes Scan ont été générés.
4. Retourne sur ton Google Sheet : une feuille **"CodesScan"** a été créée avec les codes, tous marqués "Disponible". Une feuille **"ResultatsScan"** a aussi été créée : elle stocke automatiquement le détail de chaque analyse réalisée par tes clients.

> 💡 Donne un code `SCAN-XXXX-XXXX` à un client qui veut faire analyser un CV déjà existant face à une offre précise — indépendamment de s'il a utilisé (ou non) le service de création de CV.

### Étape 1.5 — Déployer le script comme Application Web

1. Dans l'éditeur Apps Script, clique sur le bouton **Déployer** (en haut à droite) → **Nouveau déploiement**.
2. Clique sur l'icône en forme de roue dentée ⚙️ à côté de "Sélectionner le type" → choisis **Application Web**.
3. Configure ainsi :
   - **Description** : "CV Booster Pro API"
   - **Exécuter en tant que** : Moi (ton adresse Gmail)
   - **Qui a accès** : **Tout le monde**
4. Clique sur **Déployer**.
5. Google va te redemander d'autoriser l'accès (même procédure qu'à l'étape 1.3).
6. Une fenêtre t'affiche **l'URL de ton application web** — elle ressemble à :
   ```
   https://script.google.com/macros/s/AKfycb.................../exec
   ```
7. **Copie cette URL**, tu en auras besoin à l'étape 2.

> ⚠️ Si tu modifies le script plus tard, il faudra refaire un déploiement (Déployer → Gérer les déploiements → icône crayon → Nouvelle version → Déployer) pour que les changements soient pris en compte sur le site déjà en ligne.

---

## PARTIE 2 — Le site web (GitHub Pages)

### Étape 2.1 — Créer un compte GitHub (si tu n'en as pas)

Va sur [github.com](https://github.com) et crée un compte gratuit.

### Étape 2.2 — Créer un nouveau dépôt (repository)

1. Clique sur le **+** en haut à droite → **New repository**.
2. Nom du dépôt : `cv-booster-pro` (ou autre nom de ton choix, sans espace).
3. Coche **Public**.
4. Ne coche **aucune** case d'initialisation (pas de README, pas de .gitignore).
5. Clique sur **Create repository**.

### Étape 2.3 — Configurer l'URL de l'API dans le projet

Avant d'uploader les fichiers, ouvre le fichier `js/api-client.js` et remplace cette ligne :

```javascript
const GAS_WEB_APP_URL = "REMPLACER_PAR_URL_DEPLOIEMENT_APPS_SCRIPT";
```

par l'URL que tu as copiée à l'étape 1.5 :

```javascript
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycb.................../exec";
```

Sauvegarde le fichier.

### Étape 2.4 — Uploader les fichiers sur GitHub

**Option simple (sans ligne de commande) :**

1. Sur la page de ton nouveau dépôt GitHub, clique sur **uploading an existing file**.
2. Glisse-dépose **tout le contenu du dossier du projet** (le fichier `index.html`, et les dossiers `css/`, `js/`, `assets/` — pas le dossier `gas/`, qui ne sert qu'à Google Apps Script).
3. En bas de page, écris un message comme "Premier déploiement" puis clique sur **Commit changes**.

### Étape 2.5 — Activer GitHub Pages

1. Dans ton dépôt, va dans **Settings** (en haut) → **Pages** (dans le menu de gauche).
2. Sous **Source**, sélectionne la branche **main** et le dossier **/ (root)**.
3. Clique sur **Save**.
4. Patiente 1 à 2 minutes. Recharge la page : une bannière verte affiche l'URL de ton site, du type :
   ```
   https://ton-nom-utilisateur.github.io/cv-booster-pro/
   ```

🎉 **C'est cette URL que tu partages avec tes clients !**

---

## PARTIE 3 — Tester avant de partager

1. Ouvre l'URL de ton site.
2. Prends un des 500 codes générés (feuille "Codes" de ton Google Sheet) et teste tout le parcours : choix du profil, choix du design, remplissage du formulaire, téléchargement PDF et Word.
3. Vérifie dans ton Google Sheet (feuille "Soumissions") que les données du test sont bien arrivées, et que le code est passé en "Utilisé" dans la feuille "Codes".
4. Teste aussi l'espace administrateur (bouton en haut à droite du site) avec le mot de passe que tu as choisi à l'étape 1.2.

> 💡 Pense à **réactiver** ce code de test dans l'espace admin (ou directement dans le Google Sheet, en remettant "Disponible") avant de donner les codes à de vrais clients.

---

## Comment ça fonctionne au quotidien

- **Donner un code à un client** : ouvre la feuille "Codes", choisis une ligne marquée "Disponible", donne ce code au client après son paiement.
- **Un client bloqué / ne peut pas télécharger** : va dans l'espace admin du site, repère son code ou son nom dans le tableau, clique sur "Voir / Télécharger" pour ouvrir son dossier déjà rempli, et télécharge son CV pour le lui envoyer toi-même par email/WhatsApp. Tu peux aussi réactiver son code depuis l'admin s'il doit continuer lui-même.
- **Voir combien de codes restent disponibles** : l'espace admin affiche les statistiques en haut (total, disponibles, utilisés, soumissions).
- **Ajouter plus de codes plus tard** : retourne dans l'éditeur Apps Script (Extensions → Apps Script depuis ton Google Sheet) et réexécute la fonction `genererCodes` (modifie `NB_CODES` dans le code si tu veux un nombre différent de 500).

### Le module Scan ATS

- **Donner un code Scan à un client** : ouvre la feuille "CodesScan", choisis une ligne marquée "Disponible", donne ce code `SCAN-XXXX-XXXX` au client. C'est un code totalement indépendant des codes de création de CV — un client peut avoir l'un, l'autre, ou les deux.
- **Ce que fait le client** : il clique sur "🔍 Scan ATS" en haut du site, saisit son code, dépose son CV existant (PDF ou Word) et colle (ou importe) l'offre d'emploi visée. Il obtient immédiatement un score global, des sous-scores par critère, et un rapport détaillé des points à corriger.
- **Suivi des scans** : dans l'espace admin, l'onglet "🔍 Scan ATS" affiche les statistiques (codes disponibles/utilisés, nombre de scans réalisés) et l'historique de tous les scans, avec un bouton "Voir le détail" pour consulter le rapport complet d'un client.
- **Ajouter plus de codes Scan** : réexécute la fonction `genererCodesScan` dans l'éditeur Apps Script (modifie `NB_CODES_SCAN` si besoin).

---

## Mettre à jour le site après des modifications

Si tu modifies un fichier (texte, couleur, etc.) :
1. Va sur ton dépôt GitHub, ouvre le fichier concerné, clique sur l'icône crayon ✏️ pour l'éditer directement en ligne, ou supprime l'ancien et upload le nouveau.
2. GitHub Pages se mettra à jour automatiquement en 1-2 minutes.

---

## Besoin d'aide ?

Si une étape bloque, le message d'erreur exact (capture d'écran) aide beaucoup à diagnostiquer le problème.
