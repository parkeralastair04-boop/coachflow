export type GuidedReportNotes = {
  technical: string;
  physical: string;
  decisionMaking: string;
  attitude: string;
  nextFocus: string;
};

export const GUIDED_REPORT_NOTE_LABELS: Array<{
  key: keyof GuidedReportNotes;
  label: string;
}> = [
  { key: "technical", label: "Technical" },
  { key: "physical", label: "Physical" },
  { key: "decisionMaking", label: "Decision making" },
  { key: "attitude", label: "Attitude" },
  { key: "nextFocus", label: "Next focus" },
];

export const EMPTY_GUIDED_REPORT_NOTES: GuidedReportNotes = {
  technical: "",
  physical: "",
  decisionMaking: "",
  attitude: "",
  nextFocus: "",
};

const GUIDED_NOTE_PATTERNS: Array<{
  key: keyof GuidedReportNotes;
  label: string;
}> = [
  { key: "technical", label: "Technical" },
  { key: "physical", label: "Physical" },
  { key: "decisionMaking", label: "Decision making" },
  { key: "attitude", label: "Attitude" },
  { key: "nextFocus", label: "Next focus" },
];

export function serializeGuidedNotes(notes: GuidedReportNotes): string {
  return GUIDED_NOTE_PATTERNS.map(({ key, label }) => {
    const value = notes[key].trim();
    return `${label}:\n${value}`;
  })
    .filter((section) => section.split("\n")[1]?.trim())
    .join("\n\n");
}

export function parseGuidedNotes(raw: string): GuidedReportNotes {
  const parsed: GuidedReportNotes = { ...EMPTY_GUIDED_REPORT_NOTES };
  const trimmed = raw.trim();
  if (!trimmed) return parsed;

  let matchedAnySection = false;
  for (let index = 0; index < GUIDED_NOTE_PATTERNS.length; index += 1) {
    const current = GUIDED_NOTE_PATTERNS[index];
    const next = GUIDED_NOTE_PATTERNS[index + 1];
    const startPattern = new RegExp(
      `(?:^|\\n)${escapeRegExp(current.label)}:\\s*`,
      "i",
    );
    const startMatch = startPattern.exec(trimmed);
    if (!startMatch || startMatch.index === undefined) continue;

    matchedAnySection = true;
    const contentStart = startMatch.index + startMatch[0].length;
    let contentEnd = trimmed.length;

    if (next) {
      const nextPattern = new RegExp(`\\n${escapeRegExp(next.label)}:`, "i");
      const nextMatch = nextPattern.exec(trimmed.slice(contentStart));
      if (nextMatch?.index !== undefined) {
        contentEnd = contentStart + nextMatch.index;
      }
    }

    parsed[current.key] = trimmed.slice(contentStart, contentEnd).trim();
  }

  if (!matchedAnySection) {
    parsed.technical = trimmed;
  }

  return parsed;
}

export function guidedNotesToPlainText(notes: GuidedReportNotes): string {
  const serialized = serializeGuidedNotes(notes);
  return serialized.trim();
}

export function hasGuidedNoteContent(notes: GuidedReportNotes): boolean {
  return GUIDED_NOTE_PATTERNS.some(({ key }) => notes[key].trim().length > 0);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
