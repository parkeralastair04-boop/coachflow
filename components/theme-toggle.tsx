"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_OPTIONS, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

type ThemeToggleProps = {
  className?: string;
  /** Compact icon-only control for nav bars */
  variant?: "menu" | "inline";
};

export function ThemeToggle({ className, variant = "menu" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const active = (mounted ? theme : "dark") as ThemeMode | undefined;
  const ActiveIcon = ICONS[active === "system" || !active ? "system" : active] ?? Monitor;

  if (variant === "inline") {
    return (
      <div
        role="radiogroup"
        aria-label="Theme"
        className={cn(
          "border-border bg-surface-subtle inline-flex rounded-full border p-1",
          className,
        )}
      >
        {THEME_OPTIONS.map((option) => {
          const Icon = ICONS[option.value];
          const selected = active === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              disabled={!mounted}
              title={option.label}
              onClick={() => setTheme(option.value)}
              className={cn(
                "inline-flex size-9 items-center justify-center rounded-full text-sm transition-colors",
                "focus-visible:ring-accent/40 focus-visible:ring-2 focus-visible:outline-none",
                selected
                  ? "bg-accent text-white shadow-sm"
                  : "text-muted hover:text-foreground hover:bg-surface-hover",
              )}
            >
              <span className="sr-only">{option.icon}</span>
              <Icon className="size-4" aria-hidden />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={!mounted}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "text-muted hover:text-foreground border-border hover:bg-surface-hover inline-flex size-10 items-center justify-center rounded-xl border transition-colors",
          "focus-visible:ring-accent/40 focus-visible:ring-2 focus-visible:outline-none",
          "disabled:cursor-wait disabled:opacity-60",
        )}
      >
        <ActiveIcon className="size-[1.125rem]" aria-hidden />
        <span className="sr-only">Theme: {active ?? "dark"}</span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="border-border glass-panel absolute right-0 z-50 mt-2 min-w-[11rem] rounded-xl border p-1 shadow-lg"
        >
          {THEME_OPTIONS.map((option) => {
            const Icon = ICONS[option.value];
            const selected = active === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  setTheme(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  selected
                    ? "bg-accent/10 text-foreground font-medium"
                    : "text-muted hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <span className="text-base" aria-hidden>
                  {option.icon}
                </span>
                <span className="flex-1">{option.label}</span>
                <Icon className="text-muted size-4 opacity-60" aria-hidden />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
