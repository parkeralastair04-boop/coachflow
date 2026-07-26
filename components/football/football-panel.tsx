import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type FootballPanelVariant = "default" | "interactive" | "insight" | "flush";

const variants: Record<FootballPanelVariant, string> = {
  default: "football-panel rounded-2xl p-5 sm:p-6",
  interactive: "football-panel football-panel-interactive rounded-2xl p-5 sm:p-6",
  insight: "dashboard-insight-panel rounded-2xl p-5 sm:p-6",
  flush: "football-panel rounded-2xl",
};

type FootballPanelProps = HTMLAttributes<HTMLDivElement> & {
  variant?: FootballPanelVariant;
  /** Show tactical board dot grid overlay. */
  tactical?: boolean;
};

/**
 * Premium football-branded panel — pitch accent, optional tactical grid.
 * Use instead of bare `glass-panel` for coach-facing surfaces.
 */
export function FootballPanel({
  variant = "default",
  tactical = true,
  className,
  children,
  ...props
}: FootballPanelProps) {
  return (
    <div className={cn("relative overflow-hidden", variants[variant], className)} {...props}>
      {tactical ? (
        <div
          className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.07]"
          aria-hidden
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}
