/* ============================================================
   CV BOOSTER PRO — Génération de fichiers PDF et Word
   100% côté client (navigateur), aucun serveur nécessaire.
   PDF  : jsPDF en texte natif (mêmes données que le Word, pas une
          image) — vrai texte sélectionnable, copiable, et lisible
          directement par l'outil Scan sans OCR.
   Word : librairie "docx" (UMD, exposée comme window.docx)
   ============================================================ */

const DocGenerator = (() => {

  function hexToRgb(hex) {
    let clean = (hex || "1d4f91").replace("#", "");
    if (clean.length === 3) clean = clean.split("").map(c => c + c).join("");
    const n = parseInt(clean, 16);
    if (isNaN(n)) return [29, 79, 145];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  /**
   * Génère un PDF en texte natif (pas une capture d'écran) à partir des
   * mêmes données que le Word, et déclenche le téléchargement.
   *
   * On gère nous-mêmes la mise en page ligne par ligne avec jsPDF
   * (pdf.text), en vérifiant avant CHAQUE ligne s'il reste la place sur
   * la page ; si non, on passe à la page suivante avant de la dessiner.
   * Comme on ne découpe jamais une ligne déjà tracée mais qu'on choisit
   * la page AVANT de la tracer, une phrase ne peut structurellement plus
   * jamais se retrouver coupée en deux entre deux pages.
   */
  async function generatePdf(profileId, data, paletteHexPrimary, filename) {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    const PAGE_W = 210, PAGE_H = 297;
    const MARGIN_X = 16, MARGIN_TOP = 16, MARGIN_BOTTOM = 16;
    const CONTENT_W = PAGE_W - MARGIN_X * 2;
    const [r, g, b] = hexToRgb(paletteHexPrimary);

    let y = MARGIN_TOP;

    function ensureSpace(neededMm) {
      if (y + neededMm > PAGE_H - MARGIN_BOTTOM) {
        pdf.addPage();
        y = MARGIN_TOP;
      }
    }

    function mmPerLine(sizePt, lineFactor) {
      return sizePt * 0.3528 * (lineFactor || 1.32);
    }

    // Dessine un bloc de texte avec retour à la ligne automatique ; la
    // pagination est vérifiée ligne par ligne (jamais bloc par bloc), donc
    // un paragraphe peut s'étaler sur deux pages, mais toujours coupé
    // proprement entre deux lignes, jamais au milieu d'une.
    function drawWrapped(text, opts) {
      opts = opts || {};
      if (!text) return;
      const size = opts.size || 10.5;
      const bold = !!opts.bold;
      const italic = !!opts.italic;
      const color = opts.color || [45, 45, 50];
      const indent = opts.indent || 0;
      const bullet = !!opts.bullet;

      y += (opts.spacingBefore || 0);
      let style = "normal";
      if (bold && italic) style = "bolditalic";
      else if (bold) style = "bold";
      else if (italic) style = "italic";
      pdf.setFont("helvetica", style);
      pdf.setFontSize(size);
      pdf.setTextColor(color[0], color[1], color[2]);

      const usableWidth = CONTENT_W - indent - (bullet ? 4.5 : 0);
      const lines = pdf.splitTextToSize(String(text), usableWidth);
      const lh = mmPerLine(size);

      lines.forEach((line, idx) => {
        ensureSpace(lh);
        const x = MARGIN_X + indent + (bullet ? 4.5 : 0);
        if (bullet && idx === 0) {
          pdf.setFillColor(color[0], color[1], color[2]);
          pdf.circle(MARGIN_X + indent + 1.3, y - lh * 0.32, 0.55, "F");
        }
        pdf.text(line, x, y);
        y += lh;
      });

      y += (opts.spacingAfter !== undefined ? opts.spacingAfter : 1.6);
    }

    function addSectionTitle(title) {
      ensureSpace(12);
      y += 3;
      ensureSpace(7);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12.5);
      pdf.setTextColor(r, g, b);
      pdf.text(String(title || "").toUpperCase(), MARGIN_X, y);
      y += 1.8;
      pdf.setDrawColor(225, 225, 230);
      pdf.setLineWidth(0.25);
      pdf.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
      y += 5;
    }

    // -- En-tête --
    const HEADER_H = 30;
    pdf.setFillColor(r, g, b);
    pdf.rect(0, 0, PAGE_W, HEADER_H, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(19);
    pdf.setTextColor(255, 255, 255);
    pdf.text(`${data.NOM || ""} ${data.PRENOMS || ""}`.trim(), MARGIN_X, 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    const titleLine = `${data.TITRE || ""}${data.ANNEES_EXPERIENCES ? "  ·  " + data.ANNEES_EXPERIENCES + " d'expérience" : ""}`;
    pdf.text(titleLine, MARGIN_X, 22);

    pdf.setFontSize(9);
    pdf.text(`${data.TEL || ""}  ·  ${data.EMAIL || ""}`, PAGE_W - MARGIN_X, 10, { align: "right" });
    pdf.text(`${data.ADRESSE || ""}, ${data.PAYS || ""}`, PAGE_W - MARGIN_X, 15, { align: "right" });
    pdf.text(`${data.SEXE || ""}`, PAGE_W - MARGIN_X, 20, { align: "right" });

    y = HEADER_H + 10;

    const order = CV_RENDER_ORDER[profileId];
    const profileConfig = CV_CONFIG.profiles[profileId];

    if (data.QUEL_EST_VOTRE_PROFIL) {
      addSectionTitle("Profil");
      drawWrapped(data.QUEL_EST_VOTRE_PROFIL, { italic: true, spacingAfter: 3 });
    }

    order.forEach(sectionId => {
      const section = profileConfig.sections.find(s => s.id === sectionId);
      if (!section) return;

      if (sectionId === "formations") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Formation");
        items.forEach(it => {
          drawWrapped(`${it.DIPLOME}    ${it.DEBUT} – ${it.FIN}`, { bold: true, spacingAfter: 0.6 });
          drawWrapped(`${it.ECOLE}, ${it.LIEU}`, { size: 9.5, color: [95, 95, 100], spacingAfter: 0.6 });
          drawWrapped(it.PETITE_DESCRIPTION, { spacingAfter: 3 });
        });
      } else if (sectionId === "competences") {
        if (!data.LISTEZ_1 && !data.LISTEZ_2) return;
        addSectionTitle("Compétences & Certifications");
        if (data.LISTEZ_1) drawWrapped(data.LISTEZ_1, { spacingAfter: 1.6 });
        if (data.LISTEZ_2) drawWrapped(data.LISTEZ_2, { spacingAfter: 3 });
      } else if (sectionId === "experiences") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Expériences professionnelles");
        items.forEach(it => {
          drawWrapped(`${it.POSTE}    ${it.DEBUT} – ${it.FIN}`, { bold: true, spacingAfter: 0.6 });
          drawWrapped(`${it.SOCIETE}, ${it.LIEU}`, { size: 9.5, color: [95, 95, 100], spacingAfter: 0.6 });
          drawWrapped(it.TACHES_EFFECTUEES, { spacingAfter: 3 });
        });
      } else if (sectionId === "benevolat") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Bénévolat & Expériences extra-professionnelles");
        items.forEach(it => {
          drawWrapped(`${it.ROLE}    ${it.DEPART} – ${it.TERME}`, { bold: true, spacingAfter: 0.6 });
          drawWrapped(`${it.STRUCTURE} ${it.OU}`, { size: 9.5, color: [95, 95, 100], spacingAfter: 0.6 });
          drawWrapped(it.ACTIVITES_MENEES, { spacingAfter: 3 });
        });
      } else if (sectionId === "langues") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Langues");
        items.forEach(it => drawWrapped(`${it.LANGUE} — ${it.NIVEAU}/5`, { bullet: true, spacingAfter: 1 }));
      } else if (sectionId === "references") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Références");
        items.forEach(it => drawWrapped(it.PERSONNE, { bullet: true, spacingAfter: 1 }));
      } else if (sectionId === "interets") {
        if (!data.LISTEZ_LES) return;
        addSectionTitle("Centres d'intérêt");
        drawWrapped(data.LISTEZ_LES, { spacingAfter: 3 });
      }
    });

    // -- Déclaration + signature --
    ensureSpace(20);
    y += 4;
    pdf.setDrawColor(225, 225, 230);
    pdf.setLineWidth(0.25);
    pdf.line(MARGIN_X, y, PAGE_W - MARGIN_X, y);
    y += 5;
    drawWrapped("Je déclare sur l'honneur que toutes ces informations sont vraies et vérifiables.", { italic: true, size: 9, color: [95, 95, 100], spacingAfter: 1 });
    drawWrapped(`${data.VOTRE_VILLE || ""}, le ${data.LA_DATE || ""}`, { bold: true, size: 9.5, spacingAfter: 1 });

    if (data.SIGNATURE_DATA) {
      const sigW = 34, sigH = 12;
      ensureSpace(sigH + 2);
      try {
        const format = /image\/png/i.test(data.SIGNATURE_DATA) ? "PNG" : "JPEG";
        pdf.addImage(data.SIGNATURE_DATA, format, PAGE_W - MARGIN_X - sigW, y, sigW, sigH);
        y += sigH + 2;
      } catch (e) {
        // signature illisible : on l'ignore plutôt que de faire échouer tout le PDF
      }
    }

    pdf.save(filename.toLowerCase().endsWith(".pdf") ? filename : filename + ".pdf");
  }


  /* ---------- Génération Word (.docx) ---------- */
  // On reconstruit le contenu en paragraphes docx natifs (pas une image),
  // pour produire un vrai fichier Word modifiable, avec la police d'origine.

  async function buildDocxParagraphs(profileId, data, paletteHexPrimary) {
    const { Paragraph, TextRun, BorderStyle } = window.docx;
    const order = CV_RENDER_ORDER[profileId];
    const profileConfig = CV_CONFIG.profiles[profileId];
    const children = [];

    const colorHex = (paletteHexPrimary || "#1d4f91").replace("#", "");

    // En-tête
    children.push(new Paragraph({
      children: [new TextRun({ text: `${data.NOM || ""} ${data.PRENOMS || ""}`.trim(), bold: true, size: 36, color: colorHex, font: "Calibri" })],
      spacing: { after: 60 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: `${data.TITRE || ""}${data.ANNEES_EXPERIENCES ? " — " + data.ANNEES_EXPERIENCES + " d'expérience" : ""}`, bold: true, size: 24, font: "Calibri" })],
      spacing: { after: 120 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: colorHex, space: 4 } }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: `${data.TEL || ""}  ·  ${data.EMAIL || ""}  ·  ${data.ADRESSE || ""}, ${data.PAYS || ""}`, size: 20, font: "Calibri" })],
      spacing: { after: 40 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: `${data.SEXE || ""}`, size: 20, font: "Calibri" })],
      spacing: { after: 200 }
    }));

    function addSectionTitle(title) {
      children.push(new Paragraph({
        children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 26, color: colorHex, font: "Calibri" })],
        spacing: { before: 200, after: 100 }
      }));
    }

    function addLine(text, opts = {}) {
      children.push(new Paragraph({
        children: [new TextRun({ text: text || "", size: 20, font: "Calibri", bold: !!opts.bold, italics: !!opts.italics })],
        spacing: { after: opts.after !== undefined ? opts.after : 40 }
      }));
    }

    function addBullet(text) {
      children.push(new Paragraph({
        children: [new TextRun({ text: text || "", size: 20, font: "Calibri" })],
        bullet: { level: 0 },
        spacing: { after: 60 }
      }));
    }

    if (data.QUEL_EST_VOTRE_PROFIL) {
      addSectionTitle("Profil");
      addLine(data.QUEL_EST_VOTRE_PROFIL, { italics: true, after: 160 });
    }

    order.forEach(sectionId => {
      const section = profileConfig.sections.find(s => s.id === sectionId);
      if (!section) return;

      if (sectionId === "formations") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Formation");
        items.forEach(it => {
          addLine(`${it.DIPLOME}   ${it.DEBUT} – ${it.FIN}`, { bold: true });
          addLine(`${it.ECOLE}, ${it.LIEU}`);
          addLine(it.PETITE_DESCRIPTION, { after: 140 });
        });
      } else if (sectionId === "competences") {
        if (!data.LISTEZ_1 && !data.LISTEZ_2) return;
        addSectionTitle("Compétences & Certifications");
        if (data.LISTEZ_1) addLine(data.LISTEZ_1);
        if (data.LISTEZ_2) addLine(data.LISTEZ_2, { after: 160 });
      } else if (sectionId === "experiences") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Expériences professionnelles");
        items.forEach(it => {
          addLine(`${it.POSTE}   ${it.DEBUT} – ${it.FIN}`, { bold: true });
          addLine(`${it.SOCIETE}, ${it.LIEU}`);
          addLine(it.TACHES_EFFECTUEES, { after: 140 });
        });
      } else if (sectionId === "benevolat") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Bénévolat & Expériences extra-professionnelles");
        items.forEach(it => {
          addLine(`${it.ROLE}   ${it.DEPART} – ${it.TERME}`, { bold: true });
          addLine(`${it.STRUCTURE} ${it.OU}`);
          addLine(it.ACTIVITES_MENEES, { after: 140 });
        });
      } else if (sectionId === "langues") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Langues");
        items.forEach(it => addBullet(`${it.LANGUE} — ${it.NIVEAU}/5`));
      } else if (sectionId === "references") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Références");
        items.forEach(it => addBullet(it.PERSONNE));
      } else if (sectionId === "interets") {
        if (!data.LISTEZ_LES) return;
        addSectionTitle("Centres d'intérêt");
        addLine(data.LISTEZ_LES);
      }
    });

    addSectionTitle("");
    addLine("Je déclare sur l'honneur que toutes ces informations sont vraies et vérifiables.", { italics: true });
    addLine(`${data.VOTRE_VILLE || ""}, le ${data.LA_DATE || ""}`, { bold: true });

    if (data.SIGNATURE_DATA) {
      const { ImageRun, AlignmentType } = window.docx;
      children.push(new Paragraph({
        children: [new ImageRun({
          data: data.SIGNATURE_DATA,
          transformation: { width: 160, height: 55 }
        })],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 100 }
      }));
    }

    return children;
  }

  function collectRepeatItems(data, section) {
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
      if (hasValue) items.push(item);
    }
    return items;
  }

  async function generateDocx(profileId, data, paletteHexPrimary, filename) {
    const { Document, Packer } = window.docx;
    const children = await buildDocxParagraphs(profileId, data, paletteHexPrimary);

    const doc = new Document({
      styles: { default: { document: { run: { font: "Calibri", size: 20 } } } },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 }
          }
        },
        children
      }]
    });

    const blob = await Packer.toBlob(doc);
    triggerBlobDownload(blob, filename);
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { generatePdf, generateDocx };
})();
