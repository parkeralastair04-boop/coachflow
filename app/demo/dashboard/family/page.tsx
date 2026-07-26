import { DemoFeatureDiscovery } from "@/components/demo-feature-discovery";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_BOOKINGS, DEMO_PLAYERS, DEMO_REPORTS } from "@/lib/demo/data";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export default function DemoFamilyPage() {
  const sharedReports = DEMO_REPORTS.filter((r) => r.sharedWithParent);
  const children = DEMO_PLAYERS.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={TYPE.pageTitle}>Parent Portal</h1>
        <p className={cn(TYPE.description, "mt-1")}>
          Preview of what an active parent sees after claiming their account.
        </p>
      </div>
      <DemoFeatureDiscovery page="family" />
      <section>
        <h2 className={TYPE.sectionTitle}>Your children</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {children.map((child) => (
            <Card key={child.id} variant="muted">
              <CardHeader className="mb-0">
                <CardTitle className="text-base">{child.name}</CardTitle>
                <CardDescription>
                  {child.team} · Attendance {child.attendanceRate}%
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className={TYPE.sectionTitle}>Upcoming sessions</h2>
        <ul className="mt-3 space-y-2">
          {DEMO_BOOKINGS.filter((b) => b.status === "confirmed" && b.when === "Upcoming").map(
            (booking) => (
              <li key={booking.id}>
                <Card>
                  <CardHeader className="mb-0">
                    <CardTitle className="text-base">{booking.session}</CardTitle>
                    <CardDescription>{booking.childName}</CardDescription>
                  </CardHeader>
                </Card>
              </li>
            ),
          )}
        </ul>
      </section>
      <section>
        <h2 className={TYPE.sectionTitle}>Shared reports</h2>
        <div className="mt-3 space-y-3">
          {sharedReports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {report.playerName} · {report.focus}
                </CardTitle>
                <p className="text-sm leading-relaxed">{report.summary}</p>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
