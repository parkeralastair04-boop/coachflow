export const FEEDBACK_CATEGORIES = [
  "general_feedback",
  "user_experience",
  "positive_feedback",
  "improvement_suggestion",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_STATUSES = ["new", "reviewed", "actioned", "archived"] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  general_feedback: "General feedback",
  user_experience: "Ease of use",
  positive_feedback: "What's working well",
  improvement_suggestion: "Improvement idea",
};

const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  reviewed: "Reviewed",
  actioned: "Actioned",
  archived: "Archived",
};

export function getFeedbackCategoryLabel(category: FeedbackCategory): string {
  return FEEDBACK_CATEGORY_LABELS[category];
}

export function getFeedbackStatusLabel(status: FeedbackStatus): string {
  return FEEDBACK_STATUS_LABELS[status];
}

export function isFeedbackCategory(value: string): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly string[]).includes(value);
}

export function isFeedbackStatus(value: string): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly string[]).includes(value);
}
