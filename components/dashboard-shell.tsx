"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { PitchSurface } from "@/components/football/pitch-surface";
import { OnboardingHost } from "@/components/onboarding-host";
import { ProductFeedbackWidget } from "@/components/product-feedback-widget";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAccountMenu } from "@/components/user-account-menu";
import type { AcademyBranding } from "@/lib/academy-shared";
import type { FeatureKey } from "@/lib/subscription";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";
import { LAYOUT } from "@/lib/ui/tokens";

type DashboardUserContextValue = {
  email: string | null;
  isFounder: boolean;
  isBetaTester: boolean;
};

const DashboardUserContext = createContext<DashboardUserContextValue>({
  email: null,
  isFounder: false,
  isBetaTester: false,
});

export function useDashboardUser() {
  return useContext(DashboardUserContext);
}

type DashboardShellProps = {
  academy?: AcademyBranding | null;
  enabledFeatures: FeatureKey[];
  userEmail?: string | null;
  isFounder?: boolean;
  isBetaTester?: boolean;
  children: React.ReactNode;
};

export function DashboardShell({
  academy,
  enabledFeatures,
  userEmail = null,
  isFounder = false,
  isBetaTester = false,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDashboardHome = pathname === "/dashboard";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <DashboardUserContext.Provider
      value={{ email: userEmail, isFounder, isBetaTester }}
    >
      <div className="bg-background mesh-gradient min-h-full lg:flex">
        <div className="glass-panel border-border sticky top-0 z-40 flex items-center justify-between gap-2 border-b px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="text-muted hover:text-foreground hover:bg-surface-hover inline-flex size-10 items-center justify-center rounded-xl transition-colors"
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="dashboard-mobile-nav"
          >
            <Menu className="size-5" aria-hidden />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold tracking-tight">
            Awarix
          </p>
          <div className="flex items-center gap-1">
            <UserAccountMenu
              key={pathname}
              email={userEmail}
              variant="coach"
              layout="header"
            />
            <ThemeToggle />
          </div>
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
          id="dashboard-mobile-nav"
          className={cn(
            "z-50 lg:static lg:translate-x-0",
            mobileOpen
              ? "fixed inset-y-0 left-0 w-[min(100%,18rem)] translate-x-0 shadow-2xl transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
              : "fixed inset-y-0 left-0 w-[min(100%,18rem)] -translate-x-full transition-transform duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] lg:translate-x-0",
          )}
        >
          <Sidebar
            academy={academy}
            enabledFeatures={enabledFeatures}
            userEmail={userEmail}
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
          <header className="border-border bg-background/80 sticky top-0 z-30 hidden items-center justify-end gap-2 border-b px-6 py-3 backdrop-blur-xl lg:flex">
            <ThemeToggle />
            <UserAccountMenu
              key={pathname}
              email={userEmail}
              variant="coach"
              layout="header"
            />
          </header>
          <main className="flex-1">
            <PitchSurface
              variant="subtle"
              className={cn(
                "h-full",
                isDashboardHome
                  ? "px-0 pb-8 pt-0 sm:px-0 lg:px-0 lg:pb-10"
                  : "px-4 py-8 sm:px-6 lg:px-10 lg:py-10",
              )}
            >
              <div
                className={cn(
                  LAYOUT.pageMax,
                  isDashboardHome ? "max-w-none" : LAYOUT.pageStack,
                )}
              >
                {children}
              </div>
            </PitchSurface>
          </main>
        </div>
        <OnboardingHost />
        <ProductFeedbackWidget />
      </div>
    </DashboardUserContext.Provider>
  );
}
