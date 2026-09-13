/* ============================================================
   CV BOOSTER PRO — Moteur d'analyse "Scan ATS" (scan-engine.js)
   ============================================================
   Analyse un CV (texte brut extrait d'un PDF/Word) au regard
   d'une offre d'emploi (texte brut), et produit :
     - un score global /100
     - 5 sous-scores par critère
     - un rapport détaillé (points forts, points à corriger,
       conseils actionnables) pour chaque critère

   Toutes les règles ci-dessous sont dérivées du guide
   "CV Booster Pro — Le guide stratégique" (DynamixVision) :
   lecture ATS, lecture recruteur en 6-10 secondes, mots-clés,
   structure par section, valorisation chiffrée, erreurs fréquentes.

   100% local au navigateur — aucune donnée n'est envoyée à un
   serveur tiers pour l'analyse elle-même.
   ============================================================ */

const ScanEngine = (() => {

  /* ============================================================
     0. LISTES DE RÉFÉRENCE
     ============================================================ */

  // Mots vides français à ignorer lors de l'extraction de mots-clés
  const STOPWORDS = new Set([
    "le","la","les","un","une","des","de","du","et","ou","à","au","aux","en","dans","sur","sous",
    "pour","par","avec","sans","ce","cet","cette","ces","son","sa","ses","leur","leurs","mon","ma","mes",
    "ton","ta","tes","notre","nos","votre","vos","qui","que","quoi","dont","où","est","sont","être","avoir",
    "il","elle","ils","elles","nous","vous","je","tu","on","se","sa","ne","pas","plus","moins","très",
    "comme","ainsi","donc","mais","si","tout","tous","toute","toutes","autre","autres","entre","vers",
    "chez","depuis","pendant","après","avant","alors","aussi","car","cela","ceci","ici","là","y","d","l",
    "j","n","s","c","qu","aujourd","hui","être","fait","faire","avoir","cet","etc","ans","an","mois",
    "the","and","of","to","in","for","a","with","is","are","on","as","by","or","an","be","this","that"
  ]);

  // Verbes d'action valorisants (orientation résultats) — non exhaustif, but représentatif du guide
  const ACTION_VERBS = [
    "géré","gérer","piloté","piloter","optimisé","optimiser","réduit","réduire","augmenté","augmenter",
    "développé","développer","créé","créer","mis en place","conçu","concevoir","dirigé","diriger",
    "coordonné","coordonner","supervisé","superviser","analysé","analyser","amélioré","améliorer",
    "formé","former","encadré","encadrer","négocié","négocier","lancé","lancer","planifié","planifier",
    "structuré","structurer","automatisé","automatiser","résolu","résoudre","élaboré","élaborer",
    "implémenté","implémenter","déployé","déployer","atteint","atteindre","généré","générer",
    "économisé","économiser","livré","livrer","transformé","transformer"
  ];

  // Formulations génériques à éviter (guide, section "erreurs fréquentes")
  const GENERIC_PHRASES = [
    "personne motivée","personne sérieuse","personne dynamique","bon relationnel",
    "esprit d'équipe","force de proposition","autonome et rigoureux","sens du travail en équipe",
    "je suis quelqu'un","passionné par","toujours prêt à apprendre"
  ];

  // Sections essentielles attendues selon le guide (bloc "essentiels d'un CV professionnel")
  // NB : ces patterns s'appliquent sur le texte NORMALISÉ (sans accents, minuscules) — voir scoreStructure.
  const EXPECTED_SECTIONS = [
    { id: "contact",      label: "Coordonnées (téléphone / email)", patterns: [/@[\w.-]+\.\w+/, /(\+?\d[\d .-]{7,})/] },
    { id: "titre",        label: "Titre de CV / objectif professionnel", patterns: [/titre|objectif|poste recherche/i] },
    { id: "profil",       label: "Profil professionnel / résumé", patterns: [/profil professionnel|resume professionnel|a propos/i] },
    { id: "formation",    label: "Formation / Diplômes", patterns: [/formation|diplome|licence|master|baccalaureat|bts|bac\b/i] },
    { id: "competences",  label: "Compétences", patterns: [/competences?|maitrise|outils|logiciels?/i] },
    { id: "experiences",  label: "Expériences professionnelles", patterns: [/experience|stage|emploi|poste occupe/i] },
    { id: "langues",      label: "Langues", patterns: [/langues?\b[\s\S]{0,80}(francais|anglais|niveau)/i, /\blangues?\s*:/i] },
    { id: "interets",     label: "Centres d'intérêt", patterns: [/centres? d.interet|loisirs|hobbies/i] }
  ];

  // Indices qu'un CV serait une image / mauvaise extraction (guide : "CV sous forme d'image")
  const MIN_EXTRACTABLE_CHARS = 200;

  /* ============================================================
     0bis. RÉFÉRENTIEL MÉTIERS — détection du domaine + postes visables
     ============================================================
     Chaque domaine est défini par des mots-clés caractéristiques
     (compétences, outils, intitulés) recherchés dans le CV. Le score
     de correspondance par domaine sert à suggérer des postes que le
     PROFIL RÉEL du candidat lui permet de viser, indépendamment de
     toute offre fournie. Référentiel non exhaustif, à enrichir.
     ============================================================ */

  const JOB_DOMAINS = [
    {
      id: "comptabilite",
      label: "Comptabilité / Finance",
      keywords: ["comptable","comptabilite","sage","saari","facturation","tresorerie","bilan",
        "declaration fiscale","fiscalite","rapprochement bancaire","journal comptable","paie",
        "audit","controle de gestion","budget","analyse financiere","excel"],
      postes: ["Assistant(e) comptable", "Aide-comptable", "Technicien(ne) en gestion comptable",
        "Agent de saisie comptable", "Contrôleur(se) de gestion junior"]
    },
    {
      id: "logistique",
      label: "Logistique / Supply Chain",
      keywords: ["logistique","supply chain","approvisionnement","stock","entrepot","transport",
        "livraison","fournisseur","inventaire","sap","odoo","planification logistique",
        "gestion de stock","import","export","douane"],
      postes: ["Agent logistique", "Assistant(e) approvisionnement", "Magasinier(e)",
        "Coordinateur(rice) transport", "Gestionnaire de stock"]
    },
    {
      id: "administratif",
      label: "Administration / Secrétariat",
      keywords: ["secretariat","administratif","classement","accueil","standard","courrier",
        "agenda","gestion administrative","redaction","frappe","archivage","word","powerpoint",
        "google docs","assistant de direction"],
      postes: ["Assistant(e) administratif(ve)", "Secrétaire", "Agent(e) d'accueil",
        "Assistant(e) de direction", "Agent(e) de saisie"]
    },
    {
      id: "commercial",
      label: "Commerce / Vente",
      keywords: ["vente","commercial","prospection","negociation","client","crm","portefeuille client",
        "objectifs commerciaux","relation client","marketing","fidelisation","devis","facturation client"],
      postes: ["Commercial(e)", "Conseiller(ère) clientèle", "Chargé(e) de clientèle",
        "Assistant(e) commercial(e)", "Téléconseiller(ère)"]
    },
    {
      id: "rh",
      label: "Ressources Humaines",
      keywords: ["ressources humaines","recrutement","paie","sirh","gestion du personnel",
        "formation professionnelle","contrat de travail","entretien d'embauche","onboarding",
        "droit du travail","gpec"],
      postes: ["Assistant(e) RH", "Chargé(e) de recrutement", "Gestionnaire de paie",
        "Assistant(e) administration du personnel"]
    },
    {
      id: "informatique",
      label: "Informatique / Développement",
      keywords: ["developpeur","developpement","programmation","javascript","python","java","html",
        "css","sql","base de donnees","reseau","cybersecurite","maintenance informatique",
        "support technique","systeme","logiciel","application web","api"],
      postes: ["Développeur(se) junior", "Technicien(ne) support informatique",
        "Assistant(e) développeur(se)", "Webmaster", "Technicien(ne) réseau"]
    },
    {
      id: "communication",
      label: "Communication / Marketing digital",
      keywords: ["communication","reseaux sociaux","community management","redaction web",
        "marketing digital","seo","content marketing","graphisme","montage video",
        "strategie de communication","relations publiques"],
      postes: ["Community manager", "Assistant(e) communication", "Chargé(e) de communication junior",
        "Rédacteur(rice) web"]
    },
    {
      id: "education",
      label: "Éducation / Formation",
      keywords: ["enseignement","pedagogie","formateur","formatrice","cours","eleve","etudiant",
        "programme scolaire","encadrement pedagogique","soutien scolaire"],
      postes: ["Enseignant(e) vacataire", "Formateur(rice)", "Surveillant(e) d'études",
        "Animateur(rice) pédagogique"]
    },
    {
      id: "btp",
      label: "BTP / Génie civil / Topographie",
      keywords: ["topographie","genie civil","btp","chantier","plan de construction","autocad",
        "metre","ouvrage","beton","maconnerie","suivi de chantier"],
      postes: ["Technicien(ne) en topographie", "Conducteur(rice) de travaux junior",
        "Assistant(e) génie civil", "Dessinateur(rice) projeteur(se)"]
    },
    {
      id: "sante",
      label: "Santé / Social",
      keywords: ["sante","infirmier","soins","patient","hopital","centre de sante","aide-soignant",
        "travail social","action sociale","accompagnement"],
      postes: ["Aide-soignant(e)", "Agent(e) de santé communautaire", "Assistant(e) social(e) junior"]
    }
  ];

  // Seuils de correspondance d'un domaine (proportion de mots-clés du domaine retrouvés dans le CV)
  const DOMAIN_MATCH_THRESHOLD = 0.18; // à partir de 18% des mots-clés du domaine présents, on le considère pertinent
  const DOMAIN_STRONG_THRESHOLD = 0.4;  // au-delà, le domaine est considéré comme fortement maîtrisé

  // Seuils de correspondance avec une offre précise (sur les mots-clés extraits de l'offre)
  const OFFER_MATCH_GOOD = 0.65;   // bonne adéquation : peut postuler avec confiance
  const OFFER_MATCH_PARTIAL = 0.40; // adéquation partielle : possible en valorisant mieux l'existant, avec réserve
  // sous ce seuil : adéquation faible, on déconseille honnêtement de forcer la candidature

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
      .map(w => w.replace(/^[.\-/]+|[.\-/]+$/g, "")) // retire la ponctuation résiduelle en début/fin de mot
      .filter(w => w.length > 2 && !STOPWORDS.has(w));
  }

  function countWords(str) {
    return (str || "").trim().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Extrait les mots-clés "significatifs" d'un texte d'offre d'emploi :
   * fréquence des mots simples + détection de bigrammes/expressions
   * techniques fréquentes (ex: "gestion de projet", "analyse financière").
   */
  function extractKeywords(jobText, maxKeywords = 25) {
    const words = tokenize(jobText);
    const freq = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    // Bigrammes (paires de mots consécutifs significatifs) pour capter
    // les expressions composées typiques d'une offre ("gestion de projet")
    const rawTokens = normalize(jobText).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
    const bigramFreq = {};
    for (let i = 0; i < rawTokens.length - 1; i++) {
      const a = rawTokens[i], b = rawTokens[i + 1];
      if (STOPWORDS.has(a) || STOPWORDS.has(b) || a.length < 3 || b.length < 3) continue;
      const bg = `${a} ${b}`;
      bigramFreq[bg] = (bigramFreq[bg] || 0) + 1;
    }

    const singleKeywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word, count]) => ({ term: word, count, type: "mot" }));

    const bigramKeywords = Object.entries(bigramFreq)
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([term, count]) => ({ term, count, type: "expression" }));

    // Fusion, dédoublonnage léger (si un mot simple est déjà inclus dans un bigramme retenu, on le garde quand même,
    // l'important côté utilisateur est la visibilité du terme)
    return [...bigramKeywords, ...singleKeywords].slice(0, maxKeywords);
  }

  function textContains(haystackNormalized, term) {
    const t = normalize(term);
    if (t.includes(" ")) return haystackNormalized.includes(t);
    // mot simple : on cherche la racine pour tolérer pluriels/conjugaisons simples (ex: "gérer"/"gestion" restent différents, volontairement strict)
    const re = new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\w{0,3}\\b`);
    return re.test(haystackNormalized);
  }

  /* ============================================================
     1bis. ANALYSE MÉTIER — à quels postes ce CV permet-il de postuler ?
     ============================================================
     Indépendant du système de scoring /100 : il s'agit ici d'une
     analyse qualitative du CONTENU réel du CV (compétences et
     expériences effectivement détectées), pas de sa forme.
     Principe directeur : ne jamais inciter à mentir. On distingue :
       - une compétence détenue mais mal valorisée  -> "mettez-la en avant"
       - une compétence manquante                    -> on le dit clairement,
         sans suggérer de la "rajouter" comme si elle était acquise.
     ============================================================ */

  /**
   * Détecte les domaines métiers pertinents pour ce CV, à partir des
   * mots-clés du référentiel JOB_DOMAINS effectivement présents dans
   * le texte. Retourne les domaines triés par pertinence, avec les
   * postes suggérés pour chacun.
   */
  function detectJobDomains(cvText) {
    const cvNorm = normalize(cvText);
    const domainsFound = [];

    JOB_DOMAINS.forEach(domain => {
      const matched = domain.keywords.filter(k => textContains(cvNorm, k));
      const ratio = matched.length / domain.keywords.length;
      if (ratio >= DOMAIN_MATCH_THRESHOLD) {
        domainsFound.push({
          id: domain.id,
          label: domain.label,
          postes: domain.postes,
          matched,
          ratio,
          strength: ratio >= DOMAIN_STRONG_THRESHOLD ? "fort" : "modere"
        });
      }
    });

    domainsFound.sort((a, b) => b.ratio - a.ratio);
    return domainsFound.slice(0, 4); // on garde les 4 domaines les plus pertinents pour rester lisible
  }

  /**
   * Construit le rapport "À quels postes pouvez-vous postuler avec ce CV ?",
   * basé uniquement sur le contenu réel détecté (pas sur l'offre fournie).
   */
  function buildJobSuggestions(cvText) {
    const domains = detectJobDomains(cvText);

    if (domains.length === 0) {
      return {
        domains: [],
        summary: "Le contenu de votre CV ne permet pas d'identifier clairement un domaine métier dominant. Vérifiez que vos compétences et expériences sont bien détaillées (outils maîtrisés, missions réalisées), pas seulement énoncées de façon générale."
      };
    }

    const lines = domains.map(d => {
      const niveau = d.strength === "fort" ? "profil bien aligné" : "profil compatible, à renforcer";
      return `**${d.label}** (${niveau}) — postes envisageables : ${d.postes.join(", ")}.`;
    });

    return {
      domains,
      summary: `D'après le contenu réel de votre CV (compétences et expériences détectées), vous pouvez raisonnablement viser les types de postes suivants :\n\n${lines.join("\n\n")}\n\nCes suggestions reposent uniquement sur ce que votre CV démontre déjà. Pour élargir vos possibilités, développez de vraies compétences supplémentaires plutôt que de simplement les ajouter sur le papier.`
    };
  }

  /**
   * Compare le CV à une offre précise et rend un verdict honnête :
   * - distingue les mots-clés de l'offre déjà couverts par le CV
   * - parmi les mots-clés manquants, separe ceux qui ressemblent à des
   *   compétences "dures" (techniques, outils) de ceux qui sont du
   *   vocabulaire général (mission, contexte) — seules les compétences
   *   dures motivent un avertissement explicite anti-mensonge.
   */
  function buildOfferFitVerdict(cvText, jobText, keywordResult) {
    if (!jobText || keywordResult.noJob) {
      return null; // pas d'offre fournie : pas de verdict d'adéquation à produire
    }

    const matched = keywordResult.matched || [];
    const missing = keywordResult.missing || [];
    const total = matched.length + missing.length;
    const ratio = total ? matched.length / total : 0;

    let level, message;

    if (ratio >= OFFER_MATCH_GOOD) {
      level = "good";
      message = `Votre profil correspond bien à cette offre : la majorité des compétences et termes attendus se retrouvent dans votre CV (${matched.length}/${total}). Vous pouvez postuler avec confiance, en mettant ces points en avant dans votre profil professionnel et vos expériences.`;
    } else if (ratio >= OFFER_MATCH_PARTIAL) {
      level = "partial";
      message = `Votre profil correspond partiellement à cette offre (${matched.length}/${total} éléments attendus retrouvés). Vous pouvez postuler, mais soyez honnête sur ce qui vous manque réellement : ne présentez comme acquis que ce que vous maîtrisez vraiment. S'il s'agit d'éléments secondaires de l'offre, votre candidature reste défendable ; s'il s'agit de compétences centrales du poste, mieux vaut le savoir avant de vous présenter en entretien.`;
    } else {
      level = "low";
      message = `Le recoupement entre votre CV et cette offre est faible (${matched.length}/${total} éléments attendus retrouvés). Soyons honnêtes : en l'état, ce poste ne correspond probablement pas à votre profil actuel. Plutôt que de modifier votre CV pour "faire correspondre" des compétences que vous ne maîtrisez pas, il est préférable de cibler des offres plus alignées avec votre parcours réel — ou de prévoir une formation complémentaire avant de viser ce type de poste.`;
    }

    return {
      level,
      message,
      matchedCount: matched.length,
      missingCount: missing.length,
      total,
      ratio: Math.round(ratio * 100)
    };
  }

  /* ============================================================
     2. CRITÈRE 1 — ATS & LISIBILITÉ (20 pts)
     ============================================================ */

  function scoreAts(cvText, cvMeta) {
    let score = 20;
    const findings = { good: [], bad: [], tips: [] };

    // 2.1 Volume de texte extractible : un CV-image ou mal structuré renvoie très peu de texte exploitable
    const charCount = (cvText || "").replace(/\s+/g, "").length;
    if (charCount < MIN_EXTRACTABLE_CHARS) {
      score -= 10;
      findings.bad.push("Très peu de texte a pu être extrait de votre fichier. Cela arrive souvent quand le CV est une image, une capture d'écran, ou un PDF scanné — les logiciels ATS ne pourront pas le lire non plus.");
      findings.tips.push("Exportez votre CV directement depuis Word, Google Docs ou un éditeur texte en PDF natif (pas une photo ou un scan).");
    } else {
      findings.good.push("Le contenu de votre CV est bien extractible sous forme de texte : c'est ce que les logiciels ATS doivent pouvoir lire.");
    }

    // 2.2 Présence de tableaux complexes / colonnes multiples détectée indirectement
    // via le générateur de fichier (signalé seulement si l'app a pu le détecter, ex: docx avec tables)
    if (cvMeta && cvMeta.hasComplexTables) {
      score -= 5;
      findings.bad.push("Votre document contient des tableaux ou une mise en page en colonnes multiples, ce qui peut perturber la lecture par un ATS.");
      findings.tips.push("Privilégiez une mise en page simple, en une seule colonne, avec des titres de section clairs (pas de tableaux imbriqués ni de zones de texte flottantes).");
    }

    // 2.3 Caractères spéciaux / emojis en excès (mise en page "trop graphique")
    const emojiCount = (cvText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length;
    if (emojiCount > 5) {
      score -= 3;
      findings.bad.push(`Votre CV contient de nombreux symboles ou émojis (${emojiCount} détectés), ce qui peut nuire à une lecture sobre et professionnelle.`);
      findings.tips.push("Réservez les puces classiques (-, •) pour structurer vos listes, plutôt que des émojis ou icônes décoratives.");
    }

    // 2.4 Longueur du document (en mots) — proxy de la "longueur en pages"
    const wordCount = countWords(cvText);
    if (wordCount < 120) {
      score -= 4;
      findings.bad.push("Le contenu semble très court. Un CV trop succinct peut manquer d'éléments concrets pour convaincre un recruteur.");
      findings.tips.push("Détaillez davantage vos expériences et compétences, tout en restant pertinent (1 page pour un débutant, 2-3 pages pour un profil expérimenté).");
    } else if (wordCount > 1400) {
      score -= 3;
      findings.bad.push("Le contenu semble très dense pour la longueur recommandée (au-delà de 2-3 pages pour un profil expérimenté).");
      findings.tips.push("Resserrez les formulations, évitez les répétitions et gardez uniquement les informations qui apportent une vraie valeur ajoutée.");
    } else {
      findings.good.push("La longueur globale du contenu semble adaptée aux standards recommandés.");
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
      // Pas d'offre fournie : on ne peut pas comparer, score neutre informatif
      findings.tips.push("Aucune offre d'emploi n'a été fournie pour cette analyse : le score de correspondance est neutre. Collez ou importez l'offre visée pour une analyse complète des mots-clés.");
      return { score: 12, max: 25, findings, matched: [], missing: [], noJob: true };
    }

    const keywords = extractKeywords(jobText, 25);
    const cvNorm = normalize(cvText);

    const matched = [];
    const missing = [];
    keywords.forEach(k => {
      if (textContains(cvNorm, k.term)) matched.push(k);
      else missing.push(k);
    });

    const ratio = keywords.length ? matched.length / keywords.length : 0;
    let score = Math.round(ratio * 25);

    if (matched.length > 0) {
      findings.good.push(`Votre CV reprend ${matched.length} terme(s)/expression(s) clé(s) sur ${keywords.length} identifiés dans l'offre : ${matched.slice(0, 8).map(m => m.term).join(", ")}${matched.length > 8 ? "…" : ""}.`);
    }
    if (missing.length > 0) {
      findings.bad.push(`${missing.length} mot(s)-clé(s) important(s) de l'offre n'apparaissent pas dans votre CV : ${missing.slice(0, 8).map(m => m.term).join(", ")}${missing.length > 8 ? "…" : ""}.`);
      findings.tips.push("Si vous maîtrisez réellement ces compétences mais ne les avez pas mises en avant, intégrez-les dans vos rubriques \"Compétences\", \"Profil\" ou \"Expériences\". En revanche, si certaines vous manquent réellement, ne les inscrivez pas sur votre CV : voyez le rapport \"Adéquation avec l'offre\" plus bas pour une évaluation honnête de votre correspondance avec ce poste.");
    }
    if (ratio < 0.4) {
      findings.bad.push("Le taux de correspondance global avec l'offre est faible : votre CV risque d'être mal classé par un logiciel ATS pour ce poste précis.");
    } else if (ratio >= 0.7) {
      findings.good.push("Bonne correspondance globale avec le vocabulaire de l'offre : c'est un point fort pour passer le filtrage automatique.");
    }

    return { score, max: 25, findings, matched, missing, noJob: false };
  }

  /* ============================================================
     4. CRITÈRE 3 — STRUCTURE & SECTIONS (20 pts)
     ============================================================ */

  function scoreStructure(cvText) {
    const findings = { good: [], bad: [], tips: [] };
    let score = 0;
    const perSectionPoints = 20 / EXPECTED_SECTIONS.length;
    const missingLabels = [];
    const cvNorm = normalize(cvText); // texte sans accents : tolère la perte d'accents fréquente à l'extraction PDF

    EXPECTED_SECTIONS.forEach(sec => {
      const found = sec.patterns.some(p => p.test(cvNorm));
      if (found) {
        score += perSectionPoints;
      } else {
        missingLabels.push(sec.label);
      }
    });

    score = Math.round(score);

    if (missingLabels.length === 0) {
      findings.good.push("Toutes les rubriques essentielles d'un CV professionnel semblent présentes (coordonnées, profil, formation, compétences, expériences, etc.).");
    } else {
      findings.bad.push(`Certaines rubriques attendues semblent absentes ou non détectées clairement : ${missingLabels.join(", ")}.`);
      findings.tips.push("Reprenez la structure recommandée : informations personnelles, titre du CV, profil professionnel, formation, compétences, expériences, et centres d'intérêt — avec des intitulés de section explicites et bien visibles.");
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

    // 5.1 Présence de chiffres / pourcentages (réalisations quantifiées)
    const numberMatches = cvText.match(/\b\d{1,4}\s?(%|\$|€|fcfa|cfa|personnes|clients|projets|millions?|k\b)/gi) || [];
    const genericNumbers = cvText.match(/\b\d{1,3}\s?%/g) || [];
    const totalQuantified = new Set([...numberMatches, ...genericNumbers]).size;

    if (totalQuantified === 0) {
      score -= 9;
      findings.bad.push("Aucun résultat chiffré n'a été détecté (ex : pourcentages, nombre de personnes encadrées, économies réalisées). Le guide insiste sur l'importance de réalisations concrètes et vérifiables.");
      findings.tips.push("Ajoutez des indicateurs chiffrés à vos expériences : \"réduction des coûts de 15 %\", \"formation de 12 personnes\", \"gestion d'un portefeuille de 50 clients\", etc.");
    } else if (totalQuantified < 3) {
      score -= 4;
      findings.bad.push("Peu de résultats chiffrés sont présents. Quelques indicateurs supplémentaires renforceraient la crédibilité de vos expériences.");
      findings.tips.push("Essayez d'ajouter au moins un chiffre clé par expérience professionnelle marquante.");
    } else {
      findings.good.push(`${totalQuantified} élément(s) chiffré(s) détecté(s) dans votre CV : c'est un bon point pour démontrer des résultats concrets.`);
    }

    // 5.2 Verbes d'action
    const actionCount = ACTION_VERBS.filter(v => cvNorm.includes(normalize(v))).length;
    if (actionCount === 0) {
      score -= 6;
      findings.bad.push("Peu ou pas de verbes d'action forts détectés (ex : \"géré\", \"optimisé\", \"développé\", \"piloté\"). Vos expériences risquent de paraître passives.");
      findings.tips.push("Démarrez vos lignes de mission par un verbe d'action au participe passé ou à l'infinitif : \"Géré un portefeuille de…\", \"Optimisé le processus de…\".");
    } else {
      findings.good.push(`${actionCount} verbe(s) d'action valorisant(s) identifié(s) (ex : géré, optimisé, développé…) — cela renforce l'impact de vos descriptions.`);
    }

    // 5.3 Formulations génériques à éviter (guide : "trop parler de soi")
    const genericFound = GENERIC_PHRASES.filter(p => cvNorm.includes(normalize(p)));
    if (genericFound.length > 0) {
      score -= 5;
      findings.bad.push(`Des formulations génériques ont été repérées (ex : ${genericFound.slice(0, 3).join(", ")}) qui n'apportent pas de valeur ajoutée concrète au recruteur.`);
      findings.tips.push("Remplacez les qualificatifs génériques par des preuves concrètes : plutôt que \"personne motivée\", montrez une réalisation qui illustre cette motivation.");
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

    // 6.1 Nom de fichier professionnel (guide : "Utiliser un nom de fichier non professionnel")
    if (cvMeta && cvMeta.fileName) {
      const fname = cvMeta.fileName.toLowerCase();
      const badPatterns = [/version.?final/, /\(\d+\)/, /copie/, /sans titre/, /document\d*\./, /scan\d*\./, /img_?\d+/, /-ok\./, /modifi/];
      const looksBad = badPatterns.some(p => p.test(fname)) || /\s{2,}/.test(fname);
      if (looksBad) {
        score -= 3;
        findings.bad.push(`Le nom de fichier ("${cvMeta.fileName}") n'est pas optimal pour un envoi professionnel.`);
        findings.tips.push("Renommez votre fichier au format CV_Nom_Prenom.pdf avant de l'envoyer à un recruteur.");
      } else {
        findings.good.push("Le nom du fichier semble correct et professionnel.");
      }
    }

    // 6.2 Format de fichier (le guide recommande le PDF pour l'envoi final)
    if (cvMeta && cvMeta.fileType === "docx") {
      findings.tips.push("Pensez à envoyer votre CV final au format PDF (plus stable à l'ouverture) plutôt qu'en Word, sauf si le recruteur demande explicitement un fichier modifiable.");
    }

    // 6.3 Cohérence des espacements / sauts de ligne excessifs (mise en page mal aérée ou au contraire trop éclatée)
    const excessiveBlankLines = (cvText.match(/\n\s*\n\s*\n/g) || []).length;
    if (excessiveBlankLines > 8) {
      score -= 2;
      findings.bad.push("De nombreux espaces ou retours à la ligne excessifs ont été détectés, ce qui peut indiquer une mise en page peu maîtrisée (zones de texte mal alignées).");
      findings.tips.push("Vérifiez l'alignement et l'espacement de votre document avant export final.");
    }

    // 6.4 Détection grossière de répétitions de mots rares (signe de copier-coller mal nettoyé)
    const lines = cvText.split("\n").map(l => l.trim()).filter(Boolean);
    const dupCount = lines.length - new Set(lines).size;
    if (dupCount > 5) {
      score -= 3;
      findings.bad.push("Plusieurs lignes identiques ou très similaires se répètent dans le document, ce qui peut nuire à la lisibilité.");
      findings.tips.push("Relisez votre CV pour éliminer les répétitions et garder un contenu concis.");
    }

    // 6.5 Présence d'une date d'établissement / cohérence formelle minimale
    if (!/\d{1,2}\s?[\/.\-]\s?\d{1,2}\s?[\/.\-]\s?\d{2,4}/.test(cvText) && !/\b(19|20)\d{2}\b/.test(cvText)) {
      score -= 2;
      findings.bad.push("Aucune date n'a été détectée dans le document (formations, expériences). Vérifiez que vos dates sont bien renseignées.");
    }

    score = Math.max(0, Math.min(15, score));

    if (findings.good.length === 0 && findings.bad.length === 0) {
      findings.good.push("Aucun problème de forme majeur détecté.");
    }

    return { score, max: 15, findings };
  }

  /* ============================================================
     7. AGRÉGATION FINALE
     ============================================================ */

  /**
   * Analyse complète.
   * @param {string} cvText - texte brut extrait du CV
   * @param {string} jobText - texte brut de l'offre d'emploi (peut être vide)
   * @param {object} cvMeta - { fileName, fileType, hasComplexTables }
   */
  function analyze(cvText, jobText, cvMeta = {}) {
    const ats = scoreAts(cvText, cvMeta);
    const keywords = scoreKeywords(cvText, jobText);
    const structure = scoreStructure(cvText);
    const impact = scoreImpact(cvText);
    const form = scoreForm(cvText, cvMeta);

    const criteria = [
      { id: "ats", label: "Lisibilité ATS", icon: "🤖", ...ats },
      { id: "keywords", label: "Mots-clés vs offre", icon: "🎯", ...keywords },
      { id: "structure", label: "Structure & sections", icon: "🧱", ...structure },
      { id: "impact", label: "Résultats & impact", icon: "📈", ...impact },
      { id: "form", label: "Forme & présentation", icon: "🪞", ...form }
    ];

    const totalScore = criteria.reduce((sum, c) => sum + c.score, 0);
    const totalMax = criteria.reduce((sum, c) => sum + c.max, 0);
    const globalScore = Math.round((totalScore / totalMax) * 100);

    let verdict, verdictClass;
    if (globalScore >= 80) { verdict = "Excellent — votre CV est solide et bien optimisé."; verdictClass = "great"; }
    else if (globalScore >= 60) { verdict = "Bon départ — quelques ajustements ciblés amélioreront vos chances."; verdictClass = "ok"; }
    else if (globalScore >= 40) { verdict = "Des corrections importantes sont nécessaires avant envoi."; verdictClass = "warn"; }
    else { verdict = "Ce CV risque d'être écarté rapidement : une révision en profondeur est conseillée."; verdictClass = "bad"; }

    // Analyse du CONTENU (indépendante du score ATS/forme) : à quels postes ce CV permet-il de postuler,
    // et — si une offre précise est fournie — un verdict d'adéquation honnête, sans inciter à mentir.
    const jobSuggestions = buildJobSuggestions(cvText);
    const offerFitVerdict = buildOfferFitVerdict(cvText, jobText, keywords);

    return {
      globalScore,
      verdict,
      verdictClass,
      criteria,
      jobSuggestions,
      offerFitVerdict,
      meta: cvMeta,
      generatedAt: new Date().toISOString()
    };
  }

  return { analyze, extractKeywords, tokenize };
})();
