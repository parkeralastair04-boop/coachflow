import { DemoFeatureDiscovery } from "@/components/demo-feature-discovery";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDemoRecurringSeries, getDemoSessions, DEMO_ATTENDANCE } from "@/lib/demo/data";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export default function DemoSessionsPage() {
  const sessions = getDemoSessions();
  const series = getDemoRecurringSeries();

  return (
    <div className="space-y-6">
      <div>
        <h1 className={TYPE.pageTitle}>Training Sessions</h1>
        <p className={cn(TYPE.description, "mt-1")}>
          Upcoming group blocks, 1:1s, and weekly memberships.
        </p>
      </div>
      <DemoFeatureDiscovery page="sessions" />
      <div className="grid gap-4">
        {sessions.map((session) => (
          <Card key={session.session_id}>
            <CardHeader>
              <CardTitle>{session.group_name}</CardTitle>
              <CardDescription>
                {new Date(session.session_date).toLocaleString("en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {session.location}
              </CardDescription>
              <p className="text-sm">
                £{session.price} · {session.remaining_spaces} spaces left
                {session.is_full ? " · Full (waitlist open)" : ""}
                {session.waitlist_count > 0 ? ` · Waitlist ${session.waitlist_count}` : ""}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>
      <h2 className={TYPE.sectionTitle}>Weekly packages</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {series.map((item) => (
          <Card key={item.recurring_series_id}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>
                £{item.monthly_price}/month · {item.active_subscriptions} active ·{" "}
                {item.remaining_spaces} spaces
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      <h2 className={TYPE.sectionTitle}>Recent attendance</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {DEMO_ATTENDANCE.map((row) => (
          <Card key={row.session} variant="muted">
            <CardHeader className="mb-0">
              <CardTitle className="text-sm">{row.session}</CardTitle>
              <CardDescription>
                Present {row.present} · Late {row.late} · Absent {row.absent}
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
