/* ============================================================
   CV BOOSTER PRO — Application principale (app.js)
   Orchestre les vues : Code -> Profil -> Palette -> Formulaire
   -> Aperçu/Téléchargement. Gère aussi l'espace Admin.
   ============================================================ */

const App = (() => {

  const state = {
    code: null,
    profileId: null,
    paletteId: null,
    autosaveTimer: null
  };

  /* ---------- UTILITAIRES UI ---------- */

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

  function getPalette(id) {
    return CV_CONFIG.palettes.find(p => p.id === id) || CV_CONFIG.palettes[0];
  }

  function sanitizeFilename(name) {
    return name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // enlève les accents
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_");
  }

  /* ============================================================
     ÉTAPE 1 — ÉCRAN DE CODE
     ============================================================ */

  function initGateView() {
    const input = document.getElementById("gateCodeInput");
    const btn = document.getElementById("gateSubmitBtn");
    const errorEl = document.getElementById("gateError");

    btn.addEventListener("click", () => submitCode());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") submitCode(); });

    async function submitCode() {
      const code = input.value.trim().toUpperCase();
      errorEl.textContent = "";
      if (!code) {
        errorEl.textContent = "Merci de saisir votre code.";
        return;
      }
      showLoader(true);
      const res = await Api.verifyCode(code);
      showLoader(false);

      if (!res.ok) {
        errorEl.textContent = res.error || "Code invalide.";
        return;
      }

      state.code = code;

      // Si un dossier existe déjà pour ce code (parcours commencé mais pas
      // encore téléchargé), on reprend automatiquement là où le client en était.
      if (res.submission) {
        state.profileId = res.submission.profil;
        state.paletteId = res.submission.paletteId || CV_CONFIG.palettes[0].id;
        FormEngine.init(state.profileId, res.submission.donnees);
        toast("Vous reprenez votre CV là où vous l'aviez laissé.", "success");
        showView("viewForm");
        renderFormSection();
        return;
      }

      // Sinon, nouveau parcours : choix du profil
      showView("viewProfile");
      renderProfileCards();
    }
  }

  /* ============================================================
     ÉTAPE 2 — SÉLECTION DU PROFIL
     ============================================================ */

  function renderProfileCards() {
    const container = document.getElementById("profileCardsContainer");
    container.innerHTML = Object.values(CV_CONFIG.profiles).map(p => `
      <div class="profile-card" data-profile="${p.id}">
        <h3>${p.label}</h3>
        <p>${p.tagline}</p>
        <span class="badge">${p.expCount} expérience${p.expCount > 1 ? "s" : ""} pro.</span>
      </div>
    `).join("");

    container.querySelectorAll(".profile-card").forEach(card => {
      card.addEventListener("click", () => {
        state.profileId = card.dataset.profile;
        showView("viewPalette");
        renderPaletteCards();
      });
    });
  }

  /* ============================================================
     ÉTAPE 3 — SÉLECTION DE LA PALETTE / DESIGN
     ============================================================ */

  function renderPaletteCards() {
    const container = document.getElementById("paletteCardsContainer");
    container.innerHTML = CV_CONFIG.palettes.map(p => `
      <div class="palette-card" data-palette="${p.id}">
        <div class="palette-swatch">
          <span style="background:${p.primary}"></span>
          <span style="background:${p.secondary}"></span>
          <span style="background:${p.accent}"></span>
        </div>
        <h4>${p.name}</h4>
        <p>${p.description}</p>
      </div>
    `).join("");

    container.querySelectorAll(".palette-card").forEach(card => {
      card.addEventListener("click", () => {
        container.querySelectorAll(".palette-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        state.paletteId = card.dataset.palette;
        setTimeout(startForm, 200);
      });
    });
  }

  function startForm() {
    FormEngine.init(state.profileId, {});
    showView("viewForm");
    renderFormSection();
  }

  /* ============================================================
     ÉTAPE 4 — FORMULAIRE DYNAMIQUE (pas à pas)
     ============================================================ */

  function renderFormSection() {
    const container = document.getElementById("formSectionContainer");
    container.innerHTML = FormEngine.renderCurrentSectionHtml();

    // Lier les data-key existants (valeurs déjà saisies) -- déjà fait dans renderField via value=""
    // Lier les events de mise à jour du label de range
    container.querySelectorAll("input[type=range][data-key]").forEach(rangeEl => {
      const valSpan = rangeEl.parentElement.querySelector(".field-range-val");
      rangeEl.addEventListener("input", () => { valSpan.textContent = rangeEl.value; });
    });

    // Section signature : initialiser le pad de dessin (canvas)
    if (FormEngine.getCurrentSection().type === "signature") {
      SignaturePad.init(container);
    }

    updateFormHeader();
    updateFormNavButtons();
    bindAutosave(container);
  }

  function updateFormHeader() {
    const section = FormEngine.getCurrentSection();
    const profileConfig = FormEngine.getProfileConfig();
    document.getElementById("formStepTitle").textContent = profileConfig.label;
    document.getElementById("formStepSubtitle").textContent =
      `Étape ${FormEngine.currentSectionIndex + 1} sur ${FormEngine.totalSections()} — ${section.title}`;

    const dotsContainer = document.getElementById("formProgressDots");
    dotsContainer.innerHTML = FormEngine.getSections().map((s, i) => {
      let cls = "step-dot";
      if (i === FormEngine.currentSectionIndex) cls += " active";
      else if (i < FormEngine.currentSectionIndex) cls += " done";
      return `<span class="${cls}"></span>`;
    }).join("");
  }

  function updateFormNavButtons() {
    document.getElementById("formPrevBtn").style.visibility = FormEngine.isFirstSection() ? "hidden" : "visible";
    const nextBtn = document.getElementById("formNextBtn");
    nextBtn.textContent = FormEngine.isLastSection() ? "Voir mon CV →" : "Suivant →";
  }

  function bindAutosave(container) {
    clearTimeout(state.autosaveTimer);
    container.addEventListener("input", () => {
      clearTimeout(state.autosaveTimer);
      state.autosaveTimer = setTimeout(() => {
        FormEngine.collectFromDom(container);
        persistSubmission("En cours");
      }, 1200);
    });
  }

  async function persistSubmission(statut) {
    if (!state.code) return;
    await Api.saveSubmission({
      code: state.code,
      profil: state.profileId,
      paletteId: state.paletteId,
      statut,
      donnees: FormEngine.getData()
    });
  }

  function initFormNav() {
    document.getElementById("formPrevBtn").addEventListener("click", () => {
      const container = document.getElementById("formSectionContainer");
      FormEngine.collectFromDom(container);
      FormEngine.goPrev();
      renderFormSection();
    });

    document.getElementById("formNextBtn").addEventListener("click", async () => {
      const container = document.getElementById("formSectionContainer");
      FormEngine.collectFromDom(container);

      if (!FormEngine.validateCurrentSection(container)) {
        const isSignatureSection = FormEngine.getCurrentSection().type === "signature";
        toast(isSignatureSection ? "Merci de signer avant de continuer." : "Merci de remplir tous les champs obligatoires (*).", "error");
        return;
      }

      if (FormEngine.isLastSection()) {
        showLoader(true);
        await persistSubmission("Terminé - en attente téléchargement");
        showLoader(false);
        showView("viewPreview");
        renderPreview();
      } else {
        FormEngine.goNext();
        renderFormSection();
      }
    });
  }

  /* ============================================================
     ÉTAPE 5 — APERÇU + TÉLÉCHARGEMENT
     ============================================================ */

  function renderPreview() {
    const palette = getPalette(state.paletteId);
    const data = FormEngine.getData();
    const html = renderCvHtml(state.profileId, data, palette);

    const wrap = document.getElementById("cvPreviewWrap");
    wrap.innerHTML = html;

    scaleCvPreview();
    window.addEventListener("resize", scaleCvPreview);
  }

  function scaleCvPreview() {
    const wrap = document.getElementById("cvPreviewWrap");
    const cvDoc = wrap.querySelector(".cv-doc");
    if (!cvDoc) return;
    const containerWidth = wrap.parentElement.clientWidth - 20;
    const cvWidthPx = cvDoc.offsetWidth || 794; // ~210mm at 96dpi
    const scale = Math.min(1, containerWidth / cvWidthPx);
    cvDoc.style.transform = `scale(${scale})`;
    cvDoc.style.transformOrigin = "top center";
    wrap.style.height = (cvDoc.offsetHeight * scale + 20) + "px";
  }

  function initPreviewActions() {
    document.getElementById("downloadPdfBtn").addEventListener("click", async () => {
      showLoader(true);
      try {
        const cvDoc = document.querySelector("#cvPreviewWrap .cv-doc");
        const data = FormEngine.getData();
        const filename = sanitizeFilename(`CV_${(data.NOM||"").trim()}_${(data.PRENOMS||"").trim()}.pdf`);
        await DocGenerator.generatePdf(cvDoc, filename);
        await finalizeDownload();
        toast("CV PDF téléchargé avec succès !", "success");
      } catch (err) {
        toast("Erreur lors de la génération du PDF.", "error");
      }
      showLoader(false);
    });

    document.getElementById("downloadWordBtn").addEventListener("click", async () => {
      showLoader(true);
      try {
        const palette = getPalette(state.paletteId);
        const data = FormEngine.getData();
        const filename = sanitizeFilename(`CV_${(data.NOM||"").trim()}_${(data.PRENOMS||"").trim()}.docx`);
        await DocGenerator.generateDocx(state.profileId, data, palette.primary, filename);
        await finalizeDownload();
        toast("CV Word téléchargé avec succès !", "success");
      } catch (err) {
        toast("Erreur lors de la génération du fichier Word.", "error");
      }
      showLoader(false);
    });

    document.getElementById("backToFormBtn").addEventListener("click", () => {
      showView("viewForm");
      renderFormSection();
    });
  }

  let codeConsumed = false;
  async function finalizeDownload() {
    await persistSubmission("Téléchargé");
    if (!codeConsumed && state.code) {
      await Api.consumeCode(state.code, state.profileId);
      codeConsumed = true;
    }
  }

  /* ============================================================
     ESPACE ADMIN
     ============================================================ */

  let adminPassword = null;

  function initAdmin() {
    const loginBtn = document.getElementById("adminLoginBtn");
    if (loginBtn) {
      loginBtn.addEventListener("click", async () => {
        const pwd = document.getElementById("adminPasswordInput").value;
        showLoader(true);
        const res = await Api.adminLogin(pwd);
        showLoader(false);
        if (!res.ok) {
          document.getElementById("adminLoginError").textContent = res.error || "Mot de passe incorrect.";
          return;
        }
        adminPassword = pwd;
        showView("viewAdminDashboard");
        loadAdminData();
      });
    }

    const unlockBtn = document.getElementById("adminUnlockBtn");
    if (unlockBtn) {
      unlockBtn.addEventListener("click", async () => {
        const code = document.getElementById("adminUnlockInput").value.trim().toUpperCase();
        if (!code) return;
        showLoader(true);
        const res = await Api.adminUnlockCode(adminPassword, code);
        showLoader(false);
        toast(res.ok ? "Code réactivé avec succès." : (res.error || "Erreur."), res.ok ? "success" : "error");
      });
    }
  }

  async function loadAdminData() {
    showLoader(true);
    const [statsRes, listRes] = await Promise.all([
      Api.adminStats(adminPassword),
      Api.adminListSubmissions(adminPassword)
    ]);
    showLoader(false);

    if (statsRes.ok) {
      const s = statsRes.stats;
      document.getElementById("adminStatsBar").innerHTML = `
        <div><strong>${s.total}</strong> codes au total</div>
        <div><strong>${s.disponibles}</strong> disponibles</div>
        <div><strong>${s.utilises}</strong> utilisés</div>
        <div><strong>${s.nbSoumissions}</strong> soumissions clients</div>
      `;
    }

    if (listRes.ok) {
      const tbody = document.getElementById("adminSubmissionsBody");
      tbody.innerHTML = listRes.submissions.map(s => `
        <tr>
          <td>${s.code}</td>
          <td>${s.profil}</td>
          <td>${s.nom} ${s.prenoms}</td>
          <td>${s.email}</td>
          <td>${s.tel}</td>
          <td><span class="status-badge ${s.statut === 'Téléchargé' ? 'ok' : 'pending'}">${s.statut}</span></td>
          <td><button class="btn btn-outline btn-sm" data-view-sub="${s.submissionId}">Voir / Télécharger</button></td>
        </tr>
      `).join("");

      tbody.querySelectorAll("[data-view-sub]").forEach(btn => {
        btn.addEventListener("click", () => openAdminSubmissionDetail(btn.dataset.viewSub));
      });
    }
  }

  async function openAdminSubmissionDetail(submissionId) {
    showLoader(true);
    const res = await Api.adminGetSubmission(adminPassword, submissionId);
    showLoader(false);
    if (!res.ok) { toast(res.error, "error"); return; }

    const sub = res.submission;
    state.profileId = sub.profil;
    state.paletteId = sub.paletteId || CV_CONFIG.palettes[0].id;
    FormEngine.init(sub.profil, sub.donnees);
    state.code = sub.code;
    codeConsumed = true; // pour ne pas re-consommer le code depuis l'admin

    showView("viewPreview");
    renderPreview();
    toast("Dossier client chargé. Vous pouvez télécharger pour le lui envoyer.", "success");
  }

  /* ============================================================
     INITIALISATION GLOBALE
     ============================================================ */

  function init() {
    initGateView();
    initFormNav();
    initPreviewActions();
    initAdmin();

    document.querySelectorAll("[data-restart]").forEach(btn => {
      btn.addEventListener("click", () => location.reload());
    });
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init); 
