import type { LucideIcon } from "lucide-react";
import { LandPlot } from "lucide-react";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type FootballPageBandProps = {
  title: string;
  subtitle?: string;
  subtitleClassName?: string;
  icon?: LucideIcon;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
  variant?: "default" | "compact";
};

/** Page header band with pitch markings and module icon — cascades across manager pages. */
export function FootballPageBand({
  title,
  subtitle,
  subtitleClassName,
  icon: Icon = LandPlot,
  eyebrow,
  actions,
  className,
  variant = "default",
}: FootballPageBandProps) {
  const compact = variant === "compact";

  return (
    <header className={cn("football-page-band page-content-enter", className)}>
      <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.12]" aria-hidden />
      <div className="pointer-events-none absolute inset-0 pitch-surface-subtle opacity-40" aria-hidden />

      <div
        className={cn(
          "relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
          compact ? "px-0 py-0" : "",
        )}
      >
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <div className="bg-accent/12 ring-accent/25 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 sm:size-12">
            <Icon className="text-accent size-5 sm:size-[1.35rem]" aria-hidden />
          </div>
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-accent mb-1 text-[11px] font-bold tracking-[0.22em] uppercase">
                {eyebrow}
              </p>
            ) : null}
            <h1 className={TYPE.pageTitle}>{title}</h1>
            {subtitle ? (
              <p
                className={cn(
                  TYPE.description,
                  "mt-1.5 max-w-2xl sm:text-base",
                  subtitleClassName,
                )}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
