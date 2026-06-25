/* ============================================================
   CV BOOSTER PRO — Configuration centrale
   Définit les 3 profils (Débutant / Intermédiaire / Expérimenté),
   leurs champs de formulaire (issus des Google Forms d'origine)
   et les 5 palettes de couleurs disponibles pour le rendu du CV.
   ============================================================ */

const CV_CONFIG = {

  /* ---------- PALETTES DE COULEURS ---------- */
  // 1 fidèle à l'original (bleu) + 4 modernes
  palettes: [
    {
      id: "classique_bleu",
      name: "Classique Bleu",
      description: "Le design original, sobre et professionnel",
      primary: "#1d4f91",
      secondary: "#2e75b6",
      accent: "#5b9bd5",
      text: "#1a1a1a",
      textLight: "#555555",
      bgLight: "#eef4fb",
      style: "classic"
    },
    {
      id: "moderne_emeraude",
      name: "Moderne Émeraude",
      description: "Vert profond, look frais et contemporain",
      primary: "#0f5132",
      secondary: "#198754",
      accent: "#5fd9a4",
      text: "#1a1a1a",
      textLight: "#555555",
      bgLight: "#eafaf1",
      style: "modern"
    },
    {
      id: "moderne_graphite",
      name: "Moderne Graphite",
      description: "Noir/gris anthracite avec touche corail, très haut de gamme",
      primary: "#212529",
      secondary: "#495057",
      accent: "#e8623a",
      text: "#212529",
      textLight: "#6c757d",
      bgLight: "#f4f4f5",
      style: "modern"
    },
    {
      id: "moderne_bordeaux",
      name: "Moderne Bordeaux",
      description: "Rouge bordeaux élégant, idéal profils expérimentés",
      primary: "#6e1423",
      secondary: "#9e1b32",
      accent: "#d88c9a",
      text: "#1a1a1a",
      textLight: "#555555",
      bgLight: "#fbeef0",
      style: "modern"
    },
    {
      id: "moderne_violet",
      name: "Moderne Violet",
      description: "Violet créatif, idéal profils débutants / créatifs",
      primary: "#4c1d6e",
      secondary: "#7b2cbf",
      accent: "#c19ee0",
      text: "#1a1a1a",
      textLight: "#555555",
      bgLight: "#f4ecfb",
      style: "modern"
    }
  ],

  /* ---------- PROFILS ---------- */
  profiles: {

    debutant: {
      id: "debutant",
      label: "Profil Débutant",
      tagline: "2 expériences professionnelles + 1 activité bénévole",
      expCount: 2,
      benevolatCount: 1,
      formationCount: 3,
      sections: [
        {
          id: "identite",
          title: "Informations personnelles",
          description: "Renseignez toutes les informations avec exactitude. Ces données figurent en haut du CV et permettent de vous identifier clairement. L'email sera utilisé pour vous envoyer votre CV.",
          fields: [
            { key: "NOM", label: "Nom", type: "text", required: true },
            { key: "PRENOMS", label: "Prénoms", type: "text", required: true },
            { key: "TITRE", label: "Titre professionnel", type: "text", required: true, placeholder: "Ex: Assistant Comptable" },
            { key: "ANNEES_EXPERIENCES", label: "Années d'expérience", type: "text", required: false },
            { key: "TEL", label: "Téléphone", type: "tel", required: true },
            { key: "EMAIL", label: "Email", type: "email", required: true },
            { key: "ADRESSE", label: "Adresse", type: "text", required: true },
            { key: "PAYS", label: "Pays", type: "text", required: true },
            { key: "SEXE", label: "Sexe", type: "select", required: true, options: ["Masculin", "Féminin"] },
            { key: "ETAT_CIVIL", label: "État civil", type: "select", required: true, options: ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf/Veuve"] }
          ]
        },
        {
          id: "profil",
          title: "Profil",
          description: "Décrivez brièvement qui vous êtes sur le plan professionnel : domaine d'expertise, points forts, spécialité.",
          fields: [
            { key: "QUEL_EST_VOTRE_PROFIL", label: "Votre profil", type: "textarea", required: true }
          ]
        },
        {
          id: "formations",
          title: "Formations",
          description: "Renseignez vos diplômes en ordre antéchronologique (du plus récent au plus ancien). Format des dates : JAN.2023",
          repeatable: true,
          repeatKey: "formation",
          count: 3,
          itemFields: [
            { key: "DIPLOME", label: "Diplôme", type: "text", required: true },
            { key: "PETITE_DESCRIPTION", label: "Petite description", type: "textarea", required: true },
            { key: "ECOLE", label: "École / Université / Centre de formation", type: "text", required: true },
            { key: "LIEU", label: "Lieu", type: "text", required: true },
            { key: "DEBUT", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "FIN", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "competences",
          title: "Compétences & Certifications",
          description: "Indiquez vos compétences techniques, numériques, sociales, etc. et vos certifications.",
          fields: [
            { key: "LISTEZ_1", label: "Compétences", type: "textarea", required: true },
            { key: "LISTEZ_2", label: "Certifications", type: "textarea", required: true }
          ]
        },
        {
          id: "experiences",
          title: "Expériences professionnelles",
          description: "Décrivez vos expériences de la plus récente à la plus ancienne. Format des dates : JAN.2023",
          repeatable: true,
          repeatKey: "experience",
          count: 2,
          itemFields: [
            { key: "POSTE", label: "Poste", type: "text", required: true },
            { key: "SOCIETE", label: "Société", type: "text", required: true },
            { key: "LIEU", label: "Lieu", type: "text", required: true },
            { key: "TACHES_EFFECTUEES", label: "Tâches effectuées", type: "textarea", required: true },
            { key: "DEBUT", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "FIN", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "benevolat",
          title: "Bénévolat / Activité extra-scolaire",
          description: "Ajoutez une activité bénévole ou extra-scolaire significative. Format des dates : JAN.2023",
          repeatable: true,
          repeatKey: "benevolat",
          count: 1,
          itemFields: [
            { key: "ROLE", label: "Rôle", type: "text", required: true },
            { key: "ACTIVITES_MENEES", label: "Activités menées", type: "textarea", required: true },
            { key: "STRUCTURE", label: "Structure", type: "text", required: true },
            { key: "OU", label: "Lieu", type: "text", required: true },
            { key: "DEPART", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "TERME", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "langues",
          title: "Langues",
          description: "Mentionnez les langues que vous maîtrisez avec un niveau de 1 à 5.",
          repeatable: true,
          repeatKey: "langue",
          count: 3,
          itemFields: [
            { key: "LANGUE", label: "Langue", type: "text", required: true },
            { key: "NIVEAU", label: "Niveau (1 à 5)", type: "range", required: true, min: 1, max: 5 }
          ]
        },
        {
          id: "references",
          title: "Références",
          description: "Coordonnées de personnes pouvant attester de votre sérieux (nom complet, fonction, téléphone, email).",
          repeatable: true,
          repeatKey: "personne",
          count: 3,
          itemFields: [
            { key: "PERSONNE", label: "Référence complète", type: "textarea", required: true, placeholder: "Mme Awa SANKARA, Encadreure de stage, +226 70 12 34 56, awa.sankara@gmail.com" }
          ]
        },
        {
          id: "interets",
          title: "Centres d'intérêt",
          description: "Listez quelques activités ou passions personnelles.",
          fields: [
            { key: "LISTEZ_LES", label: "Centres d'intérêt", type: "textarea", required: true }
          ]
        },
        {
          id: "etablissement",
          title: "Date d'établissement",
          description: "Ces informations seront placées à la fin du CV, dans la déclaration sur l'honneur. Format : 12/09/2025",
          fields: [
            { key: "VOTRE_VILLE", label: "Votre ville", type: "text", required: true },
            { key: "LA_DATE", label: "Date", type: "text", required: true }
          ]
        }
      ]
    },

    intermediaire: {
      id: "intermediaire",
      label: "Profil Intermédiaire",
      tagline: "3 expériences professionnelles + 2 activités bénévoles",
      expCount: 3,
      benevolatCount: 2,
      formationCount: 3,
      sections: [
        {
          id: "identite",
          title: "Informations personnelles",
          description: "Renseignez toutes les informations avec exactitude. Ces données figurent en haut du CV.",
          fields: [
            { key: "NOM", label: "Nom", type: "text", required: true },
            { key: "PRENOMS", label: "Prénoms", type: "text", required: true },
            { key: "TITRE", label: "Titre professionnel", type: "text", required: true },
            { key: "ANNEES_EXPERIENCES", label: "Années d'expérience", type: "text", required: true },
            { key: "TEL", label: "Téléphone", type: "tel", required: true },
            { key: "EMAIL", label: "Email", type: "email", required: true },
            { key: "ADRESSE", label: "Adresse", type: "text", required: true },
            { key: "PAYS", label: "Pays", type: "text", required: true },
            { key: "SEXE", label: "Sexe", type: "select", required: true, options: ["Masculin", "Féminin"] },
            { key: "ETAT_CIVIL", label: "État civil", type: "select", required: true, options: ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf/Veuve"] }
          ]
        },
        {
          id: "profil",
          title: "Profil",
          description: "Décrivez brièvement qui vous êtes sur le plan professionnel.",
          fields: [
            { key: "QUEL_EST_VOTRE_PROFIL", label: "Votre profil", type: "textarea", required: true }
          ]
        },
        {
          id: "experiences",
          title: "Expériences professionnelles",
          description: "Décrivez vos expériences de la plus récente à la plus ancienne. Format des dates : JAN.2023",
          repeatable: true,
          repeatKey: "experience",
          count: 3,
          itemFields: [
            { key: "POSTE", label: "Poste", type: "text", required: true },
            { key: "SOCIETE", label: "Société", type: "text", required: true },
            { key: "LIEU", label: "Lieu", type: "text", required: true },
            { key: "TACHES_EFFECTUEES", label: "Tâches effectuées", type: "textarea", required: true },
            { key: "DEBUT", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "FIN", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "competences",
          title: "Compétences & Certifications",
          description: "Compétences techniques, numériques, sociales et certifications pertinentes.",
          fields: [
            { key: "LISTEZ_1", label: "Compétences", type: "textarea", required: true },
            { key: "LISTEZ_2", label: "Certifications", type: "textarea", required: true }
          ]
        },
        {
          id: "formations",
          title: "Formations",
          description: "Renseignez vos diplômes en ordre antéchronologique. Format des dates : JAN.2023",
          repeatable: true,
          repeatKey: "formation",
          count: 3,
          itemFields: [
            { key: "DIPLOME", label: "Diplôme", type: "text", required: true },
            { key: "PETITE_DESCRIPTION", label: "Petite description", type: "textarea", required: true },
            { key: "ECOLE", label: "École / Université / Centre de formation", type: "text", required: true },
            { key: "LIEU", label: "Lieu", type: "text", required: true },
            { key: "DEBUT", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "FIN", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "benevolat",
          title: "Bénévolat / Activités extra-professionnelles",
          description: "Ajoutez vos activités bénévoles significatives. Format des dates : JAN.2023",
          repeatable: true,
          repeatKey: "benevolat",
          count: 2,
          itemFields: [
            { key: "ROLE", label: "Rôle", type: "text", required: true },
            { key: "ACTIVITES_MENEES", label: "Activités menées", type: "textarea", required: true },
            { key: "STRUCTURE", label: "Structure", type: "text", required: true },
            { key: "OU", label: "Lieu", type: "text", required: true },
            { key: "DEPART", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "TERME", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "langues",
          title: "Langues",
          description: "Langues maîtrisées avec un niveau de 1 à 5.",
          repeatable: true,
          repeatKey: "langue",
          count: 3,
          itemFields: [
            { key: "LANGUE", label: "Langue", type: "text", required: true },
            { key: "NIVEAU", label: "Niveau (1 à 5)", type: "range", required: true, min: 1, max: 5 }
          ]
        },
        {
          id: "references",
          title: "Références",
          description: "Coordonnées de personnes pouvant attester de votre sérieux.",
          repeatable: true,
          repeatKey: "personne",
          count: 3,
          itemFields: [
            { key: "PERSONNE", label: "Référence complète", type: "textarea", required: true, placeholder: "Mme Awa SANKARA, Encadreure de stage, +226 70 12 34 56, awa.sankara@gmail.com" }
          ]
        },
        {
          id: "interets",
          title: "Centres d'intérêt",
          description: "Listez quelques activités ou passions personnelles.",
          fields: [
            { key: "LISTEZ_LES", label: "Centres d'intérêt", type: "textarea", required: true }
          ]
        },
        {
          id: "etablissement",
          title: "Date d'établissement",
          description: "Placées dans la déclaration sur l'honneur. Format : 12/09/2025",
          fields: [
            { key: "VOTRE_VILLE", label: "Votre ville", type: "text", required: true },
            { key: "LA_DATE", label: "Date", type: "text", required: true }
          ]
        }
      ]
    },

    experimente: {
      id: "experimente",
      label: "Profil Expérimenté",
      tagline: "5 expériences professionnelles + 3 activités bénévoles",
      expCount: 5,
      benevolatCount: 3,
      formationCount: 3,
      sections: [
        {
          id: "identite",
          title: "Informations personnelles",
          description: "Renseignez toutes les informations avec exactitude. Ces données figurent en haut du CV.",
          fields: [
            { key: "NOM", label: "Nom", type: "text", required: true },
            { key: "PRENOMS", label: "Prénoms", type: "text", required: true },
            { key: "TITRE", label: "Titre professionnel", type: "text", required: true },
            { key: "ANNEES_EXPERIENCES", label: "Années d'expérience", type: "text", required: true },
            { key: "TEL", label: "Téléphone", type: "tel", required: true },
            { key: "EMAIL", label: "Email", type: "email", required: true },
            { key: "ADRESSE", label: "Adresse", type: "text", required: true },
            { key: "PAYS", label: "Pays", type: "text", required: true },
            { key: "SEXE", label: "Sexe", type: "select", required: true, options: ["Masculin", "Féminin"] },
            { key: "ETAT_CIVIL", label: "État civil", type: "select", required: true, options: ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf/Veuve"] }
          ]
        },
        {
          id: "profil",
          title: "Profil",
          description: "Décrivez brièvement qui vous êtes sur le plan professionnel.",
          fields: [
            { key: "QUEL_EST_VOTRE_PROFIL", label: "Votre profil", type: "textarea", required: true }
          ]
        },
        {
          id: "experiences",
          title: "Expériences professionnelles",
          description: "Décrivez vos 5 expériences de la plus récente à la plus ancienne. Format des dates : JAN.2023",
          repeatable: true,
          repeatKey: "experience",
          count: 5,
          itemFields: [
            { key: "POSTE", label: "Poste", type: "text", required: true },
            { key: "SOCIETE", label: "Société", type: "text", required: true },
            { key: "LIEU", label: "Lieu", type: "text", required: true },
            { key: "TACHES_EFFECTUEES", label: "Tâches effectuées", type: "textarea", required: true },
            { key: "DEBUT", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "FIN", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "competences",
          title: "Compétences & Certifications",
          description: "Compétences techniques, numériques, sociales et certifications pertinentes.",
          fields: [
            { key: "LISTEZ_1", label: "Compétences", type: "textarea", required: true },
            { key: "LISTEZ_2", label: "Certifications", type: "textarea", required: true }
          ]
        },
        {
          id: "benevolat",
          title: "Bénévolat / Activités extra-professionnelles",
          description: "Ajoutez vos 3 activités bénévoles significatives. Format des dates : janvier 2023",
          repeatable: true,
          repeatKey: "benevolat",
          count: 3,
          itemFields: [
            { key: "ROLE", label: "Rôle", type: "text", required: true },
            { key: "ACTIVITES_MENEES", label: "Activités menées", type: "textarea", required: true },
            { key: "STRUCTURE", label: "Structure", type: "text", required: true },
            { key: "OU", label: "Lieu", type: "text", required: true },
            { key: "DEPART", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "TERME", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "formations",
          title: "Formations",
          description: "Renseignez vos diplômes en ordre antéchronologique. Format des dates : JAN.2023",
          repeatable: true,
          repeatKey: "formation",
          count: 3,
          itemFields: [
            { key: "DIPLOME", label: "Diplôme", type: "text", required: true },
            { key: "PETITE_DESCRIPTION", label: "Petite description", type: "textarea", required: true },
            { key: "ECOLE", label: "École / Université / Centre de formation", type: "text", required: true },
            { key: "LIEU", label: "Lieu", type: "text", required: true },
            { key: "DEBUT", label: "Début (ex: JAN.2023)", type: "text", required: true },
            { key: "FIN", label: "Fin (ex: DEC.2024)", type: "text", required: true }
          ]
        },
        {
          id: "langues",
          title: "Langues",
          description: "Langues maîtrisées avec un niveau de 1 à 5.",
          repeatable: true,
          repeatKey: "langue",
          count: 3,
          itemFields: [
            { key: "LANGUE", label: "Langue", type: "text", required: true },
            { key: "NIVEAU", label: "Niveau (1 à 5)", type: "range", required: false, min: 1, max: 5 }
          ]
        },
        {
          id: "references",
          title: "Références",
          description: "Coordonnées de personnes pouvant attester de votre sérieux.",
          repeatable: true,
          repeatKey: "personne",
          count: 3,
          itemFields: [
            { key: "PERSONNE", label: "Référence complète", type: "textarea", required: true, placeholder: "Mme Awa SANKARA, Encadreure de stage, +226 70 12 34 56, awa.sankara@gmail.com" }
          ]
        },
        {
          id: "interets",
          title: "Centres d'intérêt",
          description: "Listez quelques activités ou passions personnelles.",
          fields: [
            { key: "LISTEZ_LES", label: "Centres d'intérêt", type: "textarea", required: true }
          ]
        },
        {
          id: "etablissement",
          title: "Date d'établissement",
          description: "Placées dans la déclaration sur l'honneur. Format : 12/09/2025",
          fields: [
            { key: "VOTRE_VILLE", label: "Votre ville", type: "text", required: true },
            { key: "LA_DATE", label: "Date", type: "text", required: true }
          ]
        }
      ]
    }
  }
};

// Ordre d'affichage des sections sur le CV final (indépendant de l'ordre de saisie)
// Reproduit l'ordre exact des Google Docs d'origine pour chaque profil
const CV_RENDER_ORDER = {
  debutant: ["formations", "competences", "experiences", "benevolat", "langues", "references", "interets"],
  intermediaire: ["experiences", "competences", "formations", "benevolat", "langues", "references", "interets"],
  experimente: ["experiences", "competences", "benevolat", "formations", "langues", "references", "interets"]
};
