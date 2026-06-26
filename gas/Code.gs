/* ============================================================
   CV BOOSTER PRO — Google Apps Script Backend (Code.gs)
   ============================================================
   À déployer comme "Application Web" (Web App) dans le Google Sheet
   qui sert de base de données. Voir le fichier DEPLOIEMENT.md du
   projet pour les instructions pas-à-pas.

   Structure attendue du Google Sheet (créé automatiquement si absent
   via la fonction initialiserFeuilles, à exécuter une seule fois) :

   Feuille "Codes"        : Code | Statut | DateUtilisation | ProfilUtilise
   Feuille "Soumissions"  : SubmissionId | Code | Profil | Nom | Prenoms |
                            Email | Tel | DateCreation | DateMaJ |
                            DonneesJSON | PaletteId | Statut
   ============================================================ */

// ⚠️ Change ce mot de passe avant de déployer. C'est ta clé d'accès admin.
const ADMIN_PASSWORD = "CHANGE_MOI_AVANT_DEPLOIEMENT";

const SHEET_CODES = "Codes";
const SHEET_SUBMISSIONS = "Soumissions";

/* ============================================================
   POINT D'ENTRÉE WEB APP
   ============================================================ */

function doGet(e) {
  return jsonResponse({ ok: true, message: "CV Booster Pro API en ligne." });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    switch (action) {
      case "verifyCode":
        return jsonResponse(verifyCode(body.code));
      case "consumeCode":
        return jsonResponse(consumeCode(body.code, body.profil));
      case "saveSubmission":
        return jsonResponse(saveSubmission(body));
      case "getSubmissionByCode":
        return jsonResponse(getSubmissionByCode(body.code));
      case "adminLogin":
        return jsonResponse(adminLogin(body.password));
      case "adminListSubmissions":
        return jsonResponse(adminListSubmissions(body.password));
      case "adminGetSubmission":
        return jsonResponse(adminGetSubmission(body.password, body.submissionId));
      case "adminUnlockCode":
        return jsonResponse(adminUnlockCode(body.password, body.code));
      case "adminStats":
        return jsonResponse(adminStats(body.password));
      default:
        return jsonResponse({ ok: false, error: "Action inconnue." });
    }
  } catch (err) {
    return jsonResponse({ ok: false, error: "Erreur serveur : " + err.message });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   GESTION DES CODES
   ============================================================ */

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(name);
}

function normalizeCode(code) {
  return (code || "").toString().trim().toUpperCase();
}

/**
 * Vérifie si un code existe et est encore disponible (non utilisé).
 * Ne le consomme PAS. Si un dossier est déjà en cours pour ce code
 * (le client avait commencé sans terminer), le renvoie aussi, pour que
 * le frontend reprenne automatiquement au lieu de repartir de zéro.
 */
function verifyCode(code) {
  const sheet = getSheet(SHEET_CODES);
  const data = sheet.getDataRange().getValues();
  const target = normalizeCode(code);

  for (let i = 1; i < data.length; i++) {
    const rowCode = normalizeCode(data[i][0]);
    if (rowCode === target) {
      const statut = data[i][1];
      if (statut === "Utilisé") {
        return { ok: false, error: "Ce code a déjà été utilisé. Si vous rencontrez un problème, contactez l'administrateur." };
      }

      // Code valide et disponible : voir s'il existe déjà un dossier en cours
      const existing = findSubmissionByCode(target);
      return { ok: true, valid: true, submission: existing };
    }
  }
  return { ok: false, error: "Code invalide. Vérifiez votre saisie." };
}

/**
 * Cherche une soumission existante pour un code donné (déjà normalisé).
 * Fonction interne réutilisée par verifyCode et getSubmissionByCode.
 */
function findSubmissionByCode(normalizedCode) {
  const sheet = getSheet(SHEET_SUBMISSIONS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeCode(data[i][1]) === normalizedCode) {
      return rowToSubmissionObject(data[i]);
    }
  }
  return null;
}

/**
 * Marque un code comme "Utilisé" de façon définitive.
 * Appelé uniquement après succès complet de la génération du CV,
 * pour éviter de bloquer un client en cas d'erreur en cours de route.
 */
function consumeCode(code, profil) {
  const sheet = getSheet(SHEET_CODES);
  const data = sheet.getDataRange().getValues();
  const target = normalizeCode(code);

  for (let i = 1; i < data.length; i++) {
    const rowCode = normalizeCode(data[i][0]);
    if (rowCode === target) {
      if (data[i][1] === "Utilisé") {
        return { ok: false, error: "Ce code a déjà été utilisé." };
      }
      sheet.getRange(i + 1, 2).setValue("Utilisé");
      sheet.getRange(i + 1, 3).setValue(new Date());
      sheet.getRange(i + 1, 4).setValue(profil || "");
      return { ok: true };
    }
  }
  return { ok: false, error: "Code introuvable." };
}

