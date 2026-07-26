import { DemoFeatureDiscovery } from "@/components/demo-feature-discovery";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_REPORTS } from "@/lib/demo/data";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export default function DemoReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className={TYPE.pageTitle}>Player Development</h1>
        <p className={cn(TYPE.description, "mt-1")}>
          Technical, physical, and behavioural examples — some shared with parents.
        </p>
      </div>
      <DemoFeatureDiscovery page="reports" />
      <div className="space-y-4">
        {DEMO_REPORTS.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle>
                {report.playerName} · {report.focus}
              </CardTitle>
              <CardDescription>
                {report.sharedWithParent ? "Shared with parent" : "Coach-only draft"}
              </CardDescription>
              <p className="text-sm leading-relaxed">{report.summary}</p>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
