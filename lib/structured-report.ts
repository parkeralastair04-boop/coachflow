export type StructuredProgressReport = {
  strengths: string;
  developmentFocus: string;
  attendance: string;
  nextSteps: string;
  overallSummary: string;
};

export const STRUCTURED_REPORT_STORAGE_PREFIX = "awarix:v1:";
/** Pre-rebrand storage prefix — still accepted when parsing existing reports. */
const LEGACY_STRUCTURED_REPORT_STORAGE_PREFIX = "coachflow:v1:";

export const REPORT_SECTIONS: Array<{
  key: keyof StructuredProgressReport;
  heading: string;
}> = [
  { key: "strengths", heading: "Strengths" },
  { key: "developmentFocus", heading: "Development focus" },
  { key: "attendance", heading: "Attendance" },
  { key: "nextSteps", heading: "Next steps" },
  { key: "overallSummary", heading: "Overall summary" },
];

const EMPTY_STRUCTURED_REPORT: StructuredProgressReport = {
  strengths: "",
  developmentFocus: "",
  attendance: "",
  nextSteps: "",
  overallSummary: "",
};

function isStructuredProgressReport(value: unknown): value is StructuredProgressReport {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return REPORT_SECTIONS.every(
    ({ key }) => typeof record[key] === "string",
  );
}

export function serializeStructuredReport(report: StructuredProgressReport): string {
  return `${STRUCTURED_REPORT_STORAGE_PREFIX}${JSON.stringify(report)}`;
}

export function parseReportContent(raw: string): StructuredProgressReport {
  const trimmed = raw.trim();
  if (!trimmed) return { ...EMPTY_STRUCTURED_REPORT };

  const prefix = trimmed.startsWith(STRUCTURED_REPORT_STORAGE_PREFIX)
    ? STRUCTURED_REPORT_STORAGE_PREFIX
    : trimmed.startsWith(LEGACY_STRUCTURED_REPORT_STORAGE_PREFIX)
      ? LEGACY_STRUCTURED_REPORT_STORAGE_PREFIX
      : null;

  if (prefix) {
    try {
      const parsed = JSON.parse(trimmed.slice(prefix.length)) as unknown;
      if (isStructuredProgressReport(parsed)) {
        return {
          strengths: parsed.strengths.trim(),
          developmentFocus: parsed.developmentFocus.trim(),
          attendance: parsed.attendance.trim(),
          nextSteps: parsed.nextSteps.trim(),
          overallSummary: parsed.overallSummary.trim(),
        };
      }
    } catch {
      // Fall through to legacy parsing.
    }
  }

  const markdownSections = parseMarkdownSections(trimmed);
  if (markdownSections) return markdownSections;

  return {
    ...EMPTY_STRUCTURED_REPORT,
    overallSummary: trimmed,
  };
}

function parseMarkdownSections(raw: string): StructuredProgressReport | null {
  const headings = REPORT_SECTIONS.map(({ heading }) => heading);
  const pattern = new RegExp(
    `^##\\s+(${headings.map(escapeRegExp).join("|")})\\s*$`,
    "gim",
  );
  const matches = [...raw.matchAll(pattern)];
  if (matches.length === 0) return null;

  const parsed: StructuredProgressReport = { ...EMPTY_STRUCTURED_REPORT };

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const heading = match[1];
    const section = REPORT_SECTIONS.find(
      (item) => item.heading.toLowerCase() === heading.toLowerCase(),
    );
    if (!section || match.index === undefined) continue;

    const contentStart = match.index + match[0].length;
    const contentEnd =
      index + 1 < matches.length && matches[index + 1].index !== undefined
        ? matches[index + 1].index!
        : raw.length;
    parsed[section.key] = raw.slice(contentStart, contentEnd).trim();
  }

  const hasContent = REPORT_SECTIONS.some(({ key }) => parsed[key].trim().length > 0);
  return hasContent ? parsed : null;
}

export function formatReportPlainText(report: StructuredProgressReport): string {
  return REPORT_SECTIONS.map(({ key, heading }) => {
    const value = report[key].trim();
    if (!value) return "";
    return `${heading}\n${value}`;
  })
    .filter(Boolean)
    .join("\n\n");
}

export function getReportExcerpt(raw: string, maxLength = 120): string {
  const parsed = parseReportContent(raw);
  const preferred =
    parsed.overallSummary ||
    parsed.strengths ||
    parsed.developmentFocus ||
    parsed.nextSteps ||
    parsed.attendance;

  const trimmed = preferred.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

export function getReportTrendCopy(reportCount: number): string {
  if (reportCount === 0) return "No reports created yet.";
  if (reportCount === 1) return "1 report created this season.";
  return `${reportCount} reports created this season.`;
}

export function parseStructuredReportFromModelOutput(
  output: string,
): StructuredProgressReport | null {
  const trimmed = output.trim();
  if (!trimmed) return null;

  const jsonCandidate = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(jsonCandidate) as unknown;
    if (isStructuredProgressReport(parsed)) {
      return {
        strengths: parsed.strengths.trim(),
        developmentFocus: parsed.developmentFocus.trim(),
        attendance: parsed.attendance.trim(),
        nextSteps: parsed.nextSteps.trim(),
        overallSummary: parsed.overallSummary.trim(),
      };
    }
  } catch {
    // Ignore invalid JSON.
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
