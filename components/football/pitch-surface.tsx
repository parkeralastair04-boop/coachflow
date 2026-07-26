import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type PitchSurfaceProps = HTMLAttributes<HTMLDivElement> & {
  /** `subtle` for dashboard backgrounds; `hero` for marketing-style panels. */
  variant?: "subtle" | "hero";
};

/**
 * Stadium-lit pitch backdrop — pitch lines + tactical grid, premium not playful.
 */
export function PitchSurface({
  variant = "subtle",
  className,
  children,
  ...props
}: PitchSurfaceProps) {
  return (
    <div
      className={cn(
        "pitch-surface relative",
        variant === "hero" && "stadium-gradient pitch-surface-hero",
        variant === "subtle" && "pitch-surface-subtle",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
