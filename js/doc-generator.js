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
   *
   * Méthode : html2canvas (capture du DOM en image haute résolution)
   * + jsPDF (découpage en pages A4 et export).
   * On évite les iframes : iframe.contentWindow.print() est bloqué par
   * Apple sur iOS Safari (restriction de sécurité), ce qui empêchait
   * purement et simplement le téléchargement sur mobile.
   *
   * Le contenu s'enchaîne en continu d'une page à l'autre (pas de
   * rubrique forcée sur sa propre page, pas d'espace vide inutile) :
   * seule contrainte, une coupure de page ne doit jamais tomber au
   * milieu d'une ligne de texte (sinon une phrase se retrouve tronchée
   * entre deux pages). Pour ça on repère, ligne de texte par ligne de
   * texte (pas bloc entier), les zones à ne pas couper.
   */
  async function generatePdf(cvElement, filename) {
    const { jsPDF } = window.jspdf;

    const A4_WIDTH_MM  = 210;
    const A4_HEIGHT_MM = 297;
    const RENDER_SCALE = 2; // résolution ~192dpi pour un rendu net à l'impression

    // On clone le CV hors-écran, débarrassé de toute transformation d'affichage
    // (le preview est parfois réduit via CSS transform:scale pour tenir dans
    // l'écran — si on capturait l'élément visible tel quel, le PDF serait
    // rendu à cette taille réduite au lieu de la taille réelle A4).
    const clone = cvElement.cloneNode(true);
    clone.style.transform = "none";
    clone.style.margin    = "0";
    clone.style.boxShadow = "none";

    const stage = document.createElement("div");
    stage.style.cssText = "position:fixed;top:0;left:-99999px;width:" + cvElement.offsetWidth + "px;background:#ffffff;";
    stage.appendChild(clone);
    document.body.appendChild(stage);

    try {
      const canvas = await html2canvas(clone, {
        scale: RENDER_SCALE,
        useCORS: true,
        backgroundColor: "#ffffff"
      });

      // Zones à ne pas couper = chaque ligne de texte visuelle (pas chaque
      // bloc/section). Range.getClientRects() sur un nœud texte renvoie un
      // rectangle par ligne affichée, ce qui donne exactement la bonne
      // granularité : on peut couper entre deux lignes ou deux paragraphes,
      // jamais à l'intérieur d'une même ligne.
      const cloneRect = clone.getBoundingClientRect();
      const noBreakZones = [];
      const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, {
        acceptNode: n => n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      });
      let textNode;
      const range = document.createRange();
      while ((textNode = walker.nextNode())) {
        range.selectNodeContents(textNode);
        const rects = range.getClientRects();
        for (const r of rects) {
          if (r.height <= 0) continue;
          noBreakZones.push({
            top: (r.top - cloneRect.top) * RENDER_SCALE,
            bottom: (r.bottom - cloneRect.top) * RENDER_SCALE
          });
        }
      }
      noBreakZones.sort((a, b) => a.top - b.top);

      const pageHeightPx = (A4_HEIGHT_MM / A4_WIDTH_MM) * canvas.width;
      const totalHeightPx = canvas.height;

      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      let renderedY = 0;
      let pageIndex = 0;

      while (renderedY < totalHeightPx - 1) {
        let cutY = Math.min(renderedY + pageHeightPx, totalHeightPx);

        // Si la coupure naturelle tombe au milieu d'une ligne de texte, on la
        // remonte juste au-dessus de cette ligne (jamais en dessous de
        // renderedY, pour ne jamais boucler sans avancer).
        for (const zone of noBreakZones) {
          if (zone.top >= cutY) break; // zones triées : plus rien à vérifier après
          if (cutY > zone.top && cutY < zone.bottom && zone.top > renderedY) {
            cutY = zone.top;
          }
        }

        const sliceHeight = Math.max(1, cutY - renderedY);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width  = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, renderedY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        const imgData = pageCanvas.toDataURL("image/jpeg", 0.95);
        const imgHeightMm = (sliceHeight * A4_WIDTH_MM) / canvas.width;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, imgHeightMm);

        renderedY += sliceHeight;
        pageIndex++;
      }

      pdf.save(filename.toLowerCase().endsWith(".pdf") ? filename : filename + ".pdf");
    } finally {
      document.body.removeChild(stage);
    }
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
