import type { PlanId } from "@/lib/billing";
import { getPlanById } from "@/lib/billing";

export type FeatureInfoKey =
  | "players"
  | "teams"
  | "sessions"
  | "registers"
  | "camps"
  | "matches"
  | "training"
  | "video"
  | "news"
  | "enquiries"
  | "reports"
  | "analytics"
  | "payments"
  | "finance"
  | "automations"
  | "notifications"
  | "referrals"
  | "academy"
  | "insights"
  | "booking-portal"
  | "help-support";

export type FeatureInfoEntry = {
  title: string;
  what: string;
  why: string;
  usage: string;
  /** When set, shows plan badges in the tooltip. */
  includedIn?: PlanId[];
};

export const FEATURE_INFO: Record<FeatureInfoKey, FeatureInfoEntry> = {
  players: {
    title: "Active Squad",
    what: "Every player profile with parent contacts, notes, and squad context — searchable before you walk onto the pitch.",
    why: "You stop chasing spreadsheets and always know who to message before the next session.",
    usage: "Add players at the start of term, keep parent emails current, and review profiles before sending reports.",
    includedIn: ["starter", "pro", "academy"],
  },
  teams: {
    title: "Squads",
    what: "Create age-group squads, assign players, set captains, and organise rosters by position or matchday order.",
    why: "Shared squad structure keeps sessions, registers, and reporting aligned across the season.",
    usage: "Create each squad once, attach players with their roles, then use roster views before planning sessions or reports.",
    includedIn: ["starter", "pro", "academy"],
  },
  sessions: {
    title: "Training Sessions",
    what: "Schedule 1:1s or group coaching blocks with dates, locations, optional group names, and assigned players.",
    why: "A clear training calendar keeps coaches aligned and makes parent booking straightforward.",
    usage: "Create group names for recurring squads, assign every player in the selector, then use the register to mark the whole session quickly.",
    includedIn: ["starter", "pro", "academy"],
  },
  registers: {
    title: "Session Registers",
    what: "Mark attendance player by player on mobile, use bulk actions for squads, and keep offline sync for pitch-side updates.",
    why: "Fast, accurate player-level attendance reduces admin after training and feeds reliable history into reports and insights.",
    usage: "Open the register before each session, tap each player's status, then use bulk actions where most of the squad shares the same outcome.",
    includedIn: ["pro", "academy"],
  },
  camps: {
    title: "Holiday Camps",
    what: "Publish holiday camps and clinics with pricing, capacity, waitlists, and enrolment tracking.",
    why: "Structured camp pages convert interest into paid places without manual email back-and-forth.",
    usage: "Create camps 4–6 weeks ahead, share the booking link, and monitor fill rate from the camp hub.",
    includedIn: ["academy"],
  },
  matches: {
    title: "Match Centre",
    what: "Create fixtures, select squads, track parent availability, mark matchday registers, record goals and cards, and generate AI match reports.",
    why: "Matchday admin stays in Awarix instead of scattered notes, texts, and spreadsheets.",
    usage: "Create each fixture, load the team squad, publish availability to parents, then use the linked register on matchday.",
    includedIn: ["pro", "academy"],
  },
  training: {
    title: "Training Planner",
    what: "Create reusable training plans, drill libraries, session timelines, pitch diagrams, reflections, and AI-generated session ideas.",
    why: "Better sessions with less prep time, while keeping development linked to attendance and reports.",
    usage: "Build a plan, link it to a scheduled session, then reflect after training to guide your next block.",
    includedIn: ["pro", "academy"],
  },
  video: {
    title: "Video Analysis",
    what: "Store match and training videos, create tagged clips, link them to players, and optionally share moments with parents.",
    why: "Clips make development feedback concrete and keep teaching moments connected to reports and timeline history.",
    usage: "Add a video URL, cut a clip with player and development tags, then share only the clips you want parents to see.",
    includedIn: ["pro", "academy"],
  },
  news: {
    title: "Club News",
    what: "Publish updates on your public academy website with a title, summary, and plain-text article body.",
    why: "Families stay informed about camps, fixtures, and club news without a separate CMS.",
    usage: "Draft a post, add an optional cover image URL, then publish when you are ready for it to appear on the website.",
    includedIn: ["academy"],
  },
  enquiries: {
    title: "Family Enquiries",
    what: "Collect questions from your public Contact page and review them in your academy hub.",
    why: "Families can ask about the academy without replacing your main booking flow.",
    usage: "Share your Contact page, reply from your support email, and mark messages as read as you work through them.",
    includedIn: ["academy"],
  },
  reports: {
    title: "AI Development Reports",
    what: "Turn session notes into polished, parent-ready summaries you can edit, save, and email as PDFs.",
    why: "Parents see professional communication and you spend minutes—not hours—on end-of-term write-ups.",
    usage: "Paste bullet notes after training, generate a draft, tweak tone, then send to the parent email on file.",
    includedIn: ["pro", "academy"],
  },
  analytics: {
    title: "Performance Insights",
    what: "Clarity on player growth, session delivery, group attendance, income, reports sent, and subscription health.",
    why: "Spot trends early—quiet squads, rising churn, or underperforming groups—before they hit cashflow.",
    usage: "Review weekly during admin time; compare attendance by player and by group before planning terms or coaching interventions.",
    includedIn: ["pro", "academy"],
  },
  payments: {
    title: "Parent Payments",
    what: "Create Stripe customers, assign recurring parent subscriptions to players, and share checkout links.",
    why: "Automated billing replaces chasing bank transfers and keeps renewals predictable.",
    usage: "Set up customers once per family, attach plans to players, and monitor failed payments from this hub.",
    includedIn: ["academy"],
  },
  finance: {
    title: "Finance Centre",
    what: "See academy income, expenses, coach payroll, invoices, budgets, and profit — without replacing Stripe.",
    why: "Owners can tell where money comes from, where it goes, and whether the academy is healthy.",
    usage: "Review the overview monthly, log expenses and coach wages as they happen, then export a PDF report for board or accountant reviews.",
    includedIn: ["academy"],
  },
  automations: {
    title: "Automatic Messages",
    what: "Trigger branded parent emails for bookings, reminders, and follow-ups through Resend.",
    why: "Consistent communication runs in the background while you stay on the pitch.",
    usage: "Enable templates you need, run a test batch after setup, then let automations fire on real events.",
    includedIn: ["pro", "academy"],
  },
  notifications: {
    title: "Pitch-Side Alerts",
    what: "Control which mobile alerts you receive—bookings, payments, reports, and matchday updates.",
    why: "Stay informed on the go without noise from channels you do not use.",
    usage: "Install the Awarix app, register your device here, then toggle only the alerts that matter to you.",
    includedIn: ["academy"],
  },
  referrals: {
    title: "Coach Referrals",
    what: "Share your personal invite link and see coaches who join Awarix through your recommendation.",
    why: "Help fellow coaches develop players with Awarix — and earn credit when they join.",
    usage: "Copy your link into coach WhatsApp groups or emails after a positive conversation about Awarix.",
    includedIn: ["pro", "academy"],
  },
  academy: {
    title: "Club Identity",
    what: "Crest, colours, custom domains, support contacts, and multi-coach academy membership.",
    why: "Parents see your club—not generic software—and larger teams share one academy identity.",
    usage: "Upload your logo and colours first, set your public domain, then invite coaches who need shared access.",
    includedIn: ["academy"],
  },
  insights: {
    title: "AI Coaching Insights",
    what: "AI-generated priorities from your live data—retention risks, development opportunities, and follow-up actions.",
    why: "You get a coach-friendly briefing instead of digging through multiple screens manually.",
    usage: "Refresh after major term milestones or when planning camps, pricing, or squad changes.",
    includedIn: ["academy"],
  },
  "booking-portal": {
    title: "Public Booking Page",
    what: "A branded page where parents book 1-to-1s, group sessions, or camps and submit child details.",
    why: "Self-serve booking cuts admin DMs and lands family details straight in your squad.",
    usage: "Link from your website bio and WhatsApp; confirm new requests from your hub within 24 hours.",
    includedIn: ["starter", "pro", "academy"],
  },
  "help-support": {
    title: "Help & Support",
    what: "Contact options, documentation links, FAQs, and quick ways to report bugs or request features.",
    why: "Answers and support channels stay inside the product you already use on the pitch.",
    usage: "Check FAQs first, then email or WhatsApp support with screenshots if something looks wrong.",
    includedIn: ["starter", "pro", "academy"],
  },
};

export function getPlanDisplayName(planId: PlanId): string {
  return getPlanById(planId)?.name ?? planId;
}
