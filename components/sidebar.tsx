"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { UserAccountMenu } from "@/components/user-account-menu";
import {
  DASHBOARD_NAV_SECTIONS,
  SETUP_PHASE_NAV_HINTS,
  SIDEBAR_STORAGE_KEY,
  filterNavForSetupPhase,
  findSectionIdForPath,
  getDefaultSectionState,
  isNavItemActive,
  type DashboardNavItem,
  type DashboardNavSection,
} from "@/lib/dashboard-nav";
import type { AcademyBranding } from "@/lib/academy-shared";
import type { FeatureKey } from "@/lib/subscription";
import {
  buildOnboardingProgress,
  isActivationSetupIncomplete,
  parseOnboardingMetadata,
} from "@/lib/onboarding";
import { fetchOnboardingCounts } from "@/lib/onboarding-setup";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type SidebarProps = {
  academy?: AcademyBranding | null;
  enabledFeatures: FeatureKey[];
  userEmail?: string | null;
  onNavigate?: () => void;
  mobileHeader?: React.ReactNode;
};

function readStoredSections(): Record<string, boolean> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as Record<string, boolean>;
  } catch {
    return null;
  }
}

function writeStoredSections(state: Record<string, boolean>) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

export function Sidebar({
  academy,
  enabledFeatures,
  userEmail = null,
  onNavigate,
  mobileHeader,
}: SidebarProps) {
  const pathname = usePathname();
  const enabledSet = useMemo(() => new Set(enabledFeatures), [enabledFeatures]);
  const [currentHash, setCurrentHash] = useState("");
  const [hasBooking, setHasBooking] = useState(true);
  const [setupIncomplete, setSetupIncomplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const metadata = parseOnboardingMetadata(user.user_metadata);
        const counts = await fetchOnboardingCounts(supabase, user.id);
        const progress = buildOnboardingProgress({
          hasAcademy: counts.hasAcademy,
          hasSession: counts.hasSession,
          hasBookingPage: counts.hasBookingPage,
          bookingLinkShared: metadata.bookingLinkShared,
        });
        if (!cancelled) {
          setHasBooking(counts.hasBooking);
          setSetupIncomplete(
            isActivationSetupIncomplete({
              completedAt: metadata.completedAt,
              progress,
            }),
          );
        }
      } catch {
        if (!cancelled) {
          setHasBooking(true);
          setSetupIncomplete(false);
        }
      }
    })();

    function handleUpdate() {
      void (async () => {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const metadata = parseOnboardingMetadata(user.user_metadata);
        const counts = await fetchOnboardingCounts(supabase, user.id);
        const progress = buildOnboardingProgress({
          hasAcademy: counts.hasAcademy,
          hasSession: counts.hasSession,
          hasBookingPage: counts.hasBookingPage,
          bookingLinkShared: metadata.bookingLinkShared,
        });
        setHasBooking(counts.hasBooking);
        setSetupIncomplete(
          isActivationSetupIncomplete({
            completedAt: metadata.completedAt,
            progress,
          }),
        );
      })();
    }
    window.addEventListener("awarix:onboarding-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("awarix:onboarding-updated", handleUpdate);
    };
  }, []);

  useEffect(() => {
    const syncHash = () => setCurrentHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [pathname]);

  const [storedSections, setStoredSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    return readStoredSections() ?? {};
  });

  const openSections = useMemo(() => {
    const merged = { ...getDefaultSectionState(pathname, currentHash), ...storedSections };
    const activeSectionId = findSectionIdForPath(pathname, DASHBOARD_NAV_SECTIONS, currentHash);
    if (activeSectionId) merged[activeSectionId] = true;
    return merged;
  }, [pathname, currentHash, storedSections]);

  const toggleSection = useCallback(
    (sectionId: string) => {
      setStoredSections((prev) => {
        const current = { ...getDefaultSectionState(pathname, currentHash), ...prev };
        const activeSectionId = findSectionIdForPath(pathname, DASHBOARD_NAV_SECTIONS, currentHash);
        if (activeSectionId) current[activeSectionId] = true;

        const nextStored = { ...prev, [sectionId]: !current[sectionId] };
        const nextVisible = { ...current, [sectionId]: !current[sectionId] };
        writeStoredSections(
          Object.fromEntries(
            DASHBOARD_NAV_SECTIONS.map((section) => [section.id, Boolean(nextVisible[section.id])]),
          ),
        );
        return nextStored;
      });
    },
    [pathname, currentHash],
  );

  function hasFeatureAccess(feature?: FeatureKey): boolean {
    if (!feature) return true;
    return enabledSet.has(feature);
  }

  const navSections = useMemo(
    () =>
      setupIncomplete
        ? filterNavForSetupPhase(DASHBOARD_NAV_SECTIONS)
        : DASHBOARD_NAV_SECTIONS,
    [setupIncomplete],
  );

  return (
    <aside className="dashboard-sidebar flex h-full w-full flex-col border-r lg:fixed lg:inset-y-0 lg:w-60">
      <div className="dashboard-sidebar-border flex min-h-[5rem] items-center gap-2 border-b px-4 py-3 lg:min-h-[5.5rem] lg:px-5">
        <Link
          href="/dashboard"
          className="inline-flex min-w-0 flex-1 items-center leading-none"
          aria-label="Awarix dashboard"
          onClick={onNavigate}
        >
          <BrandLogo
            src={academy?.logo_url ?? "/logo.png"}
            alt={academy?.name ?? "Awarix"}
            size="sidebar"
            priority
          />
        </Link>
        {mobileHeader}
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Dashboard">
        {setupIncomplete ? (
          <p className="dashboard-sidebar-muted mb-3 px-2 text-[11px] leading-relaxed">
            Finish the 4 setup steps above to unlock the rest of your tools.
          </p>
        ) : null}
        <ul className="space-y-2">
          {navSections.map((section) => (
            <NavSection
              key={section.id}
              section={section}
              pathname={pathname}
              currentHash={currentHash}
              isOpen={openSections[section.id] ?? false}
              onToggle={() => toggleSection(section.id)}
              hasFeatureAccess={hasFeatureAccess}
              hasBooking={hasBooking}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>

      <div className="dashboard-sidebar-border border-t p-3 lg:hidden">
        <UserAccountMenu
          key={pathname}
          email={userEmail}
          variant="coach"
          layout="sidebar"
        />
      </div>
    </aside>
  );
}

function NavSection({
  section,
  pathname,
  currentHash,
  isOpen,
  onToggle,
  hasFeatureAccess,
  hasBooking,
  onNavigate,
}: {
  section: DashboardNavSection;
  pathname: string;
  currentHash: string;
  isOpen: boolean;
  onToggle: () => void;
  hasFeatureAccess: (feature?: FeatureKey) => boolean;
  hasBooking: boolean;
  onNavigate?: () => void;
}) {
  const SectionIcon = section.icon;
  const visibleItems = section.items.filter((item) => hasFeatureAccess(item.feature));
  if (visibleItems.length === 0) return null;

  const sectionActive = visibleItems.some((item) =>
    isNavItemActive(pathname, item.href, currentHash),
  );

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold tracking-wide uppercase transition-[background-color,color] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          sectionActive
            ? "text-white"
            : "dashboard-sidebar-muted hover:bg-white/[0.06] hover:text-white/90",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1",
            sectionActive
              ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
              : "bg-white/[0.05] text-white/45 ring-white/[0.08]",
          )}
        >
          <SectionIcon className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate">{section.title}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
      </button>

      <ul
        className={cn(
          "mt-1 space-y-0.5 overflow-hidden pl-1 transition-all duration-200",
          isOpen ? "max-h-[640px] opacity-100" : "pointer-events-none max-h-0 opacity-0",
        )}
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
      >
        {isOpen
          ? visibleItems.map((item) => (
              <NavItemLink
                key={`${section.id}-${item.href}-${item.label}`}
                item={item}
                pathname={pathname}
                currentHash={currentHash}
                setupHint={!hasBooking ? SETUP_PHASE_NAV_HINTS[item.href] : undefined}
                onNavigate={onNavigate}
              />
            ))
          : null}
      </ul>
    </li>
  );
}

