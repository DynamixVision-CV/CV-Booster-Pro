# CV Booster Pro

Plateforme web permettant à un client de créer son CV professionnel en quelques minutes : choix du profil (Débutant / Intermédiaire / Expérimenté), choix d'un design parmi 5 palettes de couleurs, remplissage d'un formulaire guidé, puis téléchargement du CV au format **PDF** et **Word (.docx)**.

Elle inclut aussi un module **Scan ATS** : un client peut déposer un CV déjà existant (PDF/Word) et l'offre d'emploi visée (texte collé ou fichier), pour obtenir une analyse automatique avec score global, sous-scores par critère, et un rapport détaillé des points à corriger.

Développé par **DynamixVision** pour **CV Booster Pro**.

---

## 🚀 Démarrage rapide

Pour mettre la plateforme en ligne, suis le guide complet : **[DEPLOIEMENT.md](./DEPLOIEMENT.md)**.

En résumé :
1. Le Google Sheet + Google Apps Script (`gas/Code.gs`) servent de base de données (codes d'accès CV, codes d'accès Scan, soumissions clients, résultats de scan).
2. Le site (`index.html` + `css/` + `js/` + `assets/`) est hébergé gratuitement sur **GitHub Pages**.

---

## 📁 Structure du projet

```
cvbooster/
├── index.html              → Page unique de l'application (toutes les vues)
├── css/
│   ├── app-styles.css      → Styles de l'interface (écrans, formulaire, admin)
│   ├── cv-styles.css       → Styles du CV généré (2 variantes : classique / moderne)
│   └── scan-styles.css     → Styles du module Scan ATS (upload, score, rapport)
├── js/
│   ├── config.js           → Définition des 3 profils, leurs champs, et des 5 palettes
│   ├── cv-renderer.js      → Transforme les données du formulaire en HTML du CV
│   ├── form-engine.js      → Génère et gère le formulaire dynamique pas-à-pas
│   ├── signature-pad.js    → Pad de signature manuscrite (canvas tactile/souris)
│   ├── doc-generator.js    → Génère les fichiers PDF et Word (.docx) côté navigateur
│   ├── api-client.js       → Communique avec le backend Google Apps Script
│   ├── app.js               → Orchestre l'application de création de CV
│   ├── file-extractor.js   → Extrait le texte d'un PDF ou Word (.docx) côté navigateur
│   ├── scan-engine.js      → Moteur d'analyse du Scan ATS (scoring + rapport)
│   └── scan-app.js         → Orchestre le module Scan ATS (upload, résultats, admin)
├── gas/
│   └── Code.gs             → Backend Google Apps Script (codes, sauvegardes, scans, admin)
├── assets/
│   ├── logo_cvbooster.png  → Logo CV Booster Pro
│   └── logo_dynamixvision.png → Logo DynamixVision (signature en pied de page)
└── DEPLOIEMENT.md          → Guide de mise en ligne pas-à-pas
```

---

## ✨ Fonctionnalités

### Création de CV
- **3 profils** de CV (Débutant, Intermédiaire, Expérimenté), reproduisant exactement les champs des Google Forms d'origine.
- **5 designs de couleur** : 1 fidèle à l'original (bleu classique) + 4 modèles modernes (Émeraude, Graphite, Bordeaux, Violet).
- **Formulaire pas-à-pas** avec barre de progression, validation des champs obligatoires, et sauvegarde automatique en arrière-plan.
- **Signature manuscrite obligatoire** : dernière étape du formulaire, le client dessine sa signature à la souris ou au doigt sur un pad tactile. Elle est intégrée comme image sur le CV final (PDF et Word), juste après la déclaration sur l'honneur.
- **Génération PDF et Word** entièrement côté client (aucun serveur de conversion nécessaire).
- **Système de 500 codes d'accès à usage unique**, stockés dans le Google Sheet, consommés uniquement après téléchargement réussi du CV.
- **Récupération de session** : si un client revient avec son code avant d'avoir téléchargé son CV, il retrouve automatiquement ses données déjà saisies, sans repartir de zéro. **Dès que le CV a été téléchargé, le code est définitivement marqué "Utilisé"** : il ne peut plus servir à recommencer un nouveau CV, ni à rouvrir/modifier l'ancien — seul l'administrateur peut le réactiver en cas de besoin (voir espace admin).

