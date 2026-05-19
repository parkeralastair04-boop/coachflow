import type { PlanId } from "@/lib/billing";
import { getPlanById } from "@/lib/billing";

export type FeatureInfoKey =
  | "players"
  | "sessions"
  | "registers"
  | "camps"
  | "reports"
  | "analytics"
  | "payments"
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
    title: "Player CRM",
    what: "Store every player profile with parent contacts, notes, and squad context in one searchable list.",
    why: "You stop chasing spreadsheets and always know who to message before the next session.",
    usage: "Add players at the start of term, keep parent emails current, and review profiles before sending reports.",
    includedIn: ["starter", "pro", "academy"],
  },
  sessions: {
    title: "Sessions",
    what: "Schedule coaching blocks with dates, locations, capacity, and session types your parents can book into.",
    why: "A clear calendar keeps coaches aligned and gives parents confidence about when and where training happens.",
    usage: "Create sessions weekly, duplicate recurring blocks, and archive past dates once registers are complete.",
    includedIn: ["starter", "pro", "academy"],
  },
  registers: {
    title: "Group Registers",
    what: "Mark attendance on mobile, work offline on the pitch, and sync marks when connectivity returns.",
    why: "Fast roll calls reduce admin after training and feed accurate attendance into player history.",
    usage: "Open the register before each session, tap present/absent, and sync before leaving the venue if you were offline.",
    includedIn: ["pro", "academy"],
  },
  camps: {
    title: "Camps",
    what: "Publish holiday camps and clinics with pricing, capacity, waitlists, and enrolment tracking.",
    why: "Structured camp pages convert interest into paid places without manual email back-and-forth.",
    usage: "Create camps 4–6 weeks ahead, share the booking link, and monitor fill rate from the camp dashboard.",
    includedIn: ["academy"],
  },
  reports: {
    title: "AI Progress Reports",
    what: "Turn session notes into polished, parent-ready summaries you can edit, save, and email as PDFs.",
    why: "Parents see professional communication and you spend minutes—not hours—on end-of-term write-ups.",
    usage: "Paste bullet notes after training, generate a draft, tweak tone, then send to the parent email on file.",
    includedIn: ["pro", "academy"],
  },
  analytics: {
    title: "Analytics",
    what: "Dashboards for player growth, session delivery, revenue, reports sent, and subscription health.",
    why: "Spot trends early—quiet squads, rising churn, or camp gaps—before they hit cashflow.",
    usage: "Review weekly during admin time; use charts before planning terms, pricing, or marketing pushes.",
    includedIn: ["pro", "academy"],
  },
  payments: {
    title: "Parent Payments",
    what: "Create Stripe customers, assign recurring parent subscriptions to players, and share checkout links.",
    why: "Automated billing replaces chasing bank transfers and keeps renewals predictable.",
    usage: "Set up customers once per family, attach plans to players, and monitor failed payments from this hub.",
    includedIn: ["academy"],
  },
  automations: {
    title: "CRM Automations",
    what: "Trigger branded parent emails for bookings, reminders, and follow-ups through Resend.",
    why: "Consistent communication runs in the background while you stay on the pitch.",
    usage: "Enable templates you need, run a test batch after setup, then let automations fire on real events.",
    includedIn: ["pro", "academy"],
  },
  notifications: {
    title: "Push Notifications",
    what: "Control which mobile alerts you receive—bookings, payments, reports, and operational updates.",
    why: "Stay informed on the go without noise from channels you do not use.",
    usage: "Install the CoachFlow app, register your device here, then toggle only the alerts that matter to you.",
    includedIn: ["starter", "pro", "academy"],
  },
  referrals: {
    title: "Referrals",
    what: "Share your personal invite link and track coaches who join CoachFlow through your recommendation.",
    why: "Grow your network and reward introductions that help other academies modernise their operations.",
    usage: "Copy your link into coach WhatsApp groups or emails after a positive conversation about CoachFlow.",
    includedIn: ["starter", "pro", "academy"],
  },
  academy: {
    title: "Academy Settings",
    what: "White-label branding, custom domains, support contacts, and multi-coach academy membership.",
    why: "Parents see your brand—not generic software—and larger teams share one configured workspace.",
    usage: "Upload your logo and colours first, set your public domain, then invite coaches who need shared access.",
    includedIn: ["academy"],
  },
  insights: {
    title: "AI Business Insights",
    what: "AI-generated priorities from your live data—retention risks, revenue opportunities, and follow-up actions.",
    why: "You get a coach-friendly briefing instead of digging through multiple dashboards manually.",
    usage: "Refresh after major term milestones or when planning camps, pricing, or squad changes.",
    includedIn: ["academy"],
  },
  "booking-portal": {
    title: "Public Booking Portal",
    what: "A branded page where parents book 1-to-1s, group sessions, or camps and submit child details.",
    why: "Self-serve booking cuts admin DMs and captures structured data for your CRM automatically.",
    usage: "Link from your website bio and WhatsApp; confirm new requests from the dashboard within 24 hours.",
    includedIn: ["starter", "pro", "academy"],
  },
  "help-support": {
    title: "Help & Support",
    what: "Contact options, documentation links, FAQs, and quick ways to report bugs or request features.",
    why: "Answers and support channels stay in one place inside the product you already use daily.",
    usage: "Check FAQs first, then email or WhatsApp support with screenshots if something looks wrong.",
    includedIn: ["starter", "pro", "academy"],
  },
};

export function getPlanDisplayName(planId: PlanId): string {
  return getPlanById(planId)?.name ?? planId;
}
