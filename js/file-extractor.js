/* ============================================================
   CV BOOSTER PRO — Extracteur de texte (file-extractor.js)
   ============================================================
   Extrait le texte brut d'un fichier PDF (.pdf), Word (.docx)
   ou image (.png/.jpg/.jpeg/.webp) directement dans le navigateur,
   sans aucun serveur.

   - PDF   : pdf.js (Mozilla) ; si très peu de texte est trouvé
             (cas d'un PDF scanné = image), on tente l'OCR en secours.
   - DOCX  : lecture directe du XML interne (word/document.xml)
             via JSZip — pas besoin de mammoth.js pour du texte brut.
   - Image : reconnaissance optique de caractères (OCR) via
             Tesseract.js (français + anglais).
   ============================================================ */

if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

const FileExtractor = (() => {

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
  const OCR_LANGS = "fra+eng";
  const MIN_EXTRACTABLE_CHARS = 200; // en dessous : on considère le texte natif trop pauvre, on tente l'OCR
  const MAX_OCR_PDF_PAGES = 6; // limite pour ne pas faire tourner l'OCR indéfiniment sur un très long document

  function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Impossible de lire le fichier."));
      reader.readAsArrayBuffer(file);
    });
  }

  function getExtension(filename) {
    const m = /\.([a-z0-9]+)$/i.exec(filename || "");
    return m ? m[1].toLowerCase() : "";
  }

  /* ---------- OCR (Tesseract.js) ---------- */

  /**
   * Fait tourner l'OCR sur une source image (File, Blob ou <canvas>)
   * et renvoie le texte reconnu. Crée un worker Tesseract dédié à
   * chaque appel et le libère ensuite (le coût de démarrage est
   * acceptable pour un usage ponctuel comme ici).
   */
  async function ocrImageSource(source) {
    if (!window.Tesseract) {
      throw new Error("Le moteur de reconnaissance de texte (OCR) n'a pas pu être chargé.");
    }
    const worker = await window.Tesseract.createWorker(OCR_LANGS);
    try {
      const { data } = await worker.recognize(source);
      return data && data.text ? data.text : "";
    } finally {
      await worker.terminate();
    }
  }

  /**
   * OCR de secours pour un PDF scanné : on rend chaque page en image
   * (canvas) via pdf.js puis on la passe à Tesseract. Un seul worker
   * est réutilisé pour toutes les pages (plus rapide qu'un worker par page).
   */
  async function ocrPdfPages(pdf) {
    if (!window.Tesseract) {
      throw new Error("Le moteur de reconnaissance de texte (OCR) n'a pas pu être chargé.");
    }
    const worker = await window.Tesseract.createWorker(OCR_LANGS);
    try {
      let text = "";
      const pageCount = Math.min(pdf.numPages, MAX_OCR_PDF_PAGES);
      for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2 }); // résolution correcte pour une bonne reconnaissance
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        const { data } = await worker.recognize(canvas);
        text += (data && data.text ? data.text : "") + "\n\n";
      }
      return text;
    } finally {
      await worker.terminate();
    }
  }

  /* ---------- PDF ---------- */
  async function extractFromPdf(arrayBuffer) {
    if (!window.pdfjsLib) {
      throw new Error("Le moteur de lecture PDF n'a pas pu être chargé.");
    }
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(" ");
      fullText += pageText + "\n\n";
    }

    // Très peu de texte natif trouvé : probablement un PDF scanné (image).
    // On tente l'OCR en secours avant d'abandonner.
    let ocrUsed = false;
    if (fullText.replace(/\s+/g, "").length < MIN_EXTRACTABLE_CHARS) {
      try {
        const ocrText = await ocrPdfPages(pdf);
        if (ocrText.replace(/\s+/g, "").length > fullText.replace(/\s+/g, "").length) {
          fullText = ocrText;
          ocrUsed = true;
        }
      } catch (e) {
        // l'OCR a échoué : on garde le texte natif (même faible) plutôt que de tout perdre
      }
    }

    return { text: fullText, meta: { pages: pdf.numPages, ocrUsed } };
  }

  /* ---------- DOCX ---------- */
  async function extractFromDocx(arrayBuffer) {
    if (!window.JSZip) {
      throw new Error("Le moteur de lecture Word n'a pas pu être chargé.");
    }
    const zip = await window.JSZip.loadAsync(arrayBuffer);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) {
      throw new Error("Ce fichier .docx semble invalide ou corrompu.");
    }
    const xml = await docXmlFile.async("text");

    // Détection grossière de tableaux (balises <w:tbl>) pour le critère ATS
    const hasComplexTables = /<w:tbl[ >]/.test(xml);

    // On extrait le texte de chaque paragraphe <w:p>, en respectant les saut de ligne <w:br/>
    // et les retours de paragraphe, pour conserver une structure lisible.
    const text = xml
      .replace(/<w:p[ >]/g, "\n<w:p>")     // marque chaque début de paragraphe par un saut de ligne
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<[^>]+>/g, "")              // retire toutes les balises XML restantes
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return { text, meta: { hasComplexTables } };
  }

  /* ---------- Image (OCR direct) ---------- */
  async function extractFromImage(file) {
    const text = await ocrImageSource(file);
    return { text, meta: { ocrUsed: true } };
  }

  /* ---------- Point d'entrée générique ---------- */

  /**
   * @param {File} file
   * @returns {Promise<{text: string, fileName: string, fileType: 'pdf'|'docx'|'image', meta: object}>}
   */
  async function extract(file) {
    if (!file) throw new Error("Aucun fichier fourni.");
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Le fichier est trop volumineux (limite : 10 Mo).");
    }

    const ext = getExtension(file.name);

    let result;
    if (ext === "pdf") {
      const buffer = await readAsArrayBuffer(file);
      result = await extractFromPdf(buffer);
      result.fileType = "pdf";
    } else if (ext === "docx") {
      const buffer = await readAsArrayBuffer(file);
      result = await extractFromDocx(buffer);
      result.fileType = "docx";
    } else if (ext === "doc") {
      throw new Error("Le format .doc (ancien Word) n'est pas pris en charge. Merci de fournir un fichier .docx ou .pdf.");
    } else if (IMAGE_EXTENSIONS.includes(ext)) {
      result = await extractFromImage(file);
      result.fileType = "image";
    } else {
      throw new Error("Format de fichier non pris en charge. Merci de fournir un fichier PDF, Word (.docx) ou une image (PNG/JPG).");
    }

    result.fileName = file.name;

    if (!result.text || result.text.replace(/\s+/g, "").length < 20) {
      // On ne bloque pas (le scan-engine gère ça comme un critère ATS dégradé),
      // mais on signale clairement le risque à l'appelant.
      result.extractionWarning = result.meta && result.meta.ocrUsed
        ? "Très peu de texte a pu être reconnu sur cette image. Vérifiez qu'elle est nette, bien cadrée et suffisamment lisible."
        : "Très peu de texte exploitable a pu être extrait de ce fichier. Il s'agit peut-être d'un document scanné ou basé sur des images.";
    }

    return result;
  }

  return { extract };
})();
