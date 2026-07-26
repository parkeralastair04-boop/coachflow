import { DEMO_ANALYTICS } from "@/lib/demo/data";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Sample analytics for the demo academy — clearly labelled. */
export function DemoAnalyticsPanel() {
  const metrics = [
    {
      label: "Bookings this month",
      value: String(DEMO_ANALYTICS.bookingsThisMonth),
      helper: DEMO_ANALYTICS.bookingsTrend,
    },
    {
      label: "Attendance rate",
      value: `${DEMO_ANALYTICS.attendanceRate}%`,
      helper: DEMO_ANALYTICS.attendanceTrend,
    },
    {
      label: "Parent engagement",
      value: `${DEMO_ANALYTICS.parentEngagement}%`,
      helper: DEMO_ANALYTICS.parentEngagementHelper,
    },
    {
      label: "Reports shared",
      value: String(DEMO_ANALYTICS.reportsShared),
      helper: DEMO_ANALYTICS.reportsTrend,
    },
    {
      label: "Active players",
      value: String(DEMO_ANALYTICS.growthPlayers),
      helper: DEMO_ANALYTICS.growthHelper,
    },
  ];

  return (
    <div className="space-y-4">
      <p
        className="border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100 rounded-xl border px-3 py-2 text-xs font-medium"
        role="note"
      >
        {DEMO_ANALYTICS.label}
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label} variant="default">
            <CardHeader className="mb-0">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-3xl">{metric.value}</CardTitle>
              <CardDescription className="mt-1">{metric.helper}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
