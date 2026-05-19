import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import type { FeatureInfoKey } from "@/lib/feature-info";
import { cn } from "@/lib/utils";

type FeaturePageHeaderProps = {
  featureKey: FeatureInfoKey;
  title: string;
  subtitle: string;
  subtitleClassName?: string;
};

export function FeaturePageHeader({
  featureKey,
  title,
  subtitle,
  subtitleClassName,
}: FeaturePageHeaderProps) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <FeatureInfoTooltip featureKey={featureKey} />
      </div>
      <p className={cn("text-muted mt-1 text-sm", subtitleClassName)}>{subtitle}</p>
    </div>
  );
}
