import type { LucideIcon } from "lucide-react";
import { LandPlot } from "lucide-react";
import { FootballPageBand } from "@/components/football/football-page-band";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  subtitleClassName?: string;
  icon?: LucideIcon;
  eyebrow?: string;
  className?: string;
  children?: React.ReactNode;
};

/** Consistent dashboard / settings page heading with football page band. */
export function PageHeader({
  title,
  subtitle,
  subtitleClassName,
  icon = LandPlot,
  eyebrow,
  className,
  children,
}: PageHeaderProps) {
  return (
    <FootballPageBand
      title={title}
      subtitle={subtitle}
      subtitleClassName={subtitleClassName}
      icon={icon}
      eyebrow={eyebrow}
      actions={children}
      className={className}
    />
  );
}
