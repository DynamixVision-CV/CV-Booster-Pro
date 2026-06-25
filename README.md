# CV Booster Pro

Plateforme web permettant à un client de créer son CV professionnel en quelques minutes : choix du profil (Débutant / Intermédiaire / Expérimenté), choix d'un design parmi 5 palettes de couleurs, remplissage d'un formulaire guidé, puis téléchargement du CV au format **PDF** et **Word (.docx)**.

Développé par **DynamixVision** pour **CV Booster Pro**.

---

## 🚀 Démarrage rapide

Pour mettre la plateforme en ligne, suis le guide complet : **[DEPLOIEMENT.md](./DEPLOIEMENT.md)**.

En résumé :
1. Le Google Sheet + Google Apps Script (`gas/Code.gs`) servent de base de données (codes d'accès + soumissions clients).
2. Le site (`index.html` + `css/` + `js/` + `assets/`) est hébergé gratuitement sur **GitHub Pages**.

---

## 📁 Structure du projet

```
cvbooster/
├── index.html              → Page unique de l'application (toutes les vues)
├── css/
│   ├── app-styles.css      → Styles de l'interface (écrans, formulaire, admin)
│   └── cv-styles.css       → Styles du CV généré (2 variantes : classique / moderne)
├── js/
│   ├── config.js           → Définition des 3 profils, leurs champs, et des 5 palettes
│   ├── cv-renderer.js      → Transforme les données du formulaire en HTML du CV
│   ├── form-engine.js      → Génère et gère le formulaire dynamique pas-à-pas
│   ├── doc-generator.js    → Génère les fichiers PDF et Word (.docx) côté navigateur
│   ├── api-client.js       → Communique avec le backend Google Apps Script
│   └── app.js              → Orchestre l'application (navigation entre les vues)
├── gas/
│   └── Code.gs             → Backend Google Apps Script (codes, sauvegardes, admin)
├── assets/
│   ├── logo_cvbooster.png  → Logo CV Booster Pro
│   └── logo_dynamixvision.png → Logo DynamixVision (signature en pied de page)
└── DEPLOIEMENT.md          → Guide de mise en ligne pas-à-pas
```

---

## ✨ Fonctionnalités

- **3 profils** de CV (Débutant, Intermédiaire, Expérimenté), reproduisant exactement les champs des Google Forms d'origine.
- **5 designs de couleur** : 1 fidèle à l'original (bleu classique) + 4 modèles modernes (Émeraude, Graphite, Bordeaux, Violet).
- **Formulaire pas-à-pas** avec barre de progression, validation des champs obligatoires, et sauvegarde automatique en arrière-plan.
- **Génération PDF et Word** entièrement côté client (aucun serveur de conversion nécessaire).
- **Système de 500 codes d'accès à usage unique**, stockés dans le Google Sheet, consommés uniquement après téléchargement réussi du CV.
- **Récupération de session** : un client qui revient avec son code (même utilisé) retrouve ses données déjà saisies, sans repartir de zéro.
- **Espace administrateur protégé par mot de passe** : statistiques des codes, liste des dossiers clients, réactivation de codes bloqués, et possibilité de télécharger le CV d'un client à sa place pour le lui envoyer.

---

## 🛠️ Stack technique

- **Frontend** : HTML / CSS / JavaScript vanilla (aucun framework, aucune étape de build).
- **Génération PDF** : [html2canvas](https://html2canvas.hertzen.com/) + [jsPDF](https://github.com/parallax/jsPDF).
- **Génération Word** : [docx](https://docx.js.org/) (librairie JS, génère un vrai fichier .docx modifiable).
- **Backend / Base de données** : Google Apps Script + Google Sheets (gratuit, pas de serveur à maintenir).
- **Hébergement** : GitHub Pages (gratuit).

---

## 🎨 Personnaliser les designs de couleur

Tous les designs sont définis dans `js/config.js`, dans le tableau `CV_CONFIG.palettes`. Pour ajouter ou modifier une palette, il suffit d'ajouter un objet avec les couleurs `primary`, `secondary`, `accent`, `text`, `textLight`, `bgLight`, et un `style` (`"classic"` ou `"modern"`).

## 📝 Personnaliser les champs du formulaire

Tous les champs et sections sont définis dans `js/config.js`, dans `CV_CONFIG.profiles`. Chaque profil a une liste de `sections`, chacune ayant soit des `fields` simples, soit des `itemFields` répétables (pour les expériences, formations, langues, etc.).

## 🔐 Sécurité de l'espace admin

Le mot de passe administrateur est défini dans `gas/Code.gs` (constante `ADMIN_PASSWORD`). Il n'est jamais exposé côté client : toutes les vérifications se font côté serveur (Google Apps Script).
