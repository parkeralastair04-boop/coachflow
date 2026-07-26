import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { FootballScene } from "@/components/football/football-scenes";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/icon";
import type { FootballEmptySceneId } from "@/lib/football-identity";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  secondaryHref?: string;
  className?: string;
  /** Optional football coaching illustration (replaces icon badge). */
  scene?: FootballEmptySceneId;
  /** `panel` = glass card (default). `plain` = nested empty copy without extra chrome. */
  variant?: "panel" | "plain";
};

/** Encouraging empty state for dashboard modules. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  className,
  scene,
  variant = "panel",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "motion-fade-in relative flex flex-col items-center overflow-hidden text-center",
        variant === "panel"
          ? "football-panel pitch-card-accent football-panel-interactive rounded-2xl px-6 py-12 sm:px-10"
          : "rounded-2xl bg-surface-subtle px-4 py-8",
        className,
      )}
      role="status"
    >
      {variant === "panel" ? (
        <div
          className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.35]"
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "relative flex items-center justify-center",
          scene
            ? "mb-1 min-h-[6.5rem]"
            : "bg-accent/12 ring-accent/25 size-16 rounded-2xl ring-1",
        )}
      >
        {scene ? (
          <FootballScene scene={scene} />
        ) : (
          <AppIcon icon={Icon} size="xl" className="text-accent" />
        )}
      </div>

      <h3 className={cn(TYPE.sectionTitle, scene ? "mt-3" : "mt-5")}>{title}</h3>
      <p className={cn(TYPE.description, "mx-auto mt-2 max-w-md")}>{description}</p>
      <div className="relative mt-6 flex flex-col items-center gap-3 sm:flex-row">
        {actionLabel && actionHref ? (
          <Link href={actionHref} className={buttonVariants({ variant: "primary" })}>
            {actionLabel}
          </Link>
        ) : null}
        {actionLabel && onAction && !actionHref ? (
          <Button type="button" variant="primary" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
        {secondaryLabel && secondaryHref ? (
          <Link
            href={secondaryHref}
            className={buttonVariants({ variant: "ghost", className: "px-3" })}
          >
            {secondaryLabel}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
