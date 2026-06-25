/* ============================================================
   CV BOOSTER PRO — Moteur de rendu du CV
   Transforme les données du formulaire en HTML structuré,
   stylé selon la palette choisie, prêt pour aperçu / PDF / Word.
   ============================================================ */

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function nl2br(str) {
  return escapeHtml(str).replace(/\n/g, "<br>");
}

// Construit la liste des items répétables (ex: 3 formations) à partir des données plates
function buildRepeatItems(data, section) {
  const items = [];
  for (let i = 1; i <= section.count; i++) {
    const item = {};
    let hasValue = false;
    section.itemFields.forEach(f => {
      const flatKey = `${section.repeatKey}_${i}_${f.key}`;
      const val = data[flatKey];
      item[f.key] = val;
      if (val && String(val).trim() !== "") hasValue = true;
    });
    item.__index = i;
    if (hasValue) items.push(item);
  }
  return items;
}

function renderSectionHtml(sectionId, profileConfig, data) {
  const section = profileConfig.sections.find(s => s.id === sectionId);
  if (!section) return "";

  switch (sectionId) {
    case "formations": {
      const items = buildRepeatItems(data, section);
      if (!items.length) return "";
      return `
        <div class="cv-section">
          <h2 class="cv-h2">Formation</h2>
          <div class="cv-section-line"></div>
          <ul class="cv-list">
            ${items.map(it => `
              <li class="cv-item">
                <div class="cv-item-row">
                  <span class="cv-item-title">${escapeHtml(it.DIPLOME)}</span>
                  <span class="cv-item-dates">${escapeHtml(it.DEBUT)} – ${escapeHtml(it.FIN)}</span>
                </div>
                <div class="cv-item-subtitle">${escapeHtml(it.ECOLE)}, ${escapeHtml(it.LIEU)}</div>
                <div class="cv-item-desc">${nl2br(it.PETITE_DESCRIPTION)}</div>
              </li>
            `).join("")}
          </ul>
        </div>`;
    }

    case "competences": {
      const c1 = data.LISTEZ_1;
      const c2 = data.LISTEZ_2;
      if (!c1 && !c2) return "";
      return `
        <div class="cv-section">
          <h2 class="cv-h2">Compétences &amp; Certifications</h2>
          <div class="cv-section-line"></div>
          ${c1 ? `<div class="cv-item-desc">${nl2br(c1)}</div>` : ""}
          ${c2 ? `<div class="cv-item-desc">${nl2br(c2)}</div>` : ""}
        </div>`;
    }

    case "experiences": {
      const items = buildRepeatItems(data, section);
      if (!items.length) return "";
      return `
        <div class="cv-section">
          <h2 class="cv-h2">Expériences professionnelles</h2>
          <div class="cv-section-line"></div>
          <ul class="cv-list">
            ${items.map(it => `
              <li class="cv-item">
                <div class="cv-item-row">
                  <span class="cv-item-title">${escapeHtml(it.POSTE)}</span>
                  <span class="cv-item-dates">${escapeHtml(it.DEBUT)} – ${escapeHtml(it.FIN)}</span>
                </div>
                <div class="cv-item-subtitle">${escapeHtml(it.SOCIETE)}, ${escapeHtml(it.LIEU)}</div>
                <div class="cv-item-desc">${nl2br(it.TACHES_EFFECTUEES)}</div>
              </li>
            `).join("")}
          </ul>
        </div>`;
    }

    case "benevolat": {
      const items = buildRepeatItems(data, section);
      if (!items.length) return "";
      return `
        <div class="cv-section">
          <h2 class="cv-h2">Bénévolat &amp; Expériences extra-professionnelles</h2>
          <div class="cv-section-line"></div>
          <ul class="cv-list">
            ${items.map(it => `
              <li class="cv-item">
                <div class="cv-item-row">
                  <span class="cv-item-title">${escapeHtml(it.ROLE)}</span>
                  <span class="cv-item-dates">${escapeHtml(it.DEPART)} – ${escapeHtml(it.TERME)}</span>
                </div>
                <div class="cv-item-subtitle">${escapeHtml(it.STRUCTURE)} ${escapeHtml(it.OU)}</div>
                <div class="cv-item-desc">${nl2br(it.ACTIVITES_MENEES)}</div>
              </li>
            `).join("")}
          </ul>
        </div>`;
    }

    case "langues": {
      const items = buildRepeatItems(data, section);
      if (!items.length) return "";
      return `
        <div class="cv-section">
          <h2 class="cv-h2">Langues</h2>
          <div class="cv-section-line"></div>
          <ul class="cv-list cv-list-langues">
            ${items.map(it => `
              <li class="cv-lang-item">
                <span class="cv-lang-name">${escapeHtml(it.LANGUE)}</span>
                <span class="cv-lang-bar"><span class="cv-lang-fill" style="width:${(Number(it.NIVEAU)||0)*20}%"></span></span>
              </li>
            `).join("")}
          </ul>
        </div>`;
    }

    case "references": {
      const items = buildRepeatItems(data, section);
      if (!items.length) return "";
      return `
        <div class="cv-section">
          <h2 class="cv-h2">Références</h2>
          <div class="cv-section-line"></div>
          <ul class="cv-list">
            ${items.map(it => `<li class="cv-item cv-item-compact">${nl2br(it.PERSONNE)}</li>`).join("")}
          </ul>
        </div>`;
    }

    case "interets": {
      if (!data.LISTEZ_LES) return "";
      return `
        <div class="cv-section">
          <h2 class="cv-h2">Centres d'intérêt</h2>
          <div class="cv-section-line"></div>
          <div class="cv-item-desc">${nl2br(data.LISTEZ_LES)}</div>
        </div>`;
    }

    default:
      return "";
  }
}

