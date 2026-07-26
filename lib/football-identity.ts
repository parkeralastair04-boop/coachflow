import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ClipboardPen,
  Cone,
  Flag,
  Goal,
  LandPlot,
  NotebookPen,
  Shirt,
  Trophy,
} from "lucide-react";

/** Decorative coaching scenes for EmptyState — premium line art, not cartoon. */
export type FootballEmptySceneId =
  | "squad"
  | "pitch"
  | "reports"
  | "teams"
  | "bookings"
  | "analytics"
  | "enquiries"
  | "camps"
  | "matches"
  | "welcome"
  | "payments"
  | "news"
  | "communication"
  | "finance"
  | "training"
  | "video"
  | "automations"
  | "registers"
  | "referrals"
  | "insights";

export type FootballEmptyPreset = {
  scene: FootballEmptySceneId;
  icon: LucideIcon;
  title: string;
  description: string;
};

/** User-facing module labels — football academy tone, not generic CRM. */
export const FOOTBALL_LABELS = {
  players: "Active Squad",
  sessions: "Training Sessions",
  reports: "Player Development",
  analytics: "Performance Insights",
  attendance: "Attendance Rate",
  bookings: "Parent Bookings",
  teams: "Squads",
  registers: "Session Registers",
  matches: "Match Centre",
  training: "Training Planner",
  video: "Video Analysis",
  finance: "Finance Centre",
  communication: "Parent Updates",
  dashboardOverview: "Academy Pulse",
} as const;

export const FOOTBALL_EMPTY_PRESETS = {
  players: {
    scene: "squad",
    icon: Shirt,
    title: "Build your squad",
    description:
      "Add your first player when you’re ready — optional for taking bookings. Squads, registers, and development reports use player profiles.",
  },
  sessions: {
    scene: "pitch",
    icon: LandPlot,
    title: "The pitch is waiting",
    description:
      "Schedule your first training session, open booking, and share your link so parents can confirm places online.",
  },
  reports: {
    scene: "reports",
    icon: ClipboardPen,
    title: "No development notes yet",
    description:
      "Generate a player development report after a session — turn coaching observations into parent-ready updates.",
  },
  reportsNoPlayer: {
    scene: "squad",
    icon: Shirt,
    title: "Add a player first",
    description:
      "Player development reports are tied to your squad. Add a player, then capture progress from the pitch.",
  },
  teams: {
    scene: "teams",
    icon: Flag,
    title: "No squads yet",
    description:
      "Group players into age-group squads for registers, team sessions, and match-day planning.",
  },
  bookings: {
    scene: "bookings",
    icon: Goal,
    title: "No parent bookings yet",
    description:
      "Share your booking page with families — confirmed places will show here once parents book online.",
  },
  analytics: {
    scene: "analytics",
    icon: Activity,
    title: "Intelligence builds after training",
    description:
      "Once sessions run and registers are marked, attendance, bookings, and income insights appear here.",
  },
  enquiries: {
    scene: "enquiries",
    icon: NotebookPen,
    title: "No enquiries yet",
    description:
      "When families contact your academy website, their messages land here for you to follow up.",
  },
  camps: {
    scene: "camps",
    icon: Flag,
    title: "No holiday camps yet",
    description:
      "Run school-holiday programmes as academy events — bookings, attendance, and development reports.",
  },
  matches: {
    scene: "matches",
    icon: Trophy,
    title: "No fixtures logged",
    description:
      "Record upcoming fixtures and match reports so your squad and parents stay match-ready.",
  },
  payments: {
    scene: "payments",
    icon: Goal,
    title: "No payment activity yet",
    description:
      "Parent payments and subscriptions appear here once families book paid sessions or weekly packages.",
  },
  news: {
    scene: "news",
    icon: Flag,
    title: "No academy news yet",
    description:
      "Publish updates for parents — fixtures, camps, and club news on your academy website.",
  },
  welcome: {
    scene: "welcome",
    icon: Cone,
    title: "Nothing to manage yet — that’s expected",
    description:
      "Finish the setup steps above so parents can book. Your dashboard will fill once the first booking lands.",
  },
  availability: {
    scene: "pitch",
    icon: LandPlot,
    title: "Set your training windows",
    description:
      "Define when you coach on the pitch — templates make publishing bookable sessions faster.",
  },
  communication: {
    scene: "enquiries",
    icon: NotebookPen,
    title: "No messages sent yet",
    description:
      "Send parent updates, session reminders, and academy announcements from the touchline.",
  },
  finance: {
    scene: "payments",
    icon: Goal,
    title: "Waiting for your first fees",
    description:
      "Income, expenses, and invoices appear here once bookings and academy payments flow through Awarix.",
  },
  training: {
    scene: "pitch",
    icon: Cone,
    title: "No training plans yet",
    description:
      "Build session plans, save favourite drills, and reflect after each session on the pitch.",
  },
  video: {
    scene: "analytics",
    icon: Activity,
    title: "No video clips yet",
    description:
      "Upload match and training footage, tag players, and share reviewed clips with parents.",
  },
  automations: {
    scene: "bookings",
    icon: Goal,
    title: "No automations yet",
    description:
      "Automate parent reminders, booking confirmations, and follow-ups so admin stays off the pitch.",
  },
  registers: {
    scene: "pitch",
    icon: LandPlot,
    title: "No registers marked yet",
    description:
      "Open a session register on matchday or after training to track attendance player by player.",
  },
  referrals: {
    scene: "welcome",
    icon: Cone,
    title: "No referrals yet",
    description:
      "Invite fellow coaches to Awarix — referral rewards appear here when they join.",
  },
  insights: {
    scene: "analytics",
    icon: Activity,
    title: "Insights after your next sessions",
    description:
      "AI coaching insights appear once you have sessions, registers, and player data in your academy.",
  },
} as const satisfies Record<string, FootballEmptyPreset>;

export type FootballEmptyPresetKey = keyof typeof FOOTBALL_EMPTY_PRESETS;

export function footballEmptyPreset(key: FootballEmptyPresetKey): FootballEmptyPreset {
  return FOOTBALL_EMPTY_PRESETS[key];
}
