/* ============================================================
   CV BOOSTER PRO — Génération de fichiers PDF et Word
   100% côté client (navigateur), aucun serveur nécessaire.
   PDF  : html2canvas (capture le rendu HTML/CSS) + jsPDF
   Word : librairie "docx" (UMD, exposée comme window.docx)
   ============================================================ */

const DocGenerator = (() => {

  /**
   * Génère un PDF à partir de l'élément DOM du CV déjà rendu (.cv-doc)
   * et déclenche le téléchargement.
   */
  async function generatePdf(cvElement, filename) {
    // On clone l'élément hors-écran à taille réelle pour une capture nette,
    // indépendamment du zoom d'aperçu appliqué à l'écran.
    const clone = cvElement.cloneNode(true);
    clone.style.transform = "none";
    clone.style.width = "210mm";
    clone.style.position = "absolute";
    clone.style.left = "-9999px";
    clone.style.top = "0";
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: clone.scrollWidth,
        windowHeight: clone.scrollHeight
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidthMm = pageWidth;
      const imgHeightMm = (canvas.height * imgWidthMm) / canvas.width;

      if (imgHeightMm <= pageHeight) {
        pdf.addImage(imgData, "JPEG", 0, 0, imgWidthMm, imgHeightMm);
      } else {
        // Contenu plus long qu'une page : on découpe sur plusieurs pages
        let heightLeft = imgHeightMm;
        let position = 0;
        let firstPage = true;
        while (heightLeft > 0) {
          if (!firstPage) pdf.addPage();
          pdf.addImage(imgData, "JPEG", 0, position, imgWidthMm, imgHeightMm);
          heightLeft -= pageHeight;
          position -= pageHeight;
          firstPage = false;
        }
      }

      pdf.save(filename);
    } finally {
      document.body.removeChild(clone);
    }
  }

  /* ---------- Génération Word (.docx) ---------- */
  // On reconstruit le contenu en paragraphes docx natifs (pas une image),
  // pour produire un vrai fichier Word modifiable, avec la police d'origine.

  function buildDocxParagraphs(profileId, data, paletteHexPrimary) {
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
      children: [new TextRun({ text: `${data.SEXE || ""}  ·  ${data.ETAT_CIVIL || ""}`, size: 20, font: "Calibri" })],
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
    const children = buildDocxParagraphs(profileId, data, paletteHexPrimary);

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