/* ============================================================
   GESTION DES SOUMISSIONS CLIENTS
   ============================================================ */

/**
 * Enregistre (ou met à jour) les données d'un client.
 * Permet la sauvegarde progressive : si le client est bloqué en cours
 * de route, ses données sont déjà sur le Sheet et l'admin peut les
 * récupérer sans qu'il reprenne tout à zéro.
 */
function saveSubmission(body) {
  const sheet = getSheet(SHEET_SUBMISSIONS);
  const code = normalizeCode(body.code);
  const data = sheet.getDataRange().getValues();

  const now = new Date();
  const donneesJSON = JSON.stringify(body.donnees || {});

  // Chercher si une soumission existe déjà pour ce code (mise à jour)
  for (let i = 1; i < data.length; i++) {
    if (normalizeCode(data[i][1]) === code) {
      sheet.getRange(i + 1, 4).setValue(body.donnees.NOM || "");
      sheet.getRange(i + 1, 5).setValue(body.donnees.PRENOMS || "");
      sheet.getRange(i + 1, 6).setValue(body.donnees.EMAIL || "");
      sheet.getRange(i + 1, 7).setValue(body.donnees.TEL || "");
      sheet.getRange(i + 1, 9).setValue(now); // DateMaJ
      sheet.getRange(i + 1, 10).setValue(donneesJSON);
      sheet.getRange(i + 1, 11).setValue(body.paletteId || "");
      sheet.getRange(i + 1, 12).setValue(body.statut || "En cours");
      return { ok: true, submissionId: data[i][0] };
    }
  }

  // Sinon, créer une nouvelle ligne
  const submissionId = "SUB-" + Utilities.getUuid().substring(0, 8).toUpperCase();
  sheet.appendRow([
    submissionId,
    code,
    body.profil || "",
    body.donnees.NOM || "",
    body.donnees.PRENOMS || "",
    body.donnees.EMAIL || "",
    body.donnees.TEL || "",
    now,
    now,
    donneesJSON,
    body.paletteId || "",
    body.statut || "En cours"
  ]);
  return { ok: true, submissionId };
}

/**
 * Permet à un client de retrouver ses données déjà saisies à partir
 * de son code — UNIQUEMENT si ce code est encore "Disponible", c'est-à-dire
 * que le CV n'a jamais été téléchargé avec succès avec ce code.
 * Si le code est déjà "Utilisé", la reprise est refusée : seul l'admin peut
 * réactiver le code (adminUnlockCode) pour permettre de continuer.
 */
function getSubmissionByCode(code) {
  const target = normalizeCode(code);

  const codesSheet = getSheet(SHEET_CODES);
  const codesData = codesSheet.getDataRange().getValues();
  let codeFound = false;
  let codeStatut = null;
  for (let i = 1; i < codesData.length; i++) {
    if (normalizeCode(codesData[i][0]) === target) {
      codeFound = true;
      codeStatut = codesData[i][1];
      break;
    }
  }

  if (!codeFound) {
    return { ok: false, error: "Code invalide." };
  }
  if (codeStatut === "Utilisé") {
    return { ok: false, error: "Ce code a déjà été utilisé et le CV a été téléchargé. Si vous avez besoin d'aide, contactez l'administrateur." };
  }

  const submission = findSubmissionByCode(target);
  if (submission) {
    return { ok: true, submission };
  }
  return { ok: false, error: "Aucune donnée trouvée pour ce code. Utilisez le bouton \"Commencer\" pour démarrer un nouveau CV." };
}

function rowToSubmissionObject(row) {
  let donnees = {};
  try { donnees = JSON.parse(row[9] || "{}"); } catch (e) { donnees = {}; }
  return {
    submissionId: row[0],
    code: row[1],
    profil: row[2],
    nom: row[3],
    prenoms: row[4],
    email: row[5],
    tel: row[6],
    dateCreation: row[7],
    dateMaJ: row[8],
    donnees: donnees,
    paletteId: row[10],
    statut: row[11]
  };
}

/* ============================================================
   ADMINISTRATION (accès réservé)
   ============================================================ */

function checkAdmin(password) {
  return password === ADMIN_PASSWORD;
}

function adminLogin(password) {
  if (!checkAdmin(password)) return { ok: false, error: "Mot de passe incorrect." };
  return { ok: true };
}

