export type InsightPriority = "High" | "Medium" | "Low";

export type BusinessInsight = {
  id: string;
  priority: InsightPriority;
  category: string;
  title: string;
  summary: string;
  recommendedAction: string;
};

export type InsightsResponse = {
  generatedAt: string;
  insights: BusinessInsight[];
};

export function isInsightPriority(value: unknown): value is InsightPriority {
  return value === "High" || value === "Medium" || value === "Low";
}
