import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import type { DashboardMetricTheme } from "@/lib/dashboard-visual";
import { cn } from "@/lib/utils";

type DashboardMetricTileProps = {
  id: string;
  label: string;
  value: string;
  numericValue?: number;
  valueAriaLabel: string;
  helper: string;
  href: string;
  icon: LucideIcon;
  theme: DashboardMetricTheme;
  isEmpty?: boolean;
  variant?: "hero" | "default";
};

export function DashboardMetricTile({
  id,
  label,
  value,
  numericValue,
  valueAriaLabel,
  helper,
  href,
  icon: Icon,
  theme,
  isEmpty = false,
  variant = "default",
}: DashboardMetricTileProps) {
  const showCounter = numericValue !== undefined && !isEmpty;
  const isHero = variant === "hero";

  return (
    <Link
      href={href}
      aria-labelledby={`${id}-label`}
      className={cn(
        "group relative block overflow-hidden rounded-2xl outline-none transition-transform duration-[var(--motion-base)] ease-[var(--motion-ease)] focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#071210]",
        isHero
          ? cn(
              "border border-white/[0.08] bg-white/[0.04] p-5 sm:p-6",
              "hover:border-white/[0.14] hover:bg-white/[0.06]",
              theme.glow,
            )
          : cn(
              "football-panel football-panel-interactive border-t-[3px] border-t-transparent p-5 sm:p-6",
              "pitch-card-accent",
            ),
      )}
    >
      <div
        className={cn("absolute inset-x-0 top-0 h-[3px]", theme.stripe)}
        aria-hidden
      />

      {isHero ? (
        <div
          className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.12]"
          aria-hidden
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            id={`${id}-label`}
            className={cn(
              "text-[11px] font-bold tracking-[0.18em] uppercase",
              isHero ? "text-white/50" : "text-muted",
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              "mt-2 font-semibold tabular-nums tracking-tight",
              isHero ? "text-4xl text-white sm:text-[2.75rem]" : "text-3xl",
            )}
            aria-label={valueAriaLabel}
          >
            {showCounter ? (
              <>
                <AnimatedCounter value={numericValue!} />
                <span className="sr-only">{value}</span>
              </>
            ) : (
              value
            )}
          </p>
          <p
            className={cn(
              "mt-2 text-xs leading-relaxed sm:text-sm",
              isHero ? "text-white/45" : "text-muted",
            )}
          >
            {helper}
          </p>
        </div>
        <div
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl ring-1",
            theme.iconWrap,
          )}
        >
          <Icon className={cn("size-5", theme.icon)} aria-hidden />
        </div>
      </div>

      {!isEmpty ? (
        <span
          className={cn(
            "relative mt-5 inline-flex items-center gap-1.5 text-sm font-medium",
            isHero ? "text-accent" : "text-accent",
          )}
        >
          Open
          <ArrowRight
            className="size-3.5 transition-transform duration-[var(--motion-base)] group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      ) : null}
    </Link>
  );
}
