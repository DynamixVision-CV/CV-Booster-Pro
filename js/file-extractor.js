/* ============================================================
   CV BOOSTER PRO — Extracteur de texte (file-extractor.js)
   ============================================================
   Extrait le texte brut d'un fichier PDF (.pdf) ou Word (.docx)
   directement dans le navigateur, sans aucun serveur.

   - PDF  : pdf.js (Mozilla, chargé via CDN)
   - DOCX : lecture directe du XML interne (word/document.xml)
            via JSZip
   ============================================================ */

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const FileExtractor = (() => {

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
      reader.readAsArrayBuffer(file);
    });
  }

  function getExtension(filename) {
    const m = /\.([a-z0-9]+)$/i.exec(filename || "");
    return m ? m[1].toLowerCase() : "";
  }

  /* ---------- PDF ---------- */
  async function extractFromPdf(arrayBuffer) {
    if (!window.pdfjsLib) {
      throw new Error("Le moteur de lecture PDF n'a pas pu être chargé. Vérifiez votre connexion internet.");
    }
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page    = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(" ");
      fullText += pageText + "\n\n";
    }
    return { text: fullText, meta: { pages: pdf.numPages } };
  }

  /* ---------- DOCX ---------- */
  async function extractFromDocx(arrayBuffer) {
    if (!window.JSZip) {
      throw new Error("Le moteur de lecture Word n'a pas pu être chargé. Vérifiez votre connexion internet.");
    }
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) {
      throw new Error("Ce fichier .docx semble invalide ou corrompu.");
    }
    const xml = await docXmlFile.async("text");

    // Détection de tableaux complexes (critère ATS)
    const hasComplexTables = /<w:tbl[ >]/.test(xml);

    // Extraction du texte en respectant les paragraphes et retours à la ligne
    const text = xml
      .replace(/<w:p[ >]/g, "\n<w:p>")
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g,  "&")
      .replace(/&lt;/g,   "<")
      .replace(/&gt;/g,   ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { text, meta: { hasComplexTables } };
  }

  /* ---------- Point d'entrée ---------- */

  /**
   * Extrait le texte d'un fichier PDF ou Word.
   * @param {File} file
   * @returns {Promise<{text, fileName, fileType, meta, extractionWarning?}>}
   */
  async function extract(file) {
    if (!file) throw new Error("Aucun fichier fourni.");
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Le fichier est trop volumineux (limite : 10 Mo).");
    }

    const ext    = getExtension(file.name);
    const buffer = await readAsArrayBuffer(file);

    let result;
    if (ext === "pdf") {
      result = await extractFromPdf(buffer);
      result.fileType = "pdf";
    } else if (ext === "docx") {
      result = await extractFromDocx(buffer);
      result.fileType = "docx";
    } else if (ext === "doc") {
      throw new Error("Le format .doc (ancien Word) n'est pas pris en charge. Merci de fournir un fichier .docx ou .pdf.");
    } else {
      throw new Error("Format non pris en charge. Merci de fournir un fichier PDF (.pdf) ou Word (.docx).");
    }

    result.fileName = file.name;

    if (!result.text || result.text.replace(/\s+/g, "").length < 20) {
      result.extractionWarning = "Très peu de texte exploitable a pu être extrait. Il s'agit peut-être d'un document scanné ou basé sur des images — les logiciels ATS ne pourront pas le lire non plus.";
    }

    return result;
  }

  return { extract };
})();
