import type { Metadata } from "next";
import { ClipboardCheck, LandPlot, Trophy, Users } from "lucide-react";
import { AttendanceAtRiskPanel } from "@/components/attendance-at-risk-panel";
import { AttendanceThisMonthCard } from "@/components/attendance-this-month-card";
import { CoachingIncomeSection } from "@/components/coaching-income-section";
import { DashboardHeroBand } from "@/components/dashboard/dashboard-hero-band";
import { DashboardSection } from "@/components/dashboard/dashboard-section";
import { DashboardHomeSections } from "@/components/dashboard-home-sections";
import { CoachFamilyHubPanel } from "@/components/coach-family-hub-panel";
import { FamiliesWaitingPanel } from "@/components/families-waiting-panel";
import { MatchDashboardWidgets } from "@/components/match-dashboard-widgets";
import { TrainingDashboardWidgets } from "@/components/training-dashboard-widgets";
import { FinanceDashboardWidgets } from "@/components/finance-dashboard-widgets";
import { VideoDashboardWidgets } from "@/components/video-dashboard-widgets";
import { FirstBookingCelebration } from "@/components/first-booking-celebration";
import { FirstRunDashboard } from "@/components/first-run-dashboard";
import { GettingStartedCard } from "@/components/getting-started-card";
import { MilestoneCelebrations } from "@/components/milestone-celebrations";
import { RevenueAtRiskPanel } from "@/components/revenue-at-risk-panel";
import { getAuthenticatedUser, getServerSupabase } from "@/lib/auth/server";
import { FOOTBALL_LABELS } from "@/lib/football-identity";
import { isFirstRunDashboard } from "@/lib/onboarding";
import { fetchOnboardingCounts } from "@/lib/onboarding-setup";

export const metadata: Metadata = {
  title: "Academy Dashboard",
};

export default async function DashboardPage() {
  let showFirstRun = false;
  const user = await getAuthenticatedUser();
  if (user) {
    try {
      const supabase = await getServerSupabase();
      const counts = await fetchOnboardingCounts(supabase, user.id);
      showFirstRun = isFirstRunDashboard({
        hasPlayer: counts.hasPlayer,
        hasSession: counts.hasSession,
        hasBooking: counts.hasBooking,
      });
    } catch {
      showFirstRun = false;
    }
  }

  if (showFirstRun) {
    return <FirstRunDashboard />;
  }

  return (
    <div className="space-y-8">
      <DashboardHeroBand />

      <div className="space-y-4 px-4 sm:px-6 lg:px-10">
        <MilestoneCelebrations />
        <FirstBookingCelebration />
        <GettingStartedCard />
      </div>

      <div className="grid gap-8 px-4 sm:px-6 lg:grid-cols-12 lg:gap-6 lg:px-10 xl:gap-8">
        <div className="space-y-8 lg:col-span-8">
          <DashboardSection
            id="pitch-week"
            title="On the pitch this week"
            description="Attendance and academy income at a glance."
            icon={LandPlot}
            variant="pitch"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <AttendanceThisMonthCard />
              <CoachingIncomeSection />
            </div>
          </DashboardSection>

          <DashboardSection
            id="match-training"
            title="Match day & training"
            description="Fixtures, session plans, video, and finance."
            icon={Trophy}
            variant="pitch"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <MatchDashboardWidgets />
              <TrainingDashboardWidgets />
              <VideoDashboardWidgets />
              <FinanceDashboardWidgets />
            </div>
          </DashboardSection>

          <DashboardSection
            id="operations"
            title="Club ops"
            description="Upcoming sessions, recent bookings, and quick actions."
            icon={LandPlot}
          >
            <DashboardHomeSections />
          </DashboardSection>
        </div>

        <aside className="space-y-8 lg:col-span-4">
          <DashboardSection
            id="families"
            title="Parents & payments"
            description="Parents connected, payments on track."
            icon={Users}
          >
            <div className="space-y-5">
              <RevenueAtRiskPanel />
              <FamiliesWaitingPanel />
              <CoachFamilyHubPanel />
            </div>
          </DashboardSection>

          <DashboardSection
            id="attendance-alerts"
            title={FOOTBALL_LABELS.attendance}
            description="Players who may need a nudge."
            icon={ClipboardCheck}
          >
            <AttendanceAtRiskPanel />
          </DashboardSection>
        </aside>
      </div>
    </div>
  );
}
