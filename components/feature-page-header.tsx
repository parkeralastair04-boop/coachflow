import { FeatureInfoTooltip } from "@/components/feature-info-tooltip";
import { FootballPageBand } from "@/components/football/football-page-band";
import { getFeatureIcon } from "@/lib/feature-icons";
import type { FeatureInfoKey } from "@/lib/feature-info";

type FeaturePageHeaderProps = {
  featureKey: FeatureInfoKey;
  title: string;
  subtitle: string;
  subtitleClassName?: string;
  actions?: React.ReactNode;
};

export function FeaturePageHeader({
  featureKey,
  title,
  subtitle,
  subtitleClassName,
  actions,
}: FeaturePageHeaderProps) {
  const Icon = getFeatureIcon(featureKey);

  return (
    <FootballPageBand
      title={title}
      subtitle={subtitle}
      subtitleClassName={subtitleClassName}
      icon={Icon}
      eyebrow="On the pitch"
      actions={
        <>
          {actions}
          <FeatureInfoTooltip featureKey={featureKey} />
        </>
      }
    />
  );
}
