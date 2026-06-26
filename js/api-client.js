/* ============================================================
   CV BOOSTER PRO — Client API (communication avec Google Apps Script)
   ============================================================
   IMPORTANT : remplace GAS_WEB_APP_URL par l'URL de ton déploiement
   "Application Web" Google Apps Script (voir DEPLOIEMENT.md).
   ============================================================ */

const GAS_WEB_APP_URL = "REMPLACER_PAR_URL_DEPLOIEMENT_APPS_SCRIPT";

const Api = (() => {

  async function call(action, payload = {}) {
    try {
      const res = await fetch(GAS_WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" }, // évite le preflight CORS sur Apps Script
        body: JSON.stringify({ action, ...payload })
      });
      if (!res.ok) {
        return { ok: false, error: "Erreur réseau (" + res.status + ")." };
      }
      return await res.json();
    } catch (err) {
      return { ok: false, error: "Impossible de contacter le serveur. Vérifiez votre connexion internet." };
    }
  }

  return {
    verifyCode: (code) => call("verifyCode", { code }),
    consumeCode: (code, profil) => call("consumeCode", { code, profil }),
    saveSubmission: (payload) => call("saveSubmission", payload),
    getSubmissionByCode: (code) => call("getSubmissionByCode", { code }),
    adminLogin: (password) => call("adminLogin", { password }),
    adminListSubmissions: (password) => call("adminListSubmissions", { password }),
    adminGetSubmission: (password, submissionId) => call("adminGetSubmission", { password, submissionId }),
    adminUnlockCode: (password, code) => call("adminUnlockCode", { password, code }),
    adminStats: (password) => call("adminStats", { password })
  };
})();