function adminListSubmissions(password) {
  if (!checkAdmin(password)) return { ok: false, error: "Accès refusé." };
  const sheet = getSheet(SHEET_SUBMISSIONS);
  const data = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    const obj = rowToSubmissionObject(data[i]);
    delete obj.donnees; // pas besoin du détail complet dans la liste
    list.push(obj);
  }
  return { ok: true, submissions: list.reverse() };
}

function adminGetSubmission(password, submissionId) {
  if (!checkAdmin(password)) return { ok: false, error: "Accès refusé." };
  const sheet = getSheet(SHEET_SUBMISSIONS);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === submissionId) {
      return { ok: true, submission: rowToSubmissionObject(data[i]) };
    }
  }
  return { ok: false, error: "Soumission introuvable." };
}

/**
 * Permet à l'admin de "rouvrir" un code marqué Utilisé, pour permettre
 * au client de revenir sur la plateforme et terminer/régénérer son CV
 * sans repartir de zéro (ses données restent dans Soumissions).
 */
function adminUnlockCode(password, code) {
  if (!checkAdmin(password)) return { ok: false, error: "Accès refusé." };
  const sheet = getSheet(SHEET_CODES);
  const data = sheet.getDataRange().getValues();
  const target = normalizeCode(code);

  for (let i = 1; i < data.length; i++) {
    if (normalizeCode(data[i][0]) === target) {
      sheet.getRange(i + 1, 2).setValue("Disponible");
      return { ok: true };
    }
  }
  return { ok: false, error: "Code introuvable." };
}

function adminStats(password) {
  if (!checkAdmin(password)) return { ok: false, error: "Accès refusé." };
  const codesSheet = getSheet(SHEET_CODES);
  const codesData = codesSheet.getDataRange().getValues();
  let total = 0, utilises = 0, disponibles = 0;
  for (let i = 1; i < codesData.length; i++) {
    total++;
    if (codesData[i][1] === "Utilisé") utilises++; else disponibles++;
  }
  const subSheet = getSheet(SHEET_SUBMISSIONS);
  const nbSoumissions = subSheet.getLastRow() - 1;
  return { ok: true, stats: { total, utilises, disponibles, nbSoumissions: Math.max(0, nbSoumissions) } };
}

/* ============================================================
   INITIALISATION & GÉNÉRATION DES CODES
   (à exécuter manuellement une seule fois depuis l'éditeur Apps Script)
   ============================================================ */

/**
 * Crée les feuilles "Codes" et "Soumissions" avec leurs en-têtes
 * si elles n'existent pas déjà. À exécuter une fois après avoir
 * lié ce script à ton Google Sheet.
 */
function initialiserFeuilles() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let codesSheet = ss.getSheetByName(SHEET_CODES);
  if (!codesSheet) {
    codesSheet = ss.insertSheet(SHEET_CODES);
    codesSheet.appendRow(["Code", "Statut", "DateUtilisation", "ProfilUtilise"]);
    codesSheet.setFrozenRows(1);
  }

  let subSheet = ss.getSheetByName(SHEET_SUBMISSIONS);
  if (!subSheet) {
    subSheet = ss.insertSheet(SHEET_SUBMISSIONS);
    subSheet.appendRow(["SubmissionId", "Code", "Profil", "Nom", "Prenoms", "Email", "Tel", "DateCreation", "DateMaJ", "DonneesJSON", "PaletteId", "Statut"]);
    subSheet.setFrozenRows(1);
  }

  SpreadsheetApp.getUi().alert("Feuilles initialisées avec succès !");
}

/**
 * Génère un lot de codes uniques aléatoires et les ajoute à la feuille
 * "Codes" avec le statut "Disponible". À exécuter depuis l'éditeur
 * Apps Script (sélectionner cette fonction puis cliquer "Exécuter").
 * Modifie NB_CODES si tu veux en générer un autre nombre.
 */
function genererCodes() {
  const NB_CODES = 500;
  const sheet = getSheet(SHEET_CODES);

  // Récupérer les codes déjà existants pour éviter les doublons
  const existing = new Set();
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    existing.add(normalizeCode(data[i][0]));
  }

  const rows = [];
  let generated = 0;
  while (generated < NB_CODES) {
    const code = "CVB-" + randomCodeSegment(4) + "-" + randomCodeSegment(4);
    if (existing.has(code)) continue;
    existing.add(code);
    rows.push([code, "Disponible", "", ""]);
    generated++;
  }

  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
  }

  SpreadsheetApp.getUi().alert(generated + " codes générés avec succès dans la feuille 'Codes'.");
}

function randomCodeSegment(length) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I pour éviter confusion
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
