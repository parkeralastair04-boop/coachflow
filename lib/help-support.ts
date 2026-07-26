import { BRAND } from "@/lib/brand-identity";

export const SUPPORT_EMAIL = BRAND.supportEmail;

/** E.164 without + for wa.me links */
export const SUPPORT_WHATSAPP_E164 = "447818968712";

export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_E164}`;

export const FEATURE_OVERVIEW_URL = BRAND.featuresUrl;

export const BUG_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type BugPriority = (typeof BUG_PRIORITIES)[number];

export const BUG_PAGE_FEATURES = [
  "Players",
  "Teams",
  "Sessions",
  "Registers",
  "Attendance",
  "Bookings",
  "Payments",
  "Reports",
  "Analytics",
  "Referrals",
  "Automations",
  "Availability",
  "Camps",
  "Billing",
  "Account & Settings",
  "Other",
] as const;
export type BugPageFeature = (typeof BUG_PAGE_FEATURES)[number];

export function supportMailto(subject: string, body?: string): string {
  const params = new URLSearchParams({ subject });
  if (body) params.set("body", body);
  return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
}

export const QUICK_START_STEPS = [
  {
    step: 1,
    title: "Name your academy",
    description:
      "Complete the match-ready wizard or open your checklist to set your academy name and club branding.",
  },
  {
    step: 2,
    title: "Add players later (optional)",
    description:
      "You can take bookings without a full squad. Add players when you’re ready for registers and development reports.",
  },
  {
    step: 3,
    title: "Schedule sessions",
    description:
      "Create sessions from Sessions or set weekly Availability templates for recurring blocks.",
  },
  {
    step: 4,
    title: "Share your booking link",
    description:
      "Copy your public booking URL from the dashboard checklist or Availability page so parents can book online.",
  },
  {
    step: 5,
    title: "Send your first report",
    description:
      "After your first sessions, paste notes in Reports to generate a parent-ready summary.",
  },
] as const;

export type UserGuideArticle = {
  id: string;
  title: string;
  summary: string;
  href: string;
  steps: readonly string[];
};

export const USER_GUIDE_ARTICLES: readonly UserGuideArticle[] = [
  {
    id: "players",
    title: "Players",
    summary: "Active Squad profiles, parent contacts, and football attributes.",
    href: "/dashboard/players",
    steps: [
      "Open Players under Coaching Operations in the sidebar.",
      "Use the add-player form with at least a player name — parent email and phone are optional but recommended.",
      "Add date of birth, preferred foot, and positions for squad planning and reports.",
      "Search and filter your list as your academy grows; every player is scoped to your coach account.",
    ],
  },
  {
    id: "teams",
    title: "Teams",
    summary: "Organise squads with age groups, colours, and rosters.",
    href: "/dashboard/teams",
    steps: [
      "Go to Teams and create a squad with a team name and optional age group.",
      "Assign players to the team roster — useful for group registers and team-linked sessions.",
      "Use team colours to distinguish squads in registers and on the dashboard.",
      "Edit or archive teams as your programme structure changes across seasons.",
    ],
  },
  {
    id: "sessions",
    title: "Sessions",
    summary: "Schedule coaching blocks with pricing, capacity, and visibility.",
    href: "/dashboard/sessions",
    steps: [
      "Open Sessions and choose date, time, session type, duration, and capacity.",
      "Link a team or individual players when scheduling group or 1-to-1 blocks.",
      "Set a price in pounds and toggle public visibility to allow parent bookings.",
      "Record attendance status and notes from the session list as sessions are delivered.",
    ],
  },
  {
    id: "registers",
    title: "Registers",
    summary: "Run session registers with bulk attendance actions.",
    href: "/dashboard/registers",
    steps: [
      "Open Registers to see upcoming sessions with linked players and teams.",
      "Mark each player as attended, missed, or excused with optional per-player notes.",
      "Use bulk actions to mark an entire squad present or absent quickly.",
      "Registers work offline — changes sync when your connection returns.",
    ],
  },
  {
    id: "attendance",
    title: "Attendance",
    summary: "Per-player attendance across sessions and squads.",
    href: "/dashboard/registers",
    steps: [
      "Attendance is recorded at the player level inside Registers, not just per session.",
      "Each mark updates the player's attendance history for analytics and parent reports.",
      "Manual overrides are preserved when rosters are pre-filled from team assignments.",
      "Review attendance trends from Analytics on Pro and Academy plans.",
    ],
  },
  {
    id: "bookings",
    title: "Bookings",
    summary: "Accept public session bookings and recurring subscriptions.",
    href: "/dashboard/availability",
    steps: [
      "Set weekly Availability templates with public visibility to power your booking portal.",
      "Share your coach or academy booking URL — parents book without emailing you.",
      "Confirm new booking requests from the dashboard and manage recurring child subscriptions.",
      "Upfront payment is the default flow for public session bookings.",
    ],
  },
  {
    id: "payments",
    title: "Payments",
    summary: "Collect fees from parents with Stripe checkout and subscriptions.",
    href: "/dashboard/payments",
    steps: [
      "Open Payments (Pro and Academy) to create Stripe customers and checkout links per player.",
      "Send parents a secure payment link for one-off fees or recurring coaching subscriptions.",
      "Review subscription status, renewals, and failed payments from Parent Payments.",
      "Stripe handles card storage and renewals — Awarix stores subscription metadata only.",
    ],
  },
  {
    id: "reports",
    title: "Reports",
    summary: "Generate AI progress reports from your session notes.",
    href: "/dashboard/reports",
    steps: [
      "Select a player in Reports and paste raw session notes from your coaching block.",
      "Click generate to draft a structured, parent-ready progress summary.",
      "Edit the draft before saving; saved reports appear in the player's history.",
      "Email reports directly to parents on Pro and Academy plans.",
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    summary: "Monitor attendance, revenue, and academy growth metrics.",
    href: "/dashboard/analytics",
    steps: [
      "Open Analytics (Pro and Academy) for attendance percentages and trends by player or team.",
      "Review booking conversion, session volume, and subscription revenue snapshots.",
      "Use insights to identify squads with dropping attendance or payment issues.",
      "Export key figures for committee meetings or franchise reporting.",
    ],
  },
  {
    id: "referrals",
    title: "Referrals",
    summary: "Grow your academy with a personal referral link.",
    href: "/dashboard/referrals",
    steps: [
      "Open Referrals to copy your unique invite link or send email invites.",
      "When a referred coach signs up and converts to a paid plan, rewards are tracked automatically.",
      "Share your link with coaching networks, partner clubs, or parent communities.",
      "Referral status updates appear in your referrals dashboard.",
    ],
  },
  {
    id: "automations",
    title: "Automations",
    summary: "Send reminders and follow-ups automatically.",
    href: "/dashboard/automations",
    steps: [
      "Open Automations (Pro and Academy) to configure email triggers for key events.",
      "Set up session reminders, payment due notices, and welcome messages for new players.",
      "Use template variables like parent name, player name, and session date in message bodies.",
      "Run automations manually or on a schedule from the automations dashboard.",
    ],
  },
] as const;

export function getBugPriorityLabel(priority: BugPriority): string {
  switch (priority) {
    case "low":
      return "Low";
    case "medium":
      return "Medium";
    case "high":
      return "High";
    case "critical":
      return "Critical";
  }
}