/**
 * Génère le HTML complet du CV (sans <html>/<head>, juste le bloc CV)
 * @param {string} profileId - 'debutant' | 'intermediaire' | 'experimente'
 * @param {object} data - données plates du formulaire (clé -> valeur)
 * @param {object} palette - objet palette issu de CV_CONFIG.palettes
 * @param {string} logoDataUrl - logo CV Booster Pro en base64 (optionnel)
 */
function renderCvHtml(profileId, data, palette, logoDataUrl) {
  const profileConfig = CV_CONFIG.profiles[profileId];
  const order = CV_RENDER_ORDER[profileId];

  const sectionsHtml = order.map(sid => renderSectionHtml(sid, profileConfig, data)).join("");

  const isClassic = palette.style === "classic";

  return `
    <div class="cv-doc cv-style-${palette.style}" style="
      --cv-primary:${palette.primary};
      --cv-secondary:${palette.secondary};
      --cv-accent:${palette.accent};
      --cv-text:${palette.text};
      --cv-textlight:${palette.textLight};
      --cv-bglight:${palette.bgLight};
    ">
      <header class="cv-header">
        <div class="cv-header-main">
          <h1 class="cv-name">${escapeHtml(data.NOM)} ${escapeHtml(data.PRENOMS)}</h1>
          <p class="cv-title">${escapeHtml(data.TITRE)}${data.ANNEES_EXPERIENCES ? ` · ${escapeHtml(data.ANNEES_EXPERIENCES)} d'expérience` : ""}</p>
        </div>
        <div class="cv-header-contact">
          <p>${escapeHtml(data.TEL)} · ${escapeHtml(data.EMAIL)}</p>
          <p>${escapeHtml(data.ADRESSE)}, ${escapeHtml(data.PAYS)}</p>
          <p>${escapeHtml(data.SEXE)} · ${escapeHtml(data.ETAT_CIVIL)}</p>
        </div>
      </header>

      ${data.QUEL_EST_VOTRE_PROFIL ? `
      <div class="cv-section cv-profile">
        <h2 class="cv-h2">Profil</h2>
        <div class="cv-section-line"></div>
        <div class="cv-item-desc">${nl2br(data.QUEL_EST_VOTRE_PROFIL)}</div>
      </div>` : ""}

      ${sectionsHtml}

      <footer class="cv-footer">
        <p class="cv-declaration">Je déclare sur l'honneur que toutes ces informations sont vraies et vérifiables.</p>
        <p class="cv-place-date">${escapeHtml(data.VOTRE_VILLE)}, le ${escapeHtml(data.LA_DATE)}</p>
      </footer>
    </div>
  `;
}
