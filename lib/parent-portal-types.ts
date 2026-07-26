import type { PlayerAttendanceStatus } from "@/lib/attendance";
import type { TeamSummary } from "@/lib/team-management";

export type ParentPortalPlayerRow = {
  id: string;
  coach_id: string;
  player_name: string;
  parent_name: string | null;
  parent_email: string | null;
  parent_phone: string | null;
  primary_position: string | null;
  team_players?: { team?: TeamSummary[] | TeamSummary | null }[] | null;
};

export type ParentCoachContact = {
  coachId: string;
  displayName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  bookingSlug: string | null;
};

export type ParentUpcomingSession = {
  id: string;
  playerId: string;
  playerName: string;
  sessionId: string;
  sessionDate: string;
  durationMinutes: number;
  location: string | null;
  sessionTitle: string;
  bookingStatus: string;
  bookingStatusLabel: string;
  paymentStatusLabel: string;
};

export type ParentAttendanceEntry = {
  sessionId: string;
  sessionDate: string;
  sessionName: string;
  status: PlayerAttendanceStatus;
  statusLabel: string;
  playerId: string;
  playerName: string;
};

export type ParentChildCard = {
  playerId: string;
  playerName: string;
  primaryPosition: string | null;
  teamLabel: string;
  attendanceRate: number;
  lastReportDate: string | null;
  coachId: string;
};

export type ParentReportItem = {
  id: string;
  playerId: string;
  playerName: string;
  created_at: string;
  report: string;
};

export type ParentCampItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  location: string | null;
  playerId: string | null;
  playerName: string | null;
  status: "booked" | "waitlist" | "available";
  statusLabel: string;
};

export type ParentSubscriptionItem = {
  id: string;
  playerId: string;
  playerName: string;
  interval: "weekly" | "monthly" | null;
  intervalLabel: string;
  status: string;
  statusLabel: string;
  amount: number;
  currency: string;
  currentPeriodEnd: string | null;
  stripeCustomerId: string;
  isWeeklyActive: boolean;
};

export type ParentPaymentItem = {
  id: string;
  playerName: string;
  amount: number;
  currency: string;
  statusLabel: string;
  created_at: string;
  description: string;
};

export type ParentFamilyDashboard = {
  welcomeName: string;
  summary: {
    upcomingSessions: number;
    attendancePercent: number;
    reportsAvailable: number;
    activeWeeklyPackages: number;
    upcomingCamps: number;
  };
  awaitingActions: Array<{
    id: string;
    label: string;
    href: string;
    tone: "info" | "action";
  }>;
  children: ParentChildCard[];
  upcomingSessions: ParentUpcomingSession[];
  attendanceHistory: ParentAttendanceEntry[];
  reports: ParentReportItem[];
  camps: ParentCampItem[];
  subscriptions: ParentSubscriptionItem[];
  recentPayments: ParentPaymentItem[];
  coachContacts: ParentCoachContact[];
};
