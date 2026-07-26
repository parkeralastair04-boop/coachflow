import Link from "next/link";
import { DemoFeatureDiscovery } from "@/components/demo-feature-discovery";
import { DemoAnalyticsPanel } from "@/components/demo-analytics-panel";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DEMO_ATTENDANCE,
  DEMO_BOOKINGS,
  DEMO_PLAYERS,
} from "@/lib/demo/data";
import { DEMO_ACADEMY_SLUG } from "@/lib/demo/constants";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export default function DemoDashboardPage() {
  const upcoming = DEMO_BOOKINGS.filter((b) => b.when === "Upcoming").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className={TYPE.pageTitle}>Academy Pulse</h1>
        <p className={cn(TYPE.description, "mt-1")}>
          Sample overview for Riverside United — a thriving academy on Awarix.
        </p>
      </div>
      <DemoFeatureDiscovery page="dashboard" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Players", value: String(DEMO_PLAYERS.length), href: "/demo/dashboard/players" },
          { label: "Upcoming bookings", value: String(upcoming), href: "/demo/dashboard/bookings" },
          {
            label: "Last session present",
            value: String(DEMO_ATTENDANCE[0]?.present ?? 0),
            href: "/demo/dashboard/sessions",
          },
          { label: "Public website", value: "Live", href: `/academy/${DEMO_ACADEMY_SLUG}` },
        ].map((card) => (
          <Link key={card.label} href={card.href}>
            <Card variant="interactive">
              <CardHeader className="mb-0">
                <CardDescription>{card.label}</CardDescription>
                <CardTitle className="text-3xl">{card.value}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
      <section className="space-y-3">
        <h2 className={TYPE.sectionTitle}>Sample analytics</h2>
        <DemoAnalyticsPanel />
      </section>
      <Link href={`/academy/${DEMO_ACADEMY_SLUG}/book`} className={buttonVariants({ variant: "accent" })}>
        Try the booking flow
      </Link>
    </div>
  );
}
