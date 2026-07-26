import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";
import { DEMO_FEATURE_DISCOVERY } from "@/lib/demo/data";

type DemoFeatureDiscoveryProps = {
  page: keyof typeof DEMO_FEATURE_DISCOVERY;
  className?: string;
};

/** Subtle page guidance for the demo experience — not an intrusive tutorial. */
export function DemoFeatureDiscovery({ page, className }: DemoFeatureDiscoveryProps) {
  const copy = DEMO_FEATURE_DISCOVERY[page];
  if (!copy) return null;

  return (
    <aside
      className={cn(
        "border-border bg-surface-subtle rounded-2xl border px-4 py-3 sm:px-5",
        className,
      )}
      aria-label="How coaches use this"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[color-mix(in_srgb,var(--accent)_80%,var(--foreground))]">
        How coaches use this
      </p>
      <p className={cn(TYPE.description, "mt-1.5")}>
        <span className="text-foreground font-medium">{copy.what}</span> {copy.why}
      </p>
      <p className="text-muted mt-2 text-xs leading-relaxed">{copy.tip}</p>
    </aside>
  );
}
