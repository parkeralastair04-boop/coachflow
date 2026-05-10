import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type FeatureCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
};

export function FeatureCard({
  icon: Icon,
  title,
  description,
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "glass-panel relative overflow-hidden rounded-2xl p-6 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] transition-shadow sm:p-8",
        "hover:shadow-[0_0_0_1px_var(--ring-glow)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]",
        className,
      )}
    >
      <div className="relative">
        <div className="bg-accent/10 ring-accent/25 mb-4 inline-flex size-11 items-center justify-center rounded-xl ring-1">
          <Icon className="text-accent size-5" aria-hidden />
        </div>
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-muted mt-2 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
