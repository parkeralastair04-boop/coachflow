import { DemoAnalyticsPanel } from "@/components/demo-analytics-panel";
import { DemoFeatureDiscovery } from "@/components/demo-feature-discovery";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export default function DemoAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className={TYPE.pageTitle}>Performance Insights</h1>
        <p className={cn(TYPE.description, "mt-1")}>
          Realistic sample metrics for bookings, attendance, and parent engagement.
        </p>
      </div>
      <DemoFeatureDiscovery page="analytics" />
      <DemoAnalyticsPanel />
    </div>
  );
}