### Module Scan ATS
- **Codes d'accès dédiés**, séparés de ceux de création de CV, au format `SCAN-XXXX-XXXX`, avec la même logique d'usage unique.
- **Upload du CV existant** (PDF ou Word .docx) : le texte est extrait directement dans le navigateur (pdf.js pour le PDF, lecture XML via JSZip pour le Word).
- **Offre d'emploi** : à coller en texte libre, ou à importer en PDF/Word.
- **Analyse automatique selon 5 critères** dérivés du guide CV Booster Pro :
  1. Lisibilité ATS (format, longueur, lisibilité machine)
  2. Correspondance des mots-clés avec l'offre
  3. Structure et présence des rubriques essentielles
  4. Orientation résultats / impact (chiffres, verbes d'action, formulations génériques)
  5. Forme et présentation (nom de fichier, mise en page, cohérence)
- **Score global /100**, sous-scores par critère, et rapport détaillé (points forts ✅, points à corriger ⚠️, conseils actionnables 💡).
- **Bouton d'impression / export PDF** du rapport de résultats.

### Espace administrateur
- **Protégé par mot de passe**, avec deux onglets : "CV Booster Pro" et "Scan ATS".
- Statistiques des codes (CV et Scan séparément), liste des dossiers clients / scans réalisés, réactivation de codes bloqués.
- Possibilité de télécharger le CV d'un client à sa place, ou de consulter le détail d'un scan déjà réalisé.

---

## 🛠️ Stack technique

- **Frontend** : HTML / CSS / JavaScript vanilla (aucun framework, aucune étape de build).
- **Génération PDF** : [html2canvas](https://html2canvas.hertzen.com/) + [jsPDF](https://github.com/parallax/jsPDF).
- **Génération Word** : [docx](https://docx.js.org/) (librairie JS, génère un vrai fichier .docx modifiable).
- **Lecture PDF** (module Scan) : [pdf.js](https://mozilla.github.io/pdf.js/) (Mozilla).
- **Lecture Word** (module Scan) : [JSZip](https://stuk.github.io/jszip/) (lecture directe du XML interne du .docx).
- **Backend / Base de données** : Google Apps Script + Google Sheets (gratuit, pas de serveur à maintenir).
- **Hébergement** : GitHub Pages (gratuit).

---

## 🎨 Personnaliser les designs de couleur

Tous les designs sont définis dans `js/config.js`, dans le tableau `CV_CONFIG.palettes`. Pour ajouter ou modifier une palette, il suffit d'ajouter un objet avec les couleurs `primary`, `secondary`, `accent`, `text`, `textLight`, `bgLight`, et un `style` (`"classic"` ou `"modern"`).

## 📝 Personnaliser les champs du formulaire

Tous les champs et sections sont définis dans `js/config.js`, dans `CV_CONFIG.profiles`. Chaque profil a une liste de `sections`, chacune ayant soit des `fields` simples, soit des `itemFields` répétables (pour les expériences, formations, langues, etc.).

## 🔎 Personnaliser les règles d'analyse du Scan ATS

Toutes les règles de scoring (mots vides, verbes d'action, formulations génériques à éviter, sections attendues, barème par critère) sont centralisées dans `js/scan-engine.js`, en tête de fichier. C'est le seul fichier à modifier pour ajuster la sévérité de l'analyse ou ajouter de nouvelles règles tirées du guide.

## 🔐 Sécurité de l'espace admin

Le mot de passe administrateur est défini dans `gas/Code.gs` (constante `ADMIN_PASSWORD`). Il n'est jamais exposé côté client : toutes les vérifications se font côté serveur (Google Apps Script). Ce même mot de passe protège les deux onglets de l'espace admin (CV et Scan ATS).
