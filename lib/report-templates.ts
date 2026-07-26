export type ReportTemplateId =
  | "general"
  | "end_of_term"
  | "match_performance"
  | "goalkeeper"
  | "one_to_one";

export type ReportTemplateOption = {
  id: ReportTemplateId;
  label: string;
  description: string;
};

export const REPORT_TEMPLATE_OPTIONS: ReportTemplateOption[] = [
  {
    id: "general",
    label: "General progress report",
    description: "Balanced update on recent training and development.",
  },
  {
    id: "end_of_term",
    label: "End-of-term report",
    description: "Reflective summary across the term with encouragement.",
  },
  {
    id: "match_performance",
    label: "Match performance review",
    description: "Short-term feedback after a match or fixture block.",
  },
  {
    id: "goalkeeper",
    label: "Goalkeeper report",
    description: "Position-specific language for shot-stopping and distribution.",
  },
  {
    id: "one_to_one",
    label: "1-to-1 development report",
    description: "Individual focus from a private coaching conversation.",
  },
];

export const DEFAULT_REPORT_TEMPLATE: ReportTemplateId = "general";

export function isReportTemplateId(value: string): value is ReportTemplateId {
  return REPORT_TEMPLATE_OPTIONS.some((option) => option.id === value);
}

export function getReportTemplatePrompt(template: ReportTemplateId): string {
  switch (template) {
    case "end_of_term":
      return "Write a reflective end-of-term report. Look back across recent weeks, note steady progress, and end with warm encouragement for the break ahead.";
    case "match_performance":
      return "Focus on recent match or game-day performance. Keep feedback practical and short-term.";
    case "goalkeeper":
      return "Use goalkeeper-specific language where relevant: handling, positioning, communication, distribution, and decision making under pressure.";
    case "one_to_one":
      return "Write as if following a 1-to-1 development conversation. Keep the tone personal, specific, and supportive.";
    case "general":
    default:
      return "Write a balanced general progress report for parents based on recent training.";
  }
}
