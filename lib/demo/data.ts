/**
 * Static Riverside United demo academy — believable UK grassroots football.
 * Never written to Supabase; served only when the demo slug is requested.
 */

import type {
  PublicAcademy,
  PublicAcademyContext,
  PublicCamp,
  PublicCoach,
  PublicFixture,
  PublicNewsArticle,
  PublicResult,
  PublicTeam,
} from "@/lib/academy-website-types";
import type {
  PublicRecurringSeriesRow,
  PublicSessionRow,
} from "@/lib/booking-system";
import type { PublicPortal } from "@/lib/public-booking";
import {
  DEMO_ACADEMY_ID,
  DEMO_ACADEMY_SLUG,
  DEMO_COACH_ID,
  DEMO_COACH_SLUG,
  DEMO_SUPPORT_EMAIL,
} from "@/lib/demo/constants";

function daysFromNow(days: number, hour = 10, minute = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function dateOnly(days: number): string {
  return daysFromNow(days).slice(0, 10);
}

export const DEMO_ACADEMY: PublicAcademy = {
  id: DEMO_ACADEMY_ID,
  slug: DEMO_ACADEMY_SLUG,
  name: "Riverside United Academy",
  logoUrl: null,
  primaryColor: "#0f766e",
  secondaryColor: "#134e4a",
  supportEmail: DEMO_SUPPORT_EMAIL,
  supportPhone: "0117 555 0142",
  bookingEnabled: true,
  description:
    "Riverside United develops players aged 7–16 across Bristol with small-group coaching, matchday pathways, and clear parent communication. We focus on decision-making, confidence on the ball, and enjoying the game.",
  address: "Riverside Sports Ground, Ashton Gate Lane, Bristol BS3 2EJ",
};

export function getDemoAcademyContext(): PublicAcademyContext {
  return { slug: DEMO_ACADEMY_SLUG, academy: DEMO_ACADEMY };
}

export function getDemoPublicPortal(): PublicPortal {
  return {
    portal_kind: "academy",
    coach_id: DEMO_COACH_ID,
    academy_id: DEMO_ACADEMY_ID,
    coach_slug: DEMO_COACH_SLUG,
    academy_slug: DEMO_ACADEMY_SLUG,
    display_name: DEMO_ACADEMY.name,
    logo_url: null,
    primary_color: DEMO_ACADEMY.primaryColor,
    secondary_color: DEMO_ACADEMY.secondaryColor,
    support_email: DEMO_SUPPORT_EMAIL,
    support_phone: DEMO_ACADEMY.supportPhone,
    booking_enabled: true,
  };
}

export const DEMO_COACHES: PublicCoach[] = [
  {
    id: DEMO_COACH_SLUG,
    displayName: "James Okonkwo",
    logoUrl: null,
    bookingEnabled: true,
    profileSlug: DEMO_COACH_SLUG,
    role: "Head of Academy · UEFA B",
    biography:
      "Former academy midfielder who has coached grassroots for twelve seasons. James leads U11–U14 technical sessions and mentors parent coaches on matchday.",
  },
  {
    id: "sarah-bennett",
    displayName: "Sarah Bennett",
    logoUrl: null,
    bookingEnabled: true,
    profileSlug: "sarah-bennett",
    role: "Youth Development Lead · FA Level 2",
    biography:
      "Sarah specialises in U7–U10 foundations — first touch, scanning, and confident 1v1 play. She also runs the holiday multi-sport camps.",
  },
  {
    id: "marcus-reid",
    displayName: "Marcus Reid",
    logoUrl: null,
    bookingEnabled: false,
    profileSlug: "marcus-reid",
    role: "Goalkeeping Coach",
    biography:
      "Marcus delivers dedicated GK units twice weekly and supports matchday keepers across the U12 and U14 squads.",
  },
];

export const DEMO_TEAMS: PublicTeam[] = [
  {
    id: "demo-team-u9",
    name: "Riverside U9 Blues",
    ageGroup: "U9",
    colour: "#0ea5e9",
    displayName: "Riverside U9 Blues",
    summary: "Foundation phase — fun, skills, and small-sided games every Saturday.",
  },
  {
    id: "demo-team-u11",
    name: "Riverside U11 Reds",
    ageGroup: "U11",
    colour: "#ef4444",
    displayName: "Riverside U11 Reds",
    summary: "Technical pathway with midweek training and Sunday fixtures.",
  },
  {
    id: "demo-team-u13",
    name: "Riverside U13 Development",
    ageGroup: "U13",
    colour: "#10b981",
    displayName: "Riverside U13 Development",
    summary: "Possession play, pressing triggers, and competitive county fixtures.",
  },
  {
    id: "demo-team-u16",
    name: "Riverside U16 Academy",
    ageGroup: "U16",
    colour: "#6366f1",
    displayName: "Riverside U16 Academy",
    summary: "Senior pathway group preparing players for college and open-age football.",
  },
];

export const DEMO_FIXTURES: PublicFixture[] = [
  {
    id: "demo-fx-1",
    teamId: "demo-team-u11",
    teamName: "Riverside U11 Reds",
    opposition: "Clifton Rangers U11",
    competitionType: "league",
    competitionName: "Bristol Youth League",
    venue: "Riverside Sports Ground — Pitch 2",
    isHome: true,
    kickoffDate: dateOnly(5),
    kickoffTime: "10:30",
    pitch: "Pitch 2",
    status: "scheduled",
    title: "Riverside U11 Reds vs Clifton Rangers U11",
  },
  {
    id: "demo-fx-2",
    teamId: "demo-team-u13",
    teamName: "Riverside U13 Development",
    opposition: "Southmead Athletic U13",
    competitionType: "cup",
    competitionName: "County Cup Round of 16",
    venue: "Southmead Community Hub",
    isHome: false,
    kickoffDate: dateOnly(12),
    kickoffTime: "11:00",
    pitch: null,
    status: "scheduled",
    title: "Southmead Athletic U13 vs Riverside U13 Development",
  },
  {
    id: "demo-fx-3",
    teamId: "demo-team-u9",
    teamName: "Riverside U9 Blues",
    opposition: "Harbour City U9",
    competitionType: "friendly",
    competitionName: null,
    venue: "Riverside Sports Ground — 5-a-side cages",
    isHome: true,
    kickoffDate: dateOnly(3),
    kickoffTime: "09:15",
    pitch: "Cage A",
    status: "scheduled",
    title: "Riverside U9 Blues vs Harbour City U9",
  },
];

export const DEMO_RESULTS: PublicResult[] = [
  {
    id: "demo-res-1",
    teamId: "demo-team-u13",
    teamName: "Riverside U13 Development",
    opposition: "Bedminster Town U13",
    competitionType: "league",
    competitionName: "Bristol Youth League",
    venue: "Riverside Sports Ground",
    isHome: true,
    kickoffDate: dateOnly(-7),
    kickoffTime: "11:00",
    status: "completed",
    title: "Riverside U13 Development 3–1 Bedminster Town U13",
    homeScore: 3,
    awayScore: 1,
    scoreLabel: "3–1",
  },
  {
    id: "demo-res-2",
    teamId: "demo-team-u11",
    teamName: "Riverside U11 Reds",
    opposition: "Kingswood Rovers U11",
    competitionType: "league",
    competitionName: "Bristol Youth League",
    venue: "Kingswood Playing Fields",
    isHome: false,
    kickoffDate: dateOnly(-14),
    kickoffTime: "10:00",
    status: "completed",
    title: "Kingswood Rovers U11 2–2 Riverside U11 Reds",
    homeScore: 2,
    awayScore: 2,
    scoreLabel: "2–2",
  },
  {
    id: "demo-res-3",
    teamId: "demo-team-u16",
    teamName: "Riverside U16 Academy",
    opposition: "Filton College Development",
    competitionType: "friendly",
    competitionName: null,
    venue: "Riverside Sports Ground",
    isHome: true,
    kickoffDate: dateOnly(-21),
    kickoffTime: "14:00",
    status: "completed",
    title: "Riverside U16 Academy 1–0 Filton College Development",
    homeScore: 1,
    awayScore: 0,
    scoreLabel: "1–0",
  },
];

export const DEMO_CAMPS: PublicCamp[] = [
  {
    id: "demo-camp-easter",
    name: "Easter Skills Week",
    description:
      "Four half-days of technical stations, small-sided games, and a Friday showcase for parents. Includes a Riverside training top.",
    startDate: dateOnly(18),
    endDate: dateOnly(21),
    startTime: "09:30",
    endTime: "12:30",
    ageGroup: "U8–U12",
    price: 95,
    location: "Riverside Sports Ground",
    dateLabel: `${dateOnly(18)} – ${dateOnly(21)}`,
    remainingSpaces: 8,
    summary: "Half-day technical camp with Friday parent showcase and kit included.",
  },
  {
    id: "demo-camp-gk",
    name: "Keeper Clinic Weekend",
    description:
      "Saturday and Sunday intensive for shot-stopping, distribution, and communication. Led by Marcus Reid.",
    startDate: dateOnly(26),
    endDate: dateOnly(27),
    startTime: "10:00",
    endTime: "14:00",
    ageGroup: "U11–U16",
    price: 70,
    location: "Indoor dome · Ashton Gate",
    dateLabel: `${dateOnly(26)} – ${dateOnly(27)}`,
    remainingSpaces: 4,
    summary: "Weekend goalkeeping clinic covering shot-stopping and distribution.",
  },
];

export const DEMO_NEWS: PublicNewsArticle[] = [
  {
    id: "demo-news-1",
    slug: "u13-county-cup-run",
    title: "U13s book County Cup last-16 place",
    summary:
      "A composed 3–1 win over Bedminster Town sends Riverside into the County Cup round of 16 for the first time since 2022.",
    content: `Our U13 Development side produced their best performance of the season to beat Bedminster Town 3–1 at home.

Amira Cole opened the scoring from a cut-back on 18 minutes, before Leo Hart doubled the lead with a driven finish from the edge of the box. Bedminster pulled one back after the break, but substitute Noah Patel settled nerves with a late third.

Head coach James Okonkwo said: "The boys stayed patient when the game got scrappy. That maturity is exactly what we are building toward."

Next up is an away tie at Southmead Athletic. Parents can follow fixtures on the academy website and manage availability from the family portal.`,
    coverImageUrl: null,
    publishedAt: daysFromNow(-6, 18, 0),
  },
  {
    id: "demo-news-2",
    slug: "easter-skills-week-open",
    title: "Easter Skills Week bookings now open",
    summary:
      "Places are limited for our popular Easter half-day camp. Early booking recommended for U8–U12 players.",
    content: `Easter Skills Week returns with four mornings of technical stations, finishing practices, and small-sided matches.

Every player receives a Riverside training top and a short written reflection from their coach on the final day. The Friday showcase runs from 11:30–12:30 — parents are welcome pitch-side.

Book through the camps page or ask your coach to hold a place. Sibling discount available when two children enrol together.`,
    coverImageUrl: null,
    publishedAt: daysFromNow(-12, 9, 30),
  },
  {
    id: "demo-news-3",
    slug: "parent-evening-march",
    title: "March parent evening: pathway updates",
    summary:
      "Thank you to everyone who joined our pathway briefing. Slides and FAQs are now shared in the family portal.",
    content: `We covered how players move between foundation and development phases, what matchday availability means for selection, and how progress reports are shared.

If you missed the evening, open Manage family → Documents for the summary pack. Questions can still be sent to hello@riversideunited.demo — this demo address does not deliver mail.`,
    coverImageUrl: null,
    publishedAt: daysFromNow(-20, 16, 0),
  },
];

export function getDemoSessions(): PublicSessionRow[] {
  return [
    {
      session_id: "demo-session-1",
      coach_id: DEMO_COACH_ID,
      academy_id: DEMO_ACADEMY_ID,
      coach_slug: DEMO_COACH_SLUG,
      academy_slug: DEMO_ACADEMY_SLUG,
      group_name: "U11 Technical — Tuesday",
      session_type: "Group Session",
      session_date: daysFromNow(2, 17, 0),
      duration_minutes: 75,
      location: "Riverside Sports Ground · Pitch 1",
      notes: "Bring boots and a water bottle. Bibs provided.",
      price: 18,
      capacity: 12,
      remaining_spaces: 3,
      waitlist_count: 2,
      is_full: false,
    },
    {
      session_id: "demo-session-2",
      coach_id: DEMO_COACH_ID,
      academy_id: DEMO_ACADEMY_ID,
      coach_slug: DEMO_COACH_SLUG,
      academy_slug: DEMO_ACADEMY_SLUG,
      group_name: "1:1 Finishing — James",
      session_type: "1-to-1",
      session_date: daysFromNow(4, 16, 30),
      duration_minutes: 45,
      location: "Indoor dome",
      notes: "Focus: first-time finishing and cut-backs.",
      price: 40,
      capacity: 1,
      remaining_spaces: 1,
      waitlist_count: 0,
      is_full: false,
    },
    {
      session_id: "demo-session-3",
      coach_id: DEMO_COACH_ID,
      academy_id: DEMO_ACADEMY_ID,
      coach_slug: DEMO_COACH_SLUG,
      academy_slug: DEMO_ACADEMY_SLUG,
      group_name: "U9 Foundations — Saturday",
      session_type: "Group Session",
      session_date: daysFromNow(6, 9, 0),
      duration_minutes: 60,
      location: "5-a-side cages",
      notes: null,
      price: 14,
      capacity: 10,
      remaining_spaces: 0,
      waitlist_count: 4,
      is_full: true,
    },
    {
      session_id: "demo-session-past",
      coach_id: DEMO_COACH_ID,
      academy_id: DEMO_ACADEMY_ID,
      coach_slug: DEMO_COACH_SLUG,
      academy_slug: DEMO_ACADEMY_SLUG,
      group_name: "U13 Possession Block",
      session_type: "Group Session",
      session_date: daysFromNow(-3, 18, 0),
      duration_minutes: 90,
      location: "Riverside Sports Ground · Pitch 2",
      notes: "Completed session — shown for demo history.",
      price: 18,
      capacity: 14,
      remaining_spaces: 0,
      waitlist_count: 0,
      is_full: true,
    },
  ];
}

export function getDemoRecurringSeries(): PublicRecurringSeriesRow[] {
  return [
    {
      recurring_series_id: "demo-series-1",
      coach_id: DEMO_COACH_ID,
      academy_id: DEMO_ACADEMY_ID,
      coach_slug: DEMO_COACH_SLUG,
      academy_slug: DEMO_ACADEMY_SLUG,
      title: "U11 Weekly Membership",
      session_type: "Group Session",
      day_of_week: 2,
      start_time: "17:00",
      duration_minutes: 75,
      location: "Riverside Sports Ground",
      notes: "Includes midweek training and Sunday matchday support.",
      capacity: 14,
      monthly_price: 68,
      currency: "gbp",
      active_subscriptions: 11,
      remaining_spaces: 3,
    },
    {
      recurring_series_id: "demo-series-2",
      coach_id: DEMO_COACH_ID,
      academy_id: DEMO_ACADEMY_ID,
      coach_slug: DEMO_COACH_SLUG,
      academy_slug: DEMO_ACADEMY_SLUG,
      title: "U9 Saturday Club",
      session_type: "Group Session",
      day_of_week: 6,
      start_time: "09:00",
      duration_minutes: 60,
      location: "5-a-side cages",
      notes: null,
      capacity: 12,
      monthly_price: 48,
      currency: "gbp",
      active_subscriptions: 12,
      remaining_spaces: 0,
    },
  ];
}

/** Coach-dashboard sample datasets (not public). */
export const DEMO_PLAYERS = [
  {
    id: "demo-player-1",
    name: "Amira Cole",
    age: 12,
    team: "U13 Development",
    attendanceRate: 94,
    progressNote: "Excellent scanning; leading presses without overcommitting.",
    parentName: "Priya Cole",
    parentStatus: "active" as const,
  },
  {
    id: "demo-player-2",
    name: "Leo Hart",
    age: 11,
    team: "U11 Reds",
    attendanceRate: 81,
    progressNote: "Strong finishing week; still working on weaker-foot receiving.",
    parentName: "Tom Hart",
    parentStatus: "active" as const,
  },
  {
    id: "demo-player-3",
    name: "Noah Patel",
    age: 13,
    team: "U13 Development",
    attendanceRate: 72,
    progressNote: "Confidence growing after substitute impact vs Bedminster.",
    parentName: "Anisha Patel",
    parentStatus: "returning" as const,
  },
  {
    id: "demo-player-4",
    name: "Mia Brooks",
    age: 8,
    team: "U9 Blues",
    attendanceRate: 100,
    progressNote: "Loves 1v1s; encourage her to use both feet in tight spaces.",
    parentName: "Helen Brooks",
    parentStatus: "active" as const,
  },
  {
    id: "demo-player-5",
    name: "Kai Mensah",
    age: 15,
    team: "U16 Academy",
    attendanceRate: 88,
    progressNote: "Leadership on and off the pitch — natural organiser.",
    parentName: "Daniel Mensah",
    parentStatus: "active" as const,
  },
  {
    id: "demo-player-6",
    name: "Ellie Fraser",
    age: 10,
    team: "U11 Reds",
    attendanceRate: 65,
    progressNote: "Missed two sessions for school trip; reintegrate gently.",
    parentName: "Claire Fraser",
    parentStatus: "returning" as const,
  },
];

export const DEMO_REPORTS = [
  {
    id: "demo-report-1",
    playerName: "Amira Cole",
    focus: "Technical",
    summary:
      "Amira’s first touch under pressure improved markedly. She now opens her body earlier and plays forward passes with better weight.",
    sharedWithParent: true,
  },
  {
    id: "demo-report-2",
    playerName: "Leo Hart",
    focus: "Physical",
    summary:
      "Leo’s repeated sprint work showed in the second half. Encourage hydration reminders before intense blocks.",
    sharedWithParent: true,
  },
  {
    id: "demo-report-3",
    playerName: "Noah Patel",
    focus: "Behavioural",
    summary:
      "Noah stayed positive after being substituted early, then changed the game when reintroduced. Brilliant example for younger players.",
    sharedWithParent: false,
  },
];

export const DEMO_BOOKINGS = [
  {
    id: "demo-book-1",
    childName: "Mia Brooks",
    session: "U9 Foundations — Saturday",
    status: "confirmed" as const,
    when: "Upcoming",
  },
  {
    id: "demo-book-2",
    childName: "Leo Hart",
    session: "U11 Technical — Tuesday",
    status: "confirmed" as const,
    when: "Upcoming",
  },
  {
    id: "demo-book-3",
    childName: "Ellie Fraser",
    session: "U11 Technical — Tuesday",
    status: "waitlist" as const,
    when: "Upcoming",
  },
  {
    id: "demo-book-4",
    childName: "Kai Mensah",
    session: "1:1 Finishing — James",
    status: "cancelled" as const,
    when: "Cancelled by parent",
  },
  {
    id: "demo-book-5",
    childName: "Amira Cole",
    session: "U13 Possession Block",
    status: "confirmed" as const,
    when: "Completed",
  },
];

export const DEMO_ATTENDANCE = [
  { session: "U13 Possession Block", present: 12, late: 1, absent: 1 },
  { session: "U11 Technical — last week", present: 9, late: 2, absent: 1 },
  { session: "U9 Foundations — last week", present: 10, late: 0, absent: 0 },
];

export const DEMO_ANALYTICS = {
  label: "Sample data — Riverside United demo",
  bookingsThisMonth: 47,
  bookingsTrend: "+12% vs last month",
  attendanceRate: 86,
  attendanceTrend: "+3 pts",
  parentEngagement: 74,
  parentEngagementHelper: "% of parents who opened a shared report or portal in 30 days",
  reportsShared: 19,
  reportsTrend: "8 new this month",
  growthPlayers: 64,
  growthHelper: "Active players across all age groups",
};

export const DEMO_FEATURE_DISCOVERY: Record<
  string,
  { what: string; why: string; tip: string }
> = {
  dashboard: {
    what: "Your home overview of players, sessions, bookings, and income.",
    why: "Coaches start here each morning to see what needs attention today.",
    tip: "Use the cards to jump into Players or Sessions without hunting the sidebar.",
  },
  players: {
    what: "Your Active Squad with parent contacts and notes.",
    why: "Accurate contacts power booking emails, reports, and the family portal.",
    tip: "Filter by team before matchday to review who is available.",
  },
  sessions: {
    what: "Publish bookable sessions and group blocks.",
    why: "Parents book from your public link instead of messaging for times.",
    tip: "Keep capacity realistic — waitlists convert when someone cancels.",
  },
  reports: {
    what: "Progress notes parents can actually understand.",
    why: "Shared reports build trust and reduce “how is my child doing?” messages.",
    tip: "Mark reports parent-visible only when you are ready to share.",
  },
  bookings: {
    what: "Confirmed, waitlisted, and cancelled places in one list.",
    why: "You see fill rate before you arrive at the pitch.",
    tip: "Follow up waitlists mid-week when spaces open.",
  },
  website: {
    what: "Your public academy site — branding, news, camps, and booking.",
    why: "Prospective families judge professionalism before they message you.",
    tip: "Keep news current; one update a fortnight is enough.",
  },
  family: {
    what: "What parents see after they claim their account.",
    why: "Self-serve sessions and reports cut admin for both sides.",
    tip: "Invite parents from booking confirmation emails.",
  },
  billing: {
    what: "Plan limits and how Awarix billing works with Stripe.",
    why: "Higher plans open camps, automations, and academy tools.",
    tip: "Demo billing never charges a real card.",
  },
  analytics: {
    what: "Attendance, bookings, and engagement trends.",
    why: "Spot drop-off early — before families quietly leave.",
    tip: "Figures here are sample metrics for the Riverside demo.",
  },
};
