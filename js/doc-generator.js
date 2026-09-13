/* ============================================================
   CV BOOSTER PRO — Génération de fichiers PDF et Word
   100% côté client (navigateur), aucun serveur nécessaire.

   PDF  : window.print() via une iframe dédiée + @media print CSS
          → sauts de page intelligents, texte vectoriel net, pas
            de coupure en plein bloc
   Word : librairie "docx" (UMD, exposée comme window.docx)
          → vrai fichier .docx modifiable avec la police d'origine
   ============================================================ */

const DocGenerator = (() => {

  /* ============================================================
     GÉNÉRATION PDF — méthode window.print() via iframe
     ============================================================
     Principe : on injecte le HTML du CV + ses CSS dans une iframe
     invisible, puis on appelle print() sur cette iframe. Le navigateur
     gère lui-même les sauts de page en respectant les règles CSS
     (page-break-inside: avoid, break-inside: avoid) définies dans
     cv-styles.css — plus aucune coupure brutale de texte.
     ============================================================ */

  async function generatePdf(cvElement, filename) {
    // Récupère les feuilles de style du document principal
    const styleSheets = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules).map(r => r.cssText).join("\n");
        } catch (e) {
          // Feuille cross-origin : on inclut via <link>
          return sheet.href ? `@import url("${sheet.href}");` : "";
        }
      }).join("\n");

    // Clone le CV pour ne pas altérer l'original
    const cvClone = cvElement.cloneNode(true);

    // Retire le zoom d'aperçu si présent
    cvClone.style.transform = "none";
    cvClone.style.margin    = "0";
    cvClone.style.boxShadow = "none";

    // Crée l'iframe d'impression
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;opacity:0;";
    document.body.appendChild(iframe);

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>${styleSheets}</style>
  <style>
    @media print {
      @page { size: A4 portrait; margin: 0; }
      body  { margin: 0; padding: 0; }
      .cv-doc { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>${cvClone.outerHTML}</body>
</html>`);
      iframeDoc.close();

      // Attend que les styles soient appliqués avant d'imprimer
      await new Promise(resolve => setTimeout(resolve, 400));

      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      // Laisse le temps au dialogue d'impression de s'ouvrir
      await new Promise(resolve => setTimeout(resolve, 1000));
    } finally {
      document.body.removeChild(iframe);
    }
  }

  /* ============================================================
     GÉNÉRATION WORD (.docx)
     ============================================================ */

  async function buildDocxParagraphs(profileId, data, paletteHexPrimary) {
    const { Paragraph, TextRun, BorderStyle } = window.docx;
    const order         = CV_RENDER_ORDER[profileId];
    const profileConfig = CV_CONFIG.profiles[profileId];
    const children      = [];
    const colorHex      = (paletteHexPrimary || "#1d4f91").replace("#", "");

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
        spacing: { before: 240, after: 100 }
      }));
    }

    function addLine(text, opts = {}) {
      children.push(new Paragraph({
        children: [new TextRun({ text: text || "", size: 20, font: "Calibri", bold: !!opts.bold, italics: !!opts.italics })],
        spacing: { after: opts.after !== undefined ? opts.after : 60 }
      }));
    }

    function addBullet(text) {
      children.push(new Paragraph({
        children: [new TextRun({ text: text || "", size: 20, font: "Calibri" })],
        bullet: { level: 0 },
        spacing: { after: 60 }
      }));
    }

    // Transforme un texte multiligne en bullets Word
    function textToBullets(text, spacingAfterLast = 140) {
      const lines = (text || "").split("\n")
        .map(l => l.trim().replace(/^[-•*]\s*/, ""))
        .filter(l => l.length > 0);
      lines.forEach((line, idx) => {
        children.push(new Paragraph({
          children: [new TextRun({ text: line, size: 20, font: "Calibri" })],
          bullet: { level: 0 },
          spacing: { after: idx === lines.length - 1 ? spacingAfterLast : 40 }
        }));
      });
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
        if (data.LISTEZ_1) {
          addLine("Compétences", { bold: true, after: 20 });
          textToBullets(data.LISTEZ_1, data.LISTEZ_2 ? 100 : 160);
        }
        if (data.LISTEZ_2) {
          addLine("Certifications", { bold: true, after: 20 });
          textToBullets(data.LISTEZ_2, 160);
        }
      } else if (sectionId === "experiences") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Expériences professionnelles");
        items.forEach(it => {
          addLine(`${it.POSTE}   ${it.DEBUT} – ${it.FIN}`, { bold: true });
          addLine(`${it.SOCIETE}, ${it.LIEU}`);
          textToBullets(it.TACHES_EFFECTUEES, 140);
        });
      } else if (sectionId === "benevolat") {
        const items = collectRepeatItems(data, section);
        if (!items.length) return;
        addSectionTitle("Bénévolat & Expériences extra-professionnelles");
        items.forEach(it => {
          addLine(`${it.ROLE}   ${it.DEPART} – ${it.TERME}`, { bold: true });
          addLine(`${it.STRUCTURE} ${it.OU}`);
          textToBullets(it.ACTIVITES_MENEES, 140);
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

    // Footer
    addSectionTitle("");
    addLine("Je déclare sur l'honneur que toutes ces informations sont vraies et vérifiables.", { italics: true });
    addLine(`${data.VOTRE_VILLE || ""}, le ${data.LA_DATE || ""}`, { bold: true });

    if (data.SIGNATURE_DATA) {
      const { ImageRun, AlignmentType } = window.docx;
      const signatureBuffer = await dataUrlToUint8Array(data.SIGNATURE_DATA);
      children.push(new Paragraph({
        children: [new ImageRun({ data: signatureBuffer, transformation: { width: 160, height: 55 } })],
        alignment: AlignmentType.RIGHT,
        spacing: { before: 100 }
      }));
    }

    return children;
  }

  async function dataUrlToUint8Array(dataUrl) {
    const res    = await fetch(dataUrl);
    const buffer = await res.arrayBuffer();
    return new Uint8Array(buffer);
  }

  function collectRepeatItems(data, section) {
    const items = [];
    for (let i = 1; i <= section.count; i++) {
      const item = {};
      let hasValue = false;
      section.itemFields.forEach(f => {
        const val = data[`${section.repeatKey}_${i}_${f.key}`];
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
            size:   { width: 11906, height: 16838 }, // A4
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 }
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
    const a   = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  return { generatePdf, generateDocx };
})();
