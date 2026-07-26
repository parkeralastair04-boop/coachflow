import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardWidgetPanelProps = {
  id?: string;
  title: string;
  description?: string;
  icon: LucideIcon;
  href: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
};

/** Consistent widget shell for Match Centre, Training, Video, Finance blocks. */
export function DashboardWidgetPanel({
  id,
  title,
  description,
  icon: Icon,
  href,
  linkLabel = "Open",
  className,
  children,
}: DashboardWidgetPanelProps) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className={cn(
        "dashboard-widget-panel football-panel relative overflow-hidden rounded-2xl p-5 sm:p-6",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" aria-hidden />
      <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.08]" aria-hidden />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-accent/12 ring-accent/25 flex size-10 shrink-0 items-center justify-center rounded-xl ring-1">
            <Icon className="text-accent size-[1.125rem]" aria-hidden />
          </div>
          <div>
            <h2
              id={id ? `${id}-heading` : undefined}
              className="text-base font-semibold tracking-tight sm:text-lg"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-muted mt-1 text-sm leading-relaxed">{description}</p>
            ) : null}
          </div>
        </div>
        <Link
          href={href}
          className="text-accent focus-visible:ring-accent/40 inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {linkLabel}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>

      <div className="relative mt-6">{children}</div>
    </section>
  );
}

export function DashboardWidgetStat({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-surface-subtle px-4 py-3",
        className,
      )}
    >
      <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">{label}</p>
      <p className="mt-1.5 text-sm font-semibold tracking-tight sm:text-base">{value}</p>
    </div>
  );
}
