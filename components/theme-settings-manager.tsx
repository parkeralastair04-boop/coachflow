"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
import { Check, Palette } from "lucide-react";
import { BRAND_EMERALD, BRAND_NAVY, THEME_OPTIONS, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeSettingsManager() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useMounted();

  const activeTheme = (mounted ? theme : "dark") as ThemeMode | undefined;
  const resolvedLabel =
    resolvedTheme === "light" ? "Light" : resolvedTheme === "dark" ? "Dark" : "—";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Appearance</h1>
        <p className="text-muted mt-1 text-sm">
          Choose how CoachFlow looks on this device. Your preference is saved automatically.
        </p>
      </div>

      <section className="glass-panel rounded-2xl p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="bg-accent/10 ring-accent/20 flex size-11 shrink-0 items-center justify-center rounded-xl ring-1">
            <Palette className="text-accent size-5" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Theme Settings</h2>
            <p className="text-muted mt-1 text-sm">
              {mounted ? (
                <>
                  Active appearance:{" "}
                  <span className="text-foreground font-medium">{resolvedLabel}</span>
                  {activeTheme === "system" ? " (from system)" : null}
                </>
              ) : (
                "Loading theme…"
              )}
            </p>
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Theme"
          className="mt-8 grid gap-3 sm:grid-cols-3"
        >
          {THEME_OPTIONS.map((option) => {
            const selected = activeTheme === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!mounted}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "relative flex flex-col items-start rounded-2xl border p-4 text-left transition-all sm:p-5",
                  "focus-visible:ring-accent/40 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  "disabled:cursor-wait disabled:opacity-70",
                  selected
                    ? "border-accent/50 bg-accent/5 ring-accent/30 shadow-[0_0_0_1px_var(--ring-glow)] ring-1"
                    : "border-border hover:border-accent/25 hover:bg-surface-subtle bg-background/50",
                )}
              >
                <span className="text-2xl" aria-hidden>
                  {option.icon}
                </span>
                <span className="mt-3 font-semibold tracking-tight">{option.label}</span>
                <span className="text-muted mt-1 text-xs leading-relaxed">
                  {option.description}
                </span>
                {selected ? (
                  <span className="bg-accent absolute top-3 right-3 inline-flex size-6 items-center justify-center rounded-full text-white">
                    <Check className="size-3.5" strokeWidth={3} aria-hidden />
                    <span className="sr-only">Selected</span>
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="text-muted mt-6 text-xs leading-relaxed">
          CoachFlow uses emerald green ({BRAND_EMERALD}) and navy ({BRAND_NAVY}) across both
          themes. Dark mode is the default when you first sign up.
        </p>
      </section>
    </div>
  );
}
