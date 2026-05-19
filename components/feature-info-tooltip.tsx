"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Info } from "lucide-react";
import {
  FEATURE_INFO,
  getPlanDisplayName,
  type FeatureInfoKey,
} from "@/lib/feature-info";
import { cn } from "@/lib/utils";

type FeatureInfoTooltipProps = {
  featureKey: FeatureInfoKey;
  className?: string;
};

function useHoverCapable() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(hover: hover)");
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(hover: hover)").matches,
    () => false,
  );
}

export function FeatureInfoTooltip({ featureKey, className }: FeatureInfoTooltipProps) {
  const info = FEATURE_INFO[featureKey];
  const [open, setOpen] = useState(false);
  const hoverCapable = useHoverCapable();
  const popoverId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => {
        if (hoverCapable) setOpen(true);
      }}
      onMouseLeave={() => {
        if (hoverCapable) setOpen(false);
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-label={`About ${info.title}`}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "text-muted hover:text-accent hover:bg-accent/10 focus-visible:ring-accent/40 inline-flex size-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
          open && "text-accent bg-accent/10",
        )}
      >
        <Info className="size-4" strokeWidth={2.25} aria-hidden />
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-labelledby={`${popoverId}-title`}
          className={cn(
            "border-border glass-panel absolute top-full left-1/2 z-50 mt-2 w-[min(100vw-2rem,20rem)] -translate-x-1/2 rounded-2xl border p-4 shadow-lg sm:left-auto sm:translate-x-0 sm:ltr:right-0 sm:rtl:left-0",
          )}
        >
          <p id={`${popoverId}-title`} className="text-sm font-semibold tracking-tight">
            {info.title}
          </p>

          <dl className="text-muted mt-3 space-y-2.5 text-xs leading-relaxed">
            <div>
              <dt className="text-foreground font-medium">What it does</dt>
              <dd className="mt-0.5">{info.what}</dd>
            </div>
            <div>
              <dt className="text-foreground font-medium">Why it helps</dt>
              <dd className="mt-0.5">{info.why}</dd>
            </div>
            <div>
              <dt className="text-foreground font-medium">Recommended use</dt>
              <dd className="mt-0.5">{info.usage}</dd>
            </div>
          </dl>

          {info.includedIn && info.includedIn.length > 0 ? (
            <div className="border-border mt-4 border-t pt-3">
              <p className="text-muted text-[10px] font-medium tracking-wide uppercase">
                Included in
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {info.includedIn.map((planId) => (
                  <span
                    key={planId}
                    className="bg-accent/10 text-accent ring-accent/20 inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1"
                  >
                    {getPlanDisplayName(planId)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
