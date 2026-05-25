export const SUPPORT_EMAIL = "support@coachflow.website";

/** E.164 without + for wa.me links */
export const SUPPORT_WHATSAPP_E164 = "447818968712";

export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_E164}`;

export const USER_GUIDE_URL = "https://coachflow.website/docs/user-guide";

export const FEATURE_OVERVIEW_URL = "https://coachflow.website/#features";

export function supportMailto(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject });
  if (body) params.set("body", body);
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

export const FAQ_ITEMS = [
  {
    question: "How do I add players?",
    answer:
      "Open Players under Coaching Operations, then use the add-player form with name, parent contact details, and optional notes. Every player is scoped to your coach account.",
  },
  {
    question: "How do I generate AI reports?",
    answer:
      "Go to Reports, select a player, paste your session notes, and click generate. CoachFlow drafts a parent-ready summary you can edit before saving or sending.",
  },
  {
    question: "How do I send reports to parents?",
    answer:
      "From Reports, generate or open a saved report, then use Send report. Ensure the player has a parent email on file — available on Pro and Academy plans.",
  },
  {
    question: "How do I charge parents automatically?",
    answer:
      "Use Payments (Academy plan) to create Stripe checkout links and parent subscriptions. Parents complete payment once; renewals are handled by Stripe.",
  },
  {
    question: "How do I create camps?",
    answer:
      "Open Camps under Coaching Operations, fill in dates, capacity, pricing, and location, then publish. Enrolments and waitlists track from the camp dashboard.",
  },
  {
    question: "How do I install the mobile app?",
    answer:
      "Open CoachFlow on your phone, then use the install prompt or Add to Home Screen in Safari or Chrome for a native-style mobile experience.",
  },
  {
    question: "How do I upgrade my plan?",
    answer:
      "Visit Billing in the sidebar or open Pricing from the marketing site. Choose Starter, Pro, or Academy and complete checkout through Stripe.",
  },
] as const;
