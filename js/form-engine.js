/* ============================================================
   CV BOOSTER PRO — Moteur de formulaire dynamique
   Génère les champs HTML à partir de CV_CONFIG.profiles[x].sections
   et gère la navigation pas-à-pas + la collecte des données.
   ============================================================ */

const FormEngine = (() => {

  let currentProfileId = null;
  let currentSectionIndex = 0;
  let formData = {}; // clé plate -> valeur, ex: "NOM", "formation_1_DIPLOME"

  function init(profileId, existingData) {
    currentProfileId = profileId;
    currentSectionIndex = 0;
    formData = existingData ? { ...existingData } : {};
  }

  function getProfileConfig() {
    return CV_CONFIG.profiles[currentProfileId];
  }

  function getSections() {
    return getProfileConfig().sections;
  }

  function getCurrentSection() {
    return getSections()[currentSectionIndex];
  }

  function getData() {
    return formData;
  }

  function setData(key, value) {
    formData[key] = value;
  }

  function totalSections() {
    return getSections().length;
  }

  function isFirstSection() { return currentSectionIndex === 0; }
  function isLastSection() { return currentSectionIndex === totalSections() - 1; }

  function goNext() {
    if (!isLastSection()) currentSectionIndex++;
    return currentSectionIndex;
  }

  function goPrev() {
    if (!isFirstSection()) currentSectionIndex--;
    return currentSectionIndex;
  }

  function goTo(index) {
    if (index >= 0 && index < totalSections()) currentSectionIndex = index;
    return currentSectionIndex;
  }

  /* ---------- Rendu HTML d'un champ simple ---------- */
  function renderField(field, flatKey, fullWidth) {
    const value = formData[flatKey] !== undefined ? formData[flatKey] : "";
    const reqMark = field.required ? '<span class="req">*</span>' : "";
    const reqAttr = field.required ? "data-required=\"1\"" : "";
    let inputHtml = "";

    switch (field.type) {
      case "textarea":
        inputHtml = `<textarea class="field-textarea" data-key="${flatKey}" ${reqAttr} placeholder="${field.placeholder || ""}">${escapeHtml(value)}</textarea>`;
        break;
      case "select":
        inputHtml = `<select class="field-select" data-key="${flatKey}" ${reqAttr}>
          <option value="">-- Choisir --</option>
          ${field.options.map(opt => `<option value="${escapeHtml(opt)}" ${opt === value ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}
        </select>`;
        break;
      case "range": {
        const v = value || field.min || 1;
        inputHtml = `<div class="field-range-wrap">
          <input type="range" data-key="${flatKey}" min="${field.min}" max="${field.max}" value="${v}" ${reqAttr}>
          <span class="field-range-val">${v}</span>
        </div>`;
        break;
      }
      default:
        inputHtml = `<input type="${field.type === 'tel' || field.type === 'email' ? field.type : 'text'}" class="field-input" data-key="${flatKey}" ${reqAttr} placeholder="${field.placeholder || ""}" value="${escapeHtml(value)}">`;
    }

    return `
      <div class="field-group ${fullWidth ? "full" : ""}">
        <label class="field-label">${field.label}${reqMark}</label>
        ${inputHtml}
      </div>
    `;
  }

  const FULL_WIDTH_TYPES = ["textarea"];

  /* ---------- Rendu HTML de la section courante ---------- */
  function renderCurrentSectionHtml() {
    const section = getCurrentSection();

    if (section.type === "signature") {
      return renderSignatureSectionHtml(section);
    }

    let bodyHtml = "";

    if (section.repeatable) {
      for (let i = 1; i <= section.count; i++) {
        // Seule la 1ère occurrence est obligatoire : le client peut ne pas avoir
        // de 2e/3e formation, expérience, etc. (cf. consignes des Forms d'origine)
        const isOptionalOccurrence = i > 1;
        bodyHtml += `<div class="repeat-item">
          <div class="repeat-item-label">${section.title} ${i}${isOptionalOccurrence ? ' <span class="field-hint">(facultatif)</span>' : ""}</div>
          <div class="form-grid">
            ${section.itemFields.map(f => {
              const flatKey = `${section.repeatKey}_${i}_${f.key}`;
              const effectiveField = isOptionalOccurrence ? { ...f, required: false } : f;
              return renderField(effectiveField, flatKey, FULL_WIDTH_TYPES.includes(f.type));
            }).join("")}
          </div>
        </div>`;
      }
    } else {
      bodyHtml = `<div class="form-grid">
        ${section.fields.map(f => renderField(f, f.key, FULL_WIDTH_TYPES.includes(f.type))).join("")}
      </div>`;
    }

    return `
      <div class="form-card">
        <h3 class="form-section-title">${section.title}</h3>
        <p class="form-section-desc">${section.description}</p>
        ${bodyHtml}
      </div>
    `;
  }

  /* ---------- Rendu HTML spécial pour la signature (canvas) ---------- */
  function renderSignatureSectionHtml(section) {
    const existingSignature = formData.SIGNATURE_DATA || "";
    return `
      <div class="form-card">
        <h3 class="form-section-title">${section.title}</h3>
        <p class="form-section-desc">${section.description}</p>
        <div class="signature-wrap">
          <canvas id="signatureCanvas" class="signature-canvas" width="600" height="200"></canvas>
          <div class="signature-placeholder" id="signaturePlaceholder">Signez ici</div>
        </div>
        <div class="signature-actions">
          <button type="button" class="btn btn-outline btn-sm" id="signatureClearBtn">🗑️ Effacer</button>
          <span class="signature-status" id="signatureStatus"></span>
        </div>
        <input type="hidden" id="signatureDataInput" data-key="SIGNATURE_DATA" data-required="1" value="${existingSignature ? escapeHtml(existingSignature) : ""}">
      </div>
    `;
  }

  /* ---------- Lecture des valeurs saisies dans le DOM courant ---------- */
  function collectFromDom(containerEl) {
    const inputs = containerEl.querySelectorAll("[data-key]");
    inputs.forEach(el => {
      const key = el.dataset.key;
      formData[key] = el.value;
    });
  }

  /* ---------- Validation de la section courante ---------- */
  function validateCurrentSection(containerEl) {
    const requiredInputs = containerEl.querySelectorAll("[data-required='1']");
    let allValid = true;
    let firstInvalid = null;
    requiredInputs.forEach(el => {
      const empty = !el.value || el.value.trim() === "";
      el.classList.toggle("field-error", empty);
      if (empty) {
        allValid = false;
        if (!firstInvalid) firstInvalid = el;
      }
    });

    // Cas particulier : la signature est un input caché, on signale l'erreur
    // visuellement sur le canvas et un message, plutôt qu'un focus invisible.
    const signatureInput = containerEl.querySelector("#signatureDataInput");
    if (signatureInput) {
      const canvas = containerEl.querySelector("#signatureCanvas");
      const statusEl = containerEl.querySelector("#signatureStatus");
      const isEmpty = !signatureInput.value;
      if (canvas) canvas.classList.toggle("signature-error", isEmpty);
      if (statusEl) statusEl.textContent = isEmpty ? "Merci de signer avant de continuer." : "";
      if (isEmpty) {
        allValid = false;
        firstInvalid = null; // pas de .focus() pertinent ici
      }
    }

    if (firstInvalid) firstInvalid.focus();
    return allValid;
  }

  return {
    init,
    getProfileConfig,
    getSections,
    getCurrentSection,
    getData,
    setData,
    totalSections,
    isFirstSection,
    isLastSection,
    goNext,
    goPrev,
    goTo,
    renderCurrentSectionHtml,
    collectFromDom,
    validateCurrentSection,
    get currentSectionIndex() { return currentSectionIndex; }
  };
})();
