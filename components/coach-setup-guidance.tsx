import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

type CoachSetupGuidanceProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionHref: string;
  actionLabel: string;
};

export function CoachSetupGuidance({
  icon: Icon,
  title,
  description,
  actionHref,
  actionLabel,
}: CoachSetupGuidanceProps) {
  return (
    <div className="glass-panel interactive-surface rounded-2xl p-8 text-center">
      <Icon className="text-muted mx-auto size-8" aria-hidden />
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">{description}</p>
      <Link
        href={actionHref}
        className="bg-foreground text-background hover:opacity-90 mt-6 inline-flex h-11 items-center justify-center rounded-full px-6 text-sm font-medium transition-opacity"
      >
        {actionLabel}
        <ArrowRight className="ml-2 size-4" aria-hidden />
      </Link>
    </div>
  );
}
