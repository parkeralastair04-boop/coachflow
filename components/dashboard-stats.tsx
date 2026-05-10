import { Users, CalendarClock, PoundSterling, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Stat = {
  label: string;
  value: string;
  hint: string;
  icon: typeof Users;
};

const STATS: Stat[] = [
  {
    label: "Total players",
    value: "128",
    hint: "+12 vs last month",
    icon: Users,
  },
  {
    label: "Upcoming sessions",
    value: "12",
    hint: "Next: Tue 6:30pm",
    icon: CalendarClock,
  },
  {
    label: "Monthly revenue",
    value: "£4,820",
    hint: "Estimated MRR",
    icon: PoundSterling,
  },
  {
    label: "Trial conversions",
    value: "24%",
    hint: "Last 30 days",
    icon: TrendingUp,
  },
];

type DashboardStatsProps = {
  className?: string;
};

export function DashboardStats({ className }: DashboardStatsProps) {
  return (
    <section className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {STATS.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="glass-panel rounded-2xl p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-muted text-sm font-medium">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-muted mt-1 text-xs">{stat.hint}</p>
              </div>
              <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
                <Icon className="text-accent size-5" aria-hidden />
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}
