import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardSectionProps = {
  id?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  variant?: "default" | "pitch";
  className?: string;
  children: React.ReactNode;
};

/** Football-themed section chrome for dashboard pages. */
export function DashboardSection({
  id,
  title,
  description,
  icon: Icon,
  action,
  variant = "default",
  className,
  children,
}: DashboardSectionProps) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-24", className)}
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <div
        className={cn(
          "mb-5 flex flex-wrap items-end justify-between gap-4 border-b pb-5",
          variant === "pitch"
            ? "border-accent/20"
            : "border-border/70",
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1",
                variant === "pitch"
                  ? "bg-accent/15 ring-accent/30"
                  : "bg-accent/10 ring-accent/20",
              )}
            >
              <Icon className="text-accent size-5" aria-hidden />
            </div>
          ) : (
            <div className="bg-accent mt-2 h-8 w-1 shrink-0 rounded-full" aria-hidden />
          )}
          <div className="min-w-0">
            <h2
              id={id ? `${id}-heading` : undefined}
              className="text-lg font-semibold tracking-tight sm:text-xl"
            >
              {title}
            </h2>
            {description ? (
              <p className="text-muted mt-1 max-w-2xl text-sm leading-relaxed">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
