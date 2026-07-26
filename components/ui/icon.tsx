import type { LucideIcon, LucideProps } from "lucide-react";
import { ICON_SIZES, type IconSize } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type AppIconProps = LucideProps & {
  icon: LucideIcon;
  size?: IconSize;
  label?: string;
};

/**
 * Standard Lucide wrapper — consistent sizing and a11y labels.
 * Decorative icons: omit `label` (aria-hidden).
 * Meaningful icons: pass `label` (becomes aria-label).
 */
export function AppIcon({
  icon: Icon,
  size = "sm",
  label,
  className,
  ...props
}: AppIconProps) {
  return (
    <Icon
      className={cn(ICON_SIZES[size], "shrink-0", className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
      {...props}
    />
  );
}