function NavItemLink({
  item,
  pathname,
  currentHash,
  setupHint,
  onNavigate,
}: {
  item: DashboardNavItem;
  pathname: string;
  currentHash: string;
  setupHint?: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item.href, currentHash);

  const className = cn(
    "flex flex-col gap-0.5 rounded-xl px-3 py-2 text-sm font-medium transition-[background-color,color,transform] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
    active
      ? "bg-emerald-500/15 text-white shadow-[inset_0_0_0_1px_rgba(52,211,153,0.25)] ring-1 ring-emerald-500/30"
      : setupHint
        ? "dashboard-sidebar-muted hover:bg-white/[0.04] hover:text-white/70"
        : "text-white/55 hover:bg-white/[0.06] hover:text-white/90",
  );

  const content = (
    <>
      <span className="flex items-center gap-3">
        <Icon className={cn("size-4 shrink-0", active && "text-emerald-400")} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </span>
      {setupHint ? (
        <span className="dashboard-sidebar-muted pl-7 text-[11px] leading-snug font-normal">
          {setupHint}
        </span>
      ) : null}
    </>
  );

  if (item.external || item.href.startsWith("mailto:")) {
    return (
      <li>
        <a
          href={item.href}
          className={className}
          target={item.href.startsWith("mailto:") ? undefined : "_blank"}
          rel={item.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          onClick={onNavigate}
        >
          {content}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link href={item.href} className={className} onClick={onNavigate}>
        {content}
      </Link>
    </li>
  );
}
