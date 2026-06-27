/* ============================================================
   CV BOOSTER PRO — Module "Scan ATS" (scan-app.js)
   ============================================================
   Orchestre le parcours du Scan : Code Scan -> Upload (CV + offre)
   -> Analyse -> Résultats détaillés. Étend aussi l'espace Admin
   avec l'onglet "Scan ATS" (stats, historique, réactivation).

   Indépendant du parcours de création de CV (app.js), mais
   partage les mêmes utilitaires UI (showView, toast, loader)
   exposés par App en s'appuyant sur les mêmes ids/conventions.
   ============================================================ */

const ScanApp = (() => {

  const state = {
    scanCode: null,
    cvFile: null,        // { text, fileName, fileType, meta, extractionWarning }
    jobText: "",         // texte de l'offre (collé ou extrait d'un fichier)
    jobFileMeta: null,   // si l'offre vient d'un fichier
    lastResult: null,
    scanConsumed: false,
    jobInputMode: "paste" // "paste" | "file"
  };

  /* ---------- UTILITAIRES UI (réutilise les conventions de app.js) ---------- */

  function showView(viewId) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(viewId).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showLoader(show) {
    document.getElementById("appLoader").classList.toggle("active", show);
  }

  function toast(message, type = "") {
    const el = document.getElementById("appToast");
    el.textContent = message;
    el.className = "toast show " + type;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove("show"), 3500);
  }

  /* ============================================================
     ÉTAPE 1 — CODE D'ACCÈS SCAN
     ============================================================ */

  function initScanGate() {
    const input = document.getElementById("scanGateCodeInput");
    const btn = document.getElementById("scanGateSubmitBtn");
    const errorEl = document.getElementById("scanGateError");

    btn.addEventListener("click", () => submitScanCode());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitScanCode(); });

    async function submitScanCode() {
      const code = input.value.trim().toUpperCase();
      errorEl.textContent = "";
      if (!code) {
        errorEl.textContent = "Merci de saisir votre code Scan.";
        return;
      }
      showLoader(true);
      const res = await Api.verifyScanCode(code);
      showLoader(false);

      if (!res.ok) {
        errorEl.textContent = res.error || "Code invalide.";
        return;
      }

      state.scanCode = code;
      state.scanConsumed = false;
      showView("viewScanUpload");
    }
  }

  /* ============================================================
     ÉTAPE 2 — UPLOAD CV + OFFRE
     ============================================================ */

  function initDropzone(dropzoneId, inputId, statusId, onFileSelected) {
    const dropzone = document.getElementById(dropzoneId);
    const input = document.getElementById(inputId);

    dropzone.addEventListener("click", () => input.click());

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onFileSelected(e.dataTransfer.files[0]);
      }
    });

    input.addEventListener("change", () => {
      if (input.files && input.files[0]) onFileSelected(input.files[0]);
    });
  }

  function setFileStatus(statusId, message, type) {
    const el = document.getElementById(statusId);
    el.textContent = message;
    el.className = "scan-file-status " + (type || "");
  }

  function initScanUploadView() {
    // Dropzone CV
    initDropzone("scanCvDropzone", "scanCvInput", "scanCvStatus", async (file) => {
      setFileStatus("scanCvStatus", "Lecture du fichier en cours…", "loading");
      try {
        const result = await FileExtractor.extract(file);
        state.cvFile = result;
        if (result.extractionWarning) {
          setFileStatus("scanCvStatus", `⚠️ "${file.name}" importé, mais ${result.extractionWarning.toLowerCase()}`, "warn");
        } else {
          setFileStatus("scanCvStatus", `✅ "${file.name}" importé avec succès.`, "ok");
        }
      } catch (err) {
        state.cvFile = null;
        setFileStatus("scanCvStatus", "❌ " + err.message, "error");
      }
    });

    // Dropzone Offre (fichier)
    initDropzone("scanJobDropzone", "scanJobInput", "scanJobStatus", async (file) => {
      setFileStatus("scanJobStatus", "Lecture du fichier en cours…", "loading");
      try {
        const result = await FileExtractor.extract(file);
        state.jobText = result.text;
        state.jobFileMeta = { fileName: result.fileName, fileType: result.fileType };
        setFileStatus("scanJobStatus", `✅ "${file.name}" importé avec succès.`, "ok");
      } catch (err) {
        state.jobFileMeta = null;
        setFileStatus("scanJobStatus", "❌ " + err.message, "error");
      }
    });

    // Onglets "Coller le texte" / "Importer un fichier" pour l'offre
    document.querySelectorAll("#scanJobTabs .scan-tab").forEach(tabBtn => {
      tabBtn.addEventListener("click", () => {
        document.querySelectorAll("#scanJobTabs .scan-tab").forEach(b => b.classList.remove("active"));
        tabBtn.classList.add("active");
        state.jobInputMode = tabBtn.dataset.tab;

        document.getElementById("scanJobPanelPaste").classList.toggle("active", state.jobInputMode === "paste");
        document.getElementById("scanJobPanelFile").classList.toggle("active", state.jobInputMode === "file");
      });
    });

    document.getElementById("scanBackBtn").addEventListener("click", () => {
      showView("viewScanGate");
    });

    document.getElementById("scanAnalyzeBtn").addEventListener("click", runAnalysis);
  }

  async function runAnalysis() {
    if (!state.cvFile || !state.cvFile.text) {
      toast("Merci d'importer votre CV avant de lancer l'analyse.", "error");
      return;
    }

    // Récupère le texte de l'offre selon le mode actif
    let jobText = "";
    if (state.jobInputMode === "paste") {
      jobText = document.getElementById("scanJobTextarea").value.trim();
    } else {
      jobText = state.jobText || "";
    }
    state.jobText = jobText;

    showLoader(true);
    try {
      const cvMeta = {
        fileName: state.cvFile.fileName,
        fileType: state.cvFile.fileType,
        hasComplexTables: state.cvFile.meta && state.cvFile.meta.hasComplexTables
      };

      const result = ScanEngine.analyze(state.cvFile.text, jobText, cvMeta);
      state.lastResult = result;

      // Sauvegarde côté serveur (best-effort : si ça échoue, l'utilisateur voit son résultat quand même)
      if (state.scanCode) {
        await Api.saveScanResult({
          code: state.scanCode,
          fileName: state.cvFile.fileName,
          globalScore: result.globalScore,
          resultat: result
        }).catch(() => {});
      }

      renderResults(result);
      showView("viewScanResults");

      if (!state.scanConsumed && state.scanCode) {
        await Api.consumeScanCode(state.scanCode);
        state.scanConsumed = true;
      }
    } catch (err) {
      toast("Une erreur est survenue pendant l'analyse : " + err.message, "error");
    }
    showLoader(false);
  }

  /* ============================================================
     ÉTAPE 3 — RENDU DES RÉSULTATS
     ============================================================ */

  function scoreBarClass(ratio) {
    if (ratio >= 0.75) return "good";
    if (ratio >= 0.5) return "mid";
    return "bad";
  }

  function renderCriterionCard(c) {
    const ratio = c.max ? c.score / c.max : 0;
    const barClass = scoreBarClass(ratio);
    const f = c.findings || { good: [], bad: [], tips: [] };

    return `
      <div class="scan-criterion-card">
        <div class="scan-criterion-head">
          <div class="scan-criterion-title">
            <span class="scan-criterion-icon">${c.icon}</span>
            <span>${c.label}</span>
          </div>
          <div class="scan-criterion-score">${c.score} / ${c.max}</div>
        </div>
        <div class="scan-bar-track">
          <div class="scan-bar-fill ${barClass}" style="width:${Math.round(ratio * 100)}%"></div>
        </div>

        ${f.good.length ? `
          <div class="scan-finding-group scan-finding-good">
            ${f.good.map(t => `<div class="scan-finding-item">✅ ${escapeHtmlScan(t)}</div>`).join("")}
          </div>` : ""}

        ${f.bad.length ? `
          <div class="scan-finding-group scan-finding-bad">
            ${f.bad.map(t => `<div class="scan-finding-item">⚠️ ${escapeHtmlScan(t)}</div>`).join("")}
          </div>` : ""}

        ${f.tips.length ? `
          <div class="scan-finding-group scan-finding-tip">
            ${f.tips.map(t => `<div class="scan-finding-item">💡 ${escapeHtmlScan(t)}</div>`).join("")}
          </div>` : ""}
      </div>
    `;
  }

  function escapeHtmlScan(str) {
    if (str === undefined || str === null) return "";
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function renderResults(result) {
    const container = document.getElementById("scanResultsContainer");

    container.innerHTML = `
      <div class="scan-global-card scan-verdict-${result.verdictClass}">
        <div class="scan-global-score-wrap">
          <div class="scan-global-score">${result.globalScore}</div>
          <div class="scan-global-score-max">/ 100</div>
        </div>
        <div class="scan-global-text">
          <h3>${result.verdict}</h3>
          <p>Analyse basée sur les critères du guide CV Booster Pro : lisibilité ATS, mots-clés de l'offre, structure, orientation résultats et présentation.</p>
        </div>
      </div>

      <div class="scan-criteria-grid">
        ${result.criteria.map(renderCriterionCard).join("")}
      </div>
    `;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const restartBtn = document.getElementById("scanRestartBtn");
    if (restartBtn) {
      restartBtn.addEventListener("click", () => {
        state.cvFile = null;
        state.jobText = "";
        state.jobFileMeta = null;
        document.getElementById("scanCvInput").value = "";
        document.getElementById("scanJobInput").value = "";
        document.getElementById("scanJobTextarea").value = "";
        setFileStatus("scanCvStatus", "", "");
        setFileStatus("scanJobStatus", "", "");
        showView("viewScanGate");
      });
    }

    const printBtn = document.getElementById("scanPrintBtn");
    if (printBtn) {
      printBtn.addEventListener("click", () => window.print());
    }
  });

  /* ============================================================
     ESPACE ADMIN — ONGLET SCAN
     ============================================================ */

  let adminPasswordRef = null;

  function initAdminScanTabs() {
    document.querySelectorAll("#adminTabs .scan-tab").forEach(tabBtn => {
      tabBtn.addEventListener("click", () => {
        document.querySelectorAll("#adminTabs .scan-tab").forEach(b => b.classList.remove("active"));
        tabBtn.classList.add("active");
        const tab = tabBtn.dataset.adminTab;
        document.getElementById("adminPanelCv").classList.toggle("active", tab === "cv");
        document.getElementById("adminPanelScan").classList.toggle("active", tab === "scan");
        if (tab === "scan") loadAdminScanData();
      });
    });

    const unlockBtn = document.getElementById("adminScanUnlockBtn");
    if (unlockBtn) {
      unlockBtn.addEventListener("click", async () => {
        const code = document.getElementById("adminScanUnlockInput").value.trim().toUpperCase();
        if (!code || !adminPasswordRef) return;
        showLoader(true);
        const res = await Api.adminUnlockScanCode(adminPasswordRef, code);
        showLoader(false);
        toast(res.ok ? "Code Scan réactivé avec succès." : (res.error || "Erreur."), res.ok ? "success" : "error");
      });
    }
  }

  async function loadAdminScanData() {
    if (!adminPasswordRef) return;
    showLoader(true);
    const [statsRes, listRes] = await Promise.all([
      Api.adminScanStats(adminPasswordRef),
      Api.adminListScanResults(adminPasswordRef)
    ]);
    showLoader(false);

    if (statsRes.ok) {
      const s = statsRes.stats;
      document.getElementById("adminScanStatsBar").innerHTML = `
        <div><strong>${s.total}</strong> codes Scan au total</div>
        <div><strong>${s.disponibles}</strong> disponibles</div>
        <div><strong>${s.utilises}</strong> utilisés</div>
        <div><strong>${s.nbScans}</strong> scans réalisés</div>
      `;
    }

    if (listRes.ok) {
      const tbody = document.getElementById("adminScanResultsBody");
      tbody.innerHTML = listRes.scans.map(s => `
        <tr>
          <td>${escapeHtmlScan(s.code)}</td>
          <td>${escapeHtmlScan(s.fileName)}</td>
          <td>${s.globalScore !== undefined ? s.globalScore + " / 100" : "—"}</td>
          <td>${s.dateCreation ? new Date(s.dateCreation).toLocaleDateString("fr-FR") : "—"}</td>
          <td><span class="status-badge ${s.statut === 'Terminé' ? 'ok' : 'pending'}">${escapeHtmlScan(s.statut || "—")}</span></td>
          <td><button class="btn btn-outline btn-sm" data-view-scan="${s.scanId}">Voir le détail</button></td>
        </tr>
      `).join("");

      tbody.querySelectorAll("[data-view-scan]").forEach(btn => {
        btn.addEventListener("click", () => openAdminScanDetail(btn.dataset.viewScan));
      });
    }
  }

  async function openAdminScanDetail(scanId) {
    showLoader(true);
    const res = await Api.adminGetScanResult(adminPasswordRef, scanId);
    showLoader(false);
    if (!res.ok) { toast(res.error, "error"); return; }

    renderResults(res.scan.resultat);
    showView("viewScanResults");
    toast("Détail du scan client chargé.", "success");
  }

  /* ============================================================
     INITIALISATION GLOBALE DU MODULE
     ============================================================ */

  function init() {
    initScanGate();
    initScanUploadView();
    initAdminScanTabs();

    // app.js diffuse cet événement après une connexion admin réussie (mot de passe vérifié côté serveur).
    document.addEventListener("admin-login-success", (e) => {
      adminPasswordRef = e.detail.password;
    });
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", ScanApp.init);
