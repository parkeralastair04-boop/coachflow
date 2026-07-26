import type { HTMLAttributes } from "react";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export type CardVariant = "default" | "muted" | "interactive" | "flush" | "stat" | "pitch";

const cardVariants: Record<CardVariant, string> = {
  default: "football-panel rounded-2xl p-5 sm:p-6",
  muted: "rounded-2xl bg-surface-subtle p-5 sm:p-6",
  interactive: "football-panel football-panel-interactive rounded-2xl p-5 sm:p-6",
  stat: "football-panel pitch-card-accent football-panel-interactive rounded-2xl p-5 sm:p-6",
  pitch: "football-panel football-panel-interactive pitch-card-accent rounded-2xl p-5 sm:p-6",
  flush: "football-panel rounded-2xl",
};

export function Card({
  variant = "default",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: CardVariant }) {
  return (
    <div className={cn("relative overflow-hidden", cardVariants[variant], className)} {...props}>
      {variant !== "muted" ? (
        <div
          className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.06]"
          aria-hidden
        />
      ) : null}
      <div className="relative">{children}</div>
    </div>
  );
}

export function CardHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn(TYPE.cardTitle, className)} {...props} />;
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn(TYPE.description, className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn(className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-5 flex flex-wrap items-center gap-3", className)}
      {...props}
    />
  );
}
