/* ============================================================
   CV BOOSTER PRO — Moteur d'analyse "Scan ATS" (scan-engine.js)
   Version 2 — Sans suggestions de métiers (supprimées car non fiables
   sans IA), avec diagnostic CV/offre amélioré et messages plus clairs.
   ============================================================
   Analyse un CV (texte brut extrait d'un PDF/Word) au regard
   d'une offre d'emploi (texte brut), et produit :
     - un score global /100
     - 5 sous-scores par critère
     - un rapport détaillé (points forts, points à corriger,
       conseils actionnables) pour chaque critère
     - un verdict d'adéquation CV/offre honnête et précis

   100% local au navigateur — aucune donnée envoyée à un serveur.
   ============================================================ */

const ScanEngine = (() => {

  /* ============================================================
     0. LISTES DE RÉFÉRENCE
     ============================================================ */

  const STOPWORDS = new Set([
    "le","la","les","un","une","des","de","du","et","ou","à","au","aux","en","dans","sur","sous",
    "pour","par","avec","sans","ce","cet","cette","ces","son","sa","ses","leur","leurs","mon","ma","mes",
    "ton","ta","tes","notre","nos","votre","vos","qui","que","quoi","dont","où","est","sont","être","avoir",
    "il","elle","ils","elles","nous","vous","je","tu","on","se","sa","ne","pas","plus","moins","très",
    "comme","ainsi","donc","mais","si","tout","tous","toute","toutes","autre","autres","entre","vers",
    "chez","depuis","pendant","après","avant","alors","aussi","car","cela","ceci","ici","là","y","d","l",
    "j","n","s","c","qu","aujourd","hui","être","fait","faire","avoir","cet","etc","ans","an","mois",
    "the","and","of","to","in","for","a","with","is","are","on","as","by","or","an","be","this","that",
    "recherche","poste","profil","candidat","entreprise","société","équipe","travail","expérience",
    "formation","diplôme","niveau","capacité","aptitude","sens","esprit","bonne","bon","forte","fort"
  ]);

  // Mots-clés à fort poids technique — leur absence dans le CV face à une offre est un signal fort
  // (outils, logiciels, langages, certifications, méthodologies spécifiques)
  const TECHNICAL_WEIGHT_PATTERNS = [
    /\b[a-z]+js\b/i,           // javascript, nodejs, reactjs...
    /\b[a-z]{2,8}\d{1,3}\b/i, // sap4, iso9001, excel2019...
    /\b(sage|autocad|arcgis|qgis|matlab|python|java|php|sql|erp|crm|sap|odoo|power\s?bi|tableau)\b/i,
    /\b(iso|lean|agile|scrum|pmp|cfa|acca|ohsas|haccp)\b/i,
    /\bcertifi(cat|é|cation)\b/i,
    /\blicen(ce|s)\b/i,
    /\bhabilitation\b/i,
  ];

  const ACTION_VERBS = [
    "géré","gérer","piloté","piloter","optimisé","optimiser","réduit","réduire","augmenté","augmenter",
    "développé","développer","créé","créer","mis en place","conçu","concevoir","dirigé","diriger",
    "coordonné","coordonner","supervisé","superviser","analysé","analyser","amélioré","améliorer",
    "formé","former","encadré","encadrer","négocié","négocier","lancé","lancer","planifié","planifier",
    "structuré","structurer","automatisé","automatiser","résolu","résoudre","élaboré","élaborer",
    "implémenté","implémenter","déployé","déployer","atteint","atteindre","généré","générer",
    "économisé","économiser","livré","livrer","transformé","transformer","réalisé","réaliser",
    "assuré","assurer","contribué","contribuer","participé","participer","établi","établir"
  ];

  const GENERIC_PHRASES = [
    "personne motivée","personne sérieuse","personne dynamique","bon relationnel",
    "esprit d'équipe","force de proposition","autonome et rigoureux","sens du travail en équipe",
    "je suis quelqu'un","passionné par","toujours prêt à apprendre","polyvalent et dynamique",
    "travailleur et sérieux","rigoureux et organisé"
  ];

  const EXPECTED_SECTIONS = [
    { id: "contact", label: "Coordonnées (téléphone / email)",
      patterns: [/@[\w.-]+\.\w+/, /(\+?\d[\d .-]{7,})/] },
    { id: "titre", label: "Titre du CV / objectif professionnel",
      patterns: [/titre|objectif|poste recherche/i] },
    { id: "profil", label: "Profil professionnel / résumé",
      patterns: [/profil professionnel|resume professionnel|a propos|profil\s*:/i] },
    { id: "formation", label: "Formation / Diplômes",
      patterns: [/formation|diplome|licence|master|baccalaureat|bts|bac\b|doctorat|ingenieur/i] },
    { id: "competences", label: "Compétences",
      patterns: [/competences?|maitrise|outils|logiciels?|aptitudes?/i] },
    { id: "experiences", label: "Expériences professionnelles",
      patterns: [/experience|stage|emploi|poste occupe|parcours professionnel/i] },
    { id: "langues", label: "Langues",
      patterns: [/langues?[\s\S]{0,80}(francais|anglais|niveau|courant|maternel)/i, /\blangues?\s*:/i] },
    { id: "interets", label: "Centres d'intérêt",
      patterns: [/centres? d.interet|loisirs|hobbies|activites? extra/i] }
  ];

  const MIN_EXTRACTABLE_CHARS = 200;

  // Seuils d'adéquation CV/offre
  const OFFER_MATCH_EXCELLENT = 0.70;
  const OFFER_MATCH_GOOD      = 0.50;
  const OFFER_MATCH_PARTIAL   = 0.30;
  // sous 0.30 : adéquation faible → déconseillé honnêtement

  /* ============================================================
     1. UTILITAIRES TEXTE
     ============================================================ */

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function tokenize(str) {
    return normalize(str)
      .replace(/[^a-z0-9\s+#./-]/g, " ")
      .split(/\s+/)
      .map(w => w.replace(/^[.\-/]+|[.\-/]+$/g, ""))
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  function countWords(str) {
    return (str || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function textContains(haystackNorm, term) {
    const t = normalize(term);
    if (t.includes(" ")) return haystackNorm.includes(t);
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w{0,3}\\b`);
    return re.test(haystackNorm);
  }

  function isTechnicalKeyword(term) {
    return TECHNICAL_WEIGHT_PATTERNS.some(p => p.test(term));
  }

  /**
   * Extrait les mots-clés significatifs d'un texte d'offre,
   * en distinguant les mots-clés techniques (poids fort) des autres.
   */
  function extractKeywords(jobText, maxKeywords = 30) {
    const words = tokenize(jobText);
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    // Bigrammes
    const rawTokens = normalize(jobText).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const bigramFreq = {};
    for (let i = 0; i < rawTokens.length - 1; i++) {
      const a = rawTokens[i], b = rawTokens[i + 1];
      if (STOPWORDS.has(a) || STOPWORDS.has(b) || a.length < 3 || b.length < 3) continue;
      const bg = `${a} ${b}`;
      bigramFreq[bg] = (bigramFreq[bg] || 0) + 1;
    }

    const singleKw = Object.entries(freq)
      .filter(([w]) => w.length > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([term, count]) => ({
        term, count,
        type: "mot",
        technical: isTechnicalKeyword(term)
      }));

    const bigramKw = Object.entries(bigramFreq)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([term, count]) => ({
        term, count,
        type: "expression",
        technical: isTechnicalKeyword(term)
      }));

    return [...bigramKw, ...singleKw].slice(0, maxKeywords);
  }

  /* ============================================================
     2. CRITÈRE 1 — ATS & LISIBILITÉ (20 pts)
     ============================================================ */

  function scoreAts(cvText, cvMeta) {
    let score = 20;
    const findings = { good: [], bad: [], tips: [] };

    const charCount = (cvText || "").replace(/\s+/g, "").length;
    if (charCount < MIN_EXTRACTABLE_CHARS) {
      score -= 10;
      findings.bad.push("Très peu de texte a pu être extrait de votre fichier. Cela arrive quand le CV est une image, un scan ou un PDF non natif — les logiciels ATS ne pourront pas le lire non plus.");
      findings.tips.push("Exportez votre CV directement depuis Word ou Google Docs en PDF natif (pas une photo ou un scan de document).");
    } else {
      findings.good.push("Le contenu de votre CV est bien extractible sous forme de texte : les logiciels ATS peuvent le lire correctement.");
    }

    if (cvMeta && cvMeta.hasComplexTables) {
      score -= 5;
      findings.bad.push("Votre document contient des tableaux ou une mise en page en colonnes multiples, ce qui peut perturber la lecture automatique par un ATS.");
      findings.tips.push("Optez pour une mise en page simple en une seule colonne, avec des titres de section clairs — sans tableaux imbriqués ni zones de texte flottantes.");
    }

    const emojiCount = (cvText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
    if (emojiCount > 4) {
      score -= 3;
      findings.bad.push(`Votre CV contient de nombreux symboles ou émojis (${emojiCount} détectés). Cela nuit à une lecture professionnelle et peut perturber certains logiciels ATS.`);
      findings.tips.push("Utilisez uniquement des puces classiques (-, •) pour structurer vos listes. Évitez les émojis ou icônes décoratives.");
    }

    const wordCount = countWords(cvText);
    if (wordCount < 120) {
      score -= 4;
      findings.bad.push("Le contenu de votre CV semble très court. Un CV trop succinct manque d'éléments concrets pour convaincre un recruteur ou passer un filtre ATS.");
      findings.tips.push("Détaillez vos expériences et compétences : 1 page pour un débutant, 1 à 2 pages pour un profil intermédiaire, 2 à 3 pages pour un profil expérimenté.");
    } else if (wordCount > 1500) {
      score -= 3;
      findings.bad.push("Le contenu semble très dense. Un CV trop long risque de décourager un recruteur qui lit en 6 à 10 secondes.");
      findings.tips.push("Resserrez les formulations, éliminez les répétitions et gardez uniquement les informations qui apportent une vraie valeur ajoutée pour le poste visé.");
    } else {
      findings.good.push(`La longueur du CV (environ ${wordCount} mots) est bien adaptée aux standards recommandés.`);
    }

    score = Math.max(0, Math.min(20, score));
    return { score, max: 20, findings };
  }

  /* ============================================================
     3. CRITÈRE 2 — MOTS-CLÉS VS OFFRE (25 pts)
     ============================================================ */

  function scoreKeywords(cvText, jobText) {
    const findings = { good: [], bad: [], tips: [] };

    if (!jobText || tokenize(jobText).length < 5) {
      findings.tips.push("Aucune offre d'emploi n'a été fournie. Collez ou importez l'offre visée pour obtenir une analyse complète de la correspondance mots-clés.");
      return { score: 12, max: 25, findings, matched: [], missing: [], missedTechnical: [], noJob: true };
    }

    const keywords = extractKeywords(jobText, 30);
    const cvNorm = normalize(cvText);

    const matched = [];
    const missing = [];
    keywords.forEach(k => {
      if (textContains(cvNorm, k.term)) matched.push(k);
      else missing.push(k);
    });

    // Les mots-clés techniques manquants sont particulièrement importants
    const missedTechnical = missing.filter(k => k.technical);
    const ratio = keywords.length ? matched.length / keywords.length : 0;

    // Pénalité supplémentaire si des mots-clés techniques critiques manquent
    const technicalPenalty = Math.min(missedTechnical.length * 2, 8);
    let score = Math.round(ratio * 25) - technicalPenalty;

    if (matched.length > 0) {
      findings.good.push(`Votre CV reprend ${matched.length} terme(s) clé(s) sur ${keywords.length} identifiés dans l'offre : ${matched.slice(0, 6).map(m => m.term).join(", ")}${matched.length > 6 ? "…" : ""}.`);
    }

    if (missedTechnical.length > 0) {
      findings.bad.push(`${missedTechnical.length} compétence(s) ou outil(s) technique(s) spécifiquement demandé(s) dans l'offre n'apparaissent pas dans votre CV : ${missedTechnical.slice(0, 5).map(m => m.term).join(", ")}${missedTechnical.length > 5 ? "…" : ""}. Ce sont les éléments les plus importants pour un ATS.`);
      findings.tips.push("Si vous maîtrisez ces compétences, assurez-vous de les mentionner explicitement dans votre CV avec les mêmes termes que l'offre. Si vous ne les maîtrisez pas, ne les inventez pas — voyez le rapport d'adéquation ci-dessous pour une évaluation honnête.");
    }

    const missingGeneral = missing.filter(k => !k.technical);
    if (missingGeneral.length > 0) {
      findings.bad.push(`${missingGeneral.length} autre(s) terme(s) de l'offre absent(s) de votre CV : ${missingGeneral.slice(0, 5).map(m => m.term).join(", ")}${missingGeneral.length > 5 ? "…" : ""}.`);
    }

    if (ratio >= 0.65) {
      findings.good.push("Très bonne correspondance globale avec le vocabulaire de l'offre : votre CV devrait bien passer le filtrage automatique pour ce poste.");
    } else if (ratio < 0.35) {
      findings.bad.push("La correspondance globale avec l'offre est faible. Votre CV risque d'être écarté automatiquement avant même d'être lu par un humain.");
    }

    score = Math.max(0, Math.min(25, score));
    return { score, max: 25, findings, matched, missing, missedTechnical, noJob: false };
  }

  /* ============================================================
     4. CRITÈRE 3 — STRUCTURE & SECTIONS (20 pts)
     ============================================================ */

  function scoreStructure(cvText) {
    const findings = { good: [], bad: [], tips: [] };
    let score = 0;
    const perSection = 20 / EXPECTED_SECTIONS.length;
    const missing = [];
    const cvNorm = normalize(cvText);

    EXPECTED_SECTIONS.forEach(sec => {
      if (sec.patterns.some(p => p.test(cvNorm))) {
        score += perSection;
      } else {
        missing.push(sec.label);
      }
    });

    score = Math.round(score);

    if (missing.length === 0) {
      findings.good.push("Toutes les rubriques essentielles d'un CV professionnel sont présentes et bien identifiées.");
    } else if (missing.length <= 2) {
      findings.bad.push(`${missing.length} rubrique(s) attendue(s) semble(nt) absente(s) ou non clairement intitulée(s) : ${missing.join(", ")}.`);
      findings.tips.push("Vérifiez que chaque section a un titre explicite et visible (ex : \"Expériences professionnelles\", \"Compétences\", \"Formation\").");
    } else {
      findings.bad.push(`Plusieurs rubriques essentielles manquent ou ne sont pas clairement identifiées : ${missing.join(", ")}.`);
      findings.tips.push("Restructurez votre CV en ajoutant des titres de section bien visibles. Un recruteur doit trouver en 3 secondes votre formation, vos compétences et vos expériences.");
    }

    return { score, max: 20, findings };
  }

  /* ============================================================
     5. CRITÈRE 4 — ORIENTATION RÉSULTATS / IMPACT (20 pts)
     ============================================================ */

  function scoreImpact(cvText) {
    const findings = { good: [], bad: [], tips: [] };
    let score = 20;
    const cvNorm = normalize(cvText);

    // Chiffres et résultats quantifiés
    const quantified = (cvText.match(/\b\d{1,4}\s?(%|\$|€|fcfa|cfa|personnes?|clients?|projets?|millions?|k\b|collaborateurs?)/gi) || []);
    const percentages = (cvText.match(/\b\d{1,3}\s?%/g) || []);
    const totalQuantified = new Set([...quantified, ...percentages]).size;

    if (totalQuantified === 0) {
      score -= 9;
      findings.bad.push("Aucun résultat chiffré n'est présent dans votre CV. Or les recruteurs cherchent des preuves concrètes et vérifiables de vos réalisations.");
      findings.tips.push("Ajoutez des chiffres à vos expériences : \"Géré un portefeuille de 30 clients\", \"Réduit les délais de 20%\", \"Encadré une équipe de 5 personnes\", \"Traité 150 dossiers par mois\". Même des chiffres approximatifs sont mieux que rien.");
    } else if (totalQuantified < 3) {
      score -= 4;
      findings.bad.push(`Seulement ${totalQuantified} élément(s) chiffré(s) détecté(s). Quelques indicateurs supplémentaires renforceront la crédibilité de vos réalisations.`);
      findings.tips.push("Essayez d'ajouter au moins un chiffre clé par expérience professionnelle importante.");
    } else {
      findings.good.push(`${totalQuantified} résultat(s) chiffré(s) détecté(s) — bon point pour démontrer des réalisations concrètes et mesurables.`);
    }

    // Verbes d'action
    const actionCount = ACTION_VERBS.filter(v => cvNorm.includes(normalize(v))).length;
    if (actionCount === 0) {
      score -= 6;
      findings.bad.push("Peu ou pas de verbes d'action forts détectés. Vos descriptions de missions semblent passives ou génériques.");
      findings.tips.push("Commencez vos lignes de mission par des verbes d'action forts : \"Géré\", \"Piloté\", \"Développé\", \"Optimisé\", \"Coordonné\", \"Réalisé\"…");
    } else if (actionCount >= 4) {
      findings.good.push(`${actionCount} verbes d'action valorisants identifiés — vos descriptions de missions ont un bon dynamisme.`);
    }

    // Formulations génériques à éviter
    const genericFound = GENERIC_PHRASES.filter(p => cvNorm.includes(normalize(p)));
    if (genericFound.length > 0) {
      score -= Math.min(genericFound.length * 2, 5);
      findings.bad.push(`Des formulations génériques ont été repérées (ex : "${genericFound[0]}") qui n'apportent pas de valeur ajoutée concrète.`);
      findings.tips.push("Remplacez les qualificatifs vagues par des preuves : plutôt que \"rigoureux et organisé\", montrez une réalisation concrète qui le démontre.");
    }

    score = Math.max(0, Math.min(20, score));
    return { score, max: 20, findings };
  }

  /* ============================================================
     6. CRITÈRE 5 — FORME & PRÉSENTATION (15 pts)
     ============================================================ */

  function scoreForm(cvText, cvMeta) {
    const findings = { good: [], bad: [], tips: [] };
    let score = 15;

    // Nom de fichier
    if (cvMeta && cvMeta.fileName) {
      const fname = cvMeta.fileName.toLowerCase();
      const badPatterns = [/version.?final/, /\(\d+\)/, /copie/, /sans titre/, /document\d*\./, /scan\d*\./, /img_?\d+/, /-ok\./, /modifi/, /nouveau/];
      if (badPatterns.some(p => p.test(fname))) {
        score -= 3;
        findings.bad.push(`Le nom du fichier ("${cvMeta.fileName}") n'est pas professionnel pour un envoi à un recruteur.`);
        findings.tips.push("Renommez votre fichier : CV_Nom_Prenom.pdf — simple, clair et professionnel.");
      } else {
        findings.good.push("Le nom du fichier est professionnel.");
      }
    }

    // Format conseillé
    if (cvMeta && cvMeta.fileType === "docx") {
      findings.tips.push("Pensez à envoyer votre CV en PDF pour l'envoi final (plus stable à l'ouverture sur tous les appareils), sauf si le recruteur demande explicitement un fichier Word.");
    }

    // Espaces excessifs
    const excessiveBlank = (cvText.match(/\n\s*\n\s*\n/g) || []).length;
    if (excessiveBlank > 8) {
      score -= 2;
      findings.bad.push("De nombreux espaces ou sauts de ligne excessifs détectés — signe d'une mise en page peu maîtrisée.");
      findings.tips.push("Vérifiez l'alignement et l'espacement de votre document avant export.");
    }

    // Répétitions de lignes
    const lines = cvText.split("\n").map(l => l.trim()).filter(Boolean);
    const dupCount = lines.length - new Set(lines).size;
    if (dupCount > 5) {
      score -= 3;
      findings.bad.push("Plusieurs lignes identiques se répètent dans le document, ce qui nuit à la lisibilité.");
      findings.tips.push("Relisez votre CV pour supprimer les répétitions et garder un contenu concis.");
    }

    // Dates présentes
    if (!/\b(19|20)\d{2}\b/.test(cvText)) {
      score -= 2;
      findings.bad.push("Aucune date n'a été détectée dans le document. Vérifiez que vos formations et expériences incluent bien des dates.");
    }

    score = Math.max(0, Math.min(15, score));
    if (findings.good.length === 0 && findings.bad.length === 0) {
      findings.good.push("Aucun problème de forme majeur détecté.");
    }
    return { score, max: 15, findings };
  }

  /* ============================================================
     7. VERDICT D'ADÉQUATION CV / OFFRE (qualitatif, hors score)
     ============================================================
     Analyse honnête et précise de la correspondance entre le profil
     réel du CV et les exigences de l'offre.
     Principe : ne jamais inciter à mentir — distingue clairement
     "compétence présente mais mal valorisée" de "compétence absente".
     ============================================================ */

  function buildOfferFitVerdict(cvText, jobText, keywordResult) {
    if (!jobText || keywordResult.noJob) return null;

    const matched = keywordResult.matched || [];
    const missing = keywordResult.missing || [];
    const missedTechnical = keywordResult.missedTechnical || [];
    const total = matched.length + missing.length;
    const ratio = total ? matched.length / total : 0;

    // Analyse complémentaire : mots-clés techniques présents vs absents
    const matchedTechnical = matched.filter(k => k.technical);
    const technicalTotal = matchedTechnical.length + missedTechnical.length;
    const technicalRatio = technicalTotal ? matchedTechnical.length / technicalTotal : 1;

    let level, title, message, advice;

    if (ratio >= OFFER_MATCH_EXCELLENT && technicalRatio >= 0.6) {
      level = "good";
      title = "✅ Bonne adéquation avec ce poste";
      message = `Votre CV correspond bien à cette offre : ${matched.length} éléments sur ${total} attendus sont présents dans votre CV${technicalRatio === 1 ? ", y compris toutes les compétences techniques demandées" : ""}.`;
      advice = missedTechnical.length > 0
        ? `Un point d'attention : ${missedTechnical.length} compétence(s) technique(s) de l'offre manquent dans votre CV (${missedTechnical.slice(0, 3).map(k => k.term).join(", ")}). Si vous les maîtrisez réellement, mentionnez-les explicitement — avec les mêmes termes que l'offre.`
        : "Vous pouvez postuler avec confiance. Mettez en avant les éléments correspondants dès le début de votre profil professionnel.";

    } else if (ratio >= OFFER_MATCH_GOOD) {
      level = "partial";
      title = "⚠️ Adéquation partielle — quelques points à renforcer";
      message = `Votre CV couvre ${matched.length} éléments sur ${total} attendus dans cette offre (${Math.round(ratio * 100)}% de correspondance).`;

      if (missedTechnical.length > 0) {
        advice = `Les compétences techniques suivantes sont demandées dans l'offre mais absentes de votre CV : ${missedTechnical.map(k => k.term).join(", ")}. `
          + `Si vous les maîtrisez réellement, ajoutez-les à votre CV avec les termes exacts de l'offre. `
          + `Si vous ne les maîtrisez pas encore, il vaut mieux postuler à des offres plus alignées avec votre profil actuel, ou vous former avant de candidater.`;
      } else {
        advice = `Les éléments manquants semblent être des compétences transversales ou du vocabulaire contextuel. Vous pouvez reformuler certaines de vos expériences pour mieux coller au langage de cette offre — uniquement si cela reflète ce que vous avez réellement fait.`;
      }

    } else if (ratio >= OFFER_MATCH_PARTIAL) {
      level = "low";
      title = "⚠️ Faible adéquation — candidature risquée";
      message = `Votre CV ne couvre que ${matched.length} éléments sur ${total} attendus dans cette offre (${Math.round(ratio * 100)}% de correspondance).`;
      advice = missedTechnical.length > 0
        ? `Des compétences techniques centrales au poste manquent dans votre profil : ${missedTechnical.slice(0, 4).map(k => k.term).join(", ")}. `
          + `Soyons honnêtes : si vous ne maîtrisez pas ces éléments, votre candidature sera probablement écartée dès le premier filtre. `
          + `Il est préférable de cibler des offres mieux adaptées à votre parcours actuel, ou de vous former sur ces compétences avant de postuler à ce type de poste.`
        : `Votre profil semble assez éloigné des attentes de cette offre. Avant de postuler, assurez-vous de bien correspondre aux exigences principales — modifier votre CV pour "coller" à une offre sans en avoir les compétences ne vous aidera pas en entretien.`;

    } else {
      level = "mismatch";
      title = "❌ Profil non adapté à cette offre";
      message = `La correspondance entre votre CV et cette offre est très faible (${Math.round(ratio * 100)}% — seulement ${matched.length} élément(s) sur ${total} attendus).`;
      advice = `Soyons directs : en l'état, ce poste ne correspond pas à votre profil actuel. `
        + `Postuler quand même en modifiant artificiellement votre CV pour "faire correspondre" des compétences que vous ne possédez pas est contre-productif — cela sera détecté en entretien. `
        + `Ciblez plutôt des offres qui correspondent réellement à votre formation et vos expériences, ou planifiez une montée en compétences avant de viser ce type de poste.`;
    }

    return {
      level,
      title,
      message,
      advice,
      matchedCount: matched.length,
      missingCount: missing.length,
      missedTechnicalCount: missedTechnical.length,
      total,
      ratio: Math.round(ratio * 100),
      technicalRatio: Math.round(technicalRatio * 100)
    };
  }

  /* ============================================================
     8. AGRÉGATION FINALE
     ============================================================ */

  function analyze(cvText, jobText, cvMeta = {}) {
    const ats       = scoreAts(cvText, cvMeta);
    const keywords  = scoreKeywords(cvText, jobText);
    const structure = scoreStructure(cvText);
    const impact    = scoreImpact(cvText);
    const form      = scoreForm(cvText, cvMeta);

    const criteria = [
      { id: "ats",       label: "Lisibilité ATS",       icon: "🤖", ...ats },
      { id: "keywords",  label: "Mots-clés vs offre",   icon: "🎯", ...keywords },
      { id: "structure", label: "Structure & sections", icon: "🧱", ...structure },
      { id: "impact",    label: "Résultats & impact",   icon: "📈", ...impact },
      { id: "form",      label: "Forme & présentation", icon: "🪞", ...form }
    ];

    const totalScore = criteria.reduce((s, c) => s + c.score, 0);
    const totalMax   = criteria.reduce((s, c) => s + c.max, 0);
    const globalScore = Math.round((totalScore / totalMax) * 100);

    let verdict, verdictClass;
    if (globalScore >= 80)      { verdict = "Excellent — votre CV est solide et bien optimisé.";                         verdictClass = "great"; }
    else if (globalScore >= 60) { verdict = "Bon départ — quelques ajustements ciblés amélioreront vos chances.";        verdictClass = "ok"; }
    else if (globalScore >= 40) { verdict = "Des corrections importantes sont nécessaires avant envoi.";                  verdictClass = "warn"; }
    else                        { verdict = "Ce CV risque d'être écarté rapidement — une révision en profondeur s'impose."; verdictClass = "bad"; }

    // Verdict d'adéquation CV/offre (honnête et précis, sans suggestions de métiers)
    const offerFitVerdict = buildOfferFitVerdict(cvText, jobText, keywords);

    return {
      globalScore,
      verdict,
      verdictClass,
      criteria,
      offerFitVerdict,
      // jobSuggestions supprimé volontairement : suggérer des métiers
      // sans IA réelle produisait des résultats non fiables.
      meta: cvMeta,
      generatedAt: new Date().toISOString()
    };
  }

  return { analyze, extractKeywords, tokenize };
})();
