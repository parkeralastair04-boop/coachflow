"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import type { AcademyBranding } from "@/lib/academy-shared";
import type { FeatureKey } from "@/lib/subscription";
import { Sidebar } from "@/components/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  academy?: AcademyBranding | null;
  enabledFeatures: FeatureKey[];
  children: React.ReactNode;
};

export function DashboardShell({
  academy,
  enabledFeatures,
  children,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background min-h-full lg:flex">
      <div className="glass-panel border-border sticky top-0 z-40 flex items-center justify-between border-b px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="text-muted hover:text-foreground hover:bg-surface-hover inline-flex size-10 items-center justify-center rounded-xl transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <p className="text-sm font-semibold tracking-tight">CoachFlow</p>
        <ThemeToggle />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] lg:hidden dark:bg-black/60"
          aria-label="Close navigation menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div
        className={cn(
          "z-50 lg:static lg:translate-x-0",
          mobileOpen
            ? "fixed inset-y-0 left-0 w-[min(100%,18rem)] translate-x-0 shadow-2xl transition-transform duration-300 ease-out"
            : "fixed inset-y-0 left-0 w-[min(100%,18rem)] -translate-x-full transition-transform duration-300 ease-out lg:translate-x-0",
        )}
      >
        <Sidebar
          academy={academy}
          enabledFeatures={enabledFeatures}
          onNavigate={() => setMobileOpen(false)}
          mobileHeader={
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="text-muted hover:text-foreground hover:bg-surface-hover ml-auto inline-flex size-9 items-center justify-center rounded-lg transition-colors lg:hidden"
              aria-label="Close navigation menu"
            >
              <X className="size-5" aria-hidden />
            </button>
          }
        />
      </div>

      <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col lg:pl-60">
        <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
