export const FAMILY_DOCUMENT_IDS = [
  "medical_form",
  "consent_form",
  "photography_consent",
  "code_of_conduct",
] as const;

export type FamilyDocumentId = (typeof FAMILY_DOCUMENT_IDS)[number];

export type FamilyDocumentDefinition = {
  id: FamilyDocumentId;
  title: string;
  description: string;
};

export const FAMILY_DOCUMENTS: FamilyDocumentDefinition[] = [
  {
    id: "medical_form",
    title: "Medical form",
    description: "Share medical conditions and emergency contacts with your coach.",
  },
  {
    id: "consent_form",
    title: "Consent form",
    description: "Confirm participation and emergency treatment consent.",
  },
  {
    id: "photography_consent",
    title: "Photography consent",
    description: "Choose whether your child can appear in academy photos.",
  },
  {
    id: "code_of_conduct",
    title: "Code of conduct",
    description: "Academy behaviour and safeguarding expectations for families.",
  },
];

export function getFamilyDocument(id: FamilyDocumentId): FamilyDocumentDefinition {
  return FAMILY_DOCUMENTS.find((document) => document.id === id) ?? FAMILY_DOCUMENTS[0];
}

export function buildFamilyDocumentPdfContent(args: {
  documentId: FamilyDocumentId;
  academyName: string;
  playerName: string;
  parentName: string | null;
}): string {
  const document = getFamilyDocument(args.documentId);
  const parentLine = args.parentName ? `Parent/guardian: ${args.parentName}` : "Parent/guardian: __________________";
  return `${document.title}
${args.academyName}

Player: ${args.playerName}
${parentLine}
Date: __________________

${document.description}

Please complete and return this form to your coach if requested.

Privacy: ${args.academyName} handles player information in line with the academy privacy policy.`;
}
