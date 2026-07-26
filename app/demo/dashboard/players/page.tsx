import { DemoFeatureDiscovery } from "@/components/demo-feature-discovery";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_PLAYERS } from "@/lib/demo/data";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export default function DemoPlayersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className={TYPE.pageTitle}>Active Squad</h1>
        <p className={cn(TYPE.description, "mt-1")}>
          Player profiles, parent contacts, and attendance — Riverside United demo data.
        </p>
      </div>
      <DemoFeatureDiscovery page="players" />
      <div className="grid gap-4 sm:grid-cols-2">
        {DEMO_PLAYERS.map((player) => (
          <Card key={player.id}>
            <CardHeader>
              <CardTitle>{player.name}</CardTitle>
              <CardDescription>
                Age {player.age} · {player.team} · Attendance {player.attendanceRate}%
              </CardDescription>
              <p className="text-sm leading-relaxed">{player.progressNote}</p>
              <p className="text-muted text-xs">
                Parent: {player.parentName} · {player.parentStatus}
              </p>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
