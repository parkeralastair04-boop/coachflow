import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/icon";
import { TYPE } from "@/lib/ui/tokens";
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
    <Card
      variant="interactive"
      className={cn(
        "group relative overflow-hidden sm:p-8",
        "shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
        "hover:shadow-[0_0_0_1px_var(--ring-glow)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]",
        className,
      )}
    >
      <div className="relative">
        <div className="bg-accent/10 ring-accent/25 mb-4 inline-flex size-11 items-center justify-center rounded-xl ring-1 transition-transform duration-200 ease-out group-hover:scale-105 motion-reduce:transition-none">
          <AppIcon icon={Icon} size="md" className="text-accent" />
        </div>
        <h3 className={TYPE.sectionTitle}>{title}</h3>
        <p className={cn(TYPE.description, "mt-2")}>{description}</p>
      </div>
    </Card>
  );
}
