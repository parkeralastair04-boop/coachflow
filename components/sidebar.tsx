"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown, Lock, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  DASHBOARD_NAV_SECTIONS,
  SIDEBAR_STORAGE_KEY,
  findSectionIdForPath,
  getDefaultSectionState,
  isNavItemActive,
  type DashboardNavItem,
  type DashboardNavSection,
} from "@/lib/dashboard-nav";
import type { AcademyBranding } from "@/lib/academy-shared";
import type { FeatureKey } from "@/lib/subscription";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type SidebarProps = {
  academy?: AcademyBranding | null;
  enabledFeatures: FeatureKey[];
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
  onNavigate,
  mobileHeader,
}: SidebarProps) {
  const pathname = usePathname();
  const enabledSet = useMemo(() => new Set(enabledFeatures), [enabledFeatures]);

  const [storedSections, setStoredSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    return readStoredSections() ?? {};
  });

  const openSections = useMemo(() => {
    const merged = { ...getDefaultSectionState(pathname), ...storedSections };
    const activeSectionId = findSectionIdForPath(pathname);
    if (activeSectionId) merged[activeSectionId] = true;
    return merged;
  }, [pathname, storedSections]);

  const toggleSection = useCallback(
    (sectionId: string) => {
      setStoredSections((prev) => {
        const current = { ...getDefaultSectionState(pathname), ...prev };
        const activeSectionId = findSectionIdForPath(pathname);
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
    [pathname],
  );

  function hasFeatureAccess(feature?: FeatureKey): boolean {
    if (!feature) return true;
    return enabledSet.has(feature);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <aside className="glass-panel flex h-full w-full flex-col border-r border-black/[0.06] dark:border-white/[0.08] lg:fixed lg:inset-y-0 lg:w-60">
      <div className="flex min-h-[4.5rem] items-center gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.08] lg:min-h-[5rem]">
        <Link
          href="/dashboard"
          className="inline-flex min-w-0 flex-1 items-center"
          aria-label="CoachFlow dashboard"
          onClick={onNavigate}
        >
          <BrandLogo
            src={academy?.logo_url ?? "/logo.png"}
            alt={academy?.name ?? "CoachFlow"}
            size="sidebar"
            priority
          />
        </Link>
        {mobileHeader}
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Dashboard">
        <ul className="space-y-2">
          {DASHBOARD_NAV_SECTIONS.map((section) => (
            <NavSection
              key={section.id}
              section={section}
              pathname={pathname}
              isOpen={openSections[section.id] ?? false}
              onToggle={() => toggleSection(section.id)}
              hasFeatureAccess={hasFeatureAccess}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>

      <div className="border-t border-black/[0.06] p-3 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-muted hover:text-foreground flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function NavSection({
  section,
  pathname,
  isOpen,
  onToggle,
  hasFeatureAccess,
  onNavigate,
}: {
  section: DashboardNavSection;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  hasFeatureAccess: (feature?: FeatureKey) => boolean;
  onNavigate?: () => void;
}) {
  const SectionIcon = section.icon;
  const sectionActive = section.items.some((item) => isNavItemActive(pathname, item.href));

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold tracking-wide uppercase transition-colors",
          sectionActive
            ? "text-foreground"
            : "text-muted hover:text-foreground hover:bg-black/[0.03] dark:hover:bg-white/[0.05]",
        )}
      >
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1",
            sectionActive
              ? "bg-accent/12 text-accent ring-accent/25"
              : "bg-black/[0.03] text-muted ring-black/[0.06] dark:bg-white/[0.05] dark:ring-white/[0.08]",
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
          isOpen ? "max-h-[640px] opacity-100" : "max-h-0 opacity-0",
        )}
        aria-hidden={!isOpen}
      >
        {section.items.map((item) => (
          <NavItemLink
            key={`${section.id}-${item.href}-${item.label}`}
            item={item}
            pathname={pathname}
            locked={Boolean(item.feature && !hasFeatureAccess(item.feature))}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </li>
  );
}

function NavItemLink({
  item,
  pathname,
  locked,
  onNavigate,
}: {
  item: DashboardNavItem;
  pathname: string;
  locked: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item.href);

  const className = cn(
    "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-accent/12 text-foreground ring-1 ring-accent/25"
      : locked
        ? "text-muted/70 hover:bg-black/[0.03] hover:text-muted dark:hover:bg-white/[0.04]"
        : "text-muted hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]",
  );

  const content = (
    <>
      <Icon className={cn("size-4 shrink-0", active && "text-accent")} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {locked ? <Lock className="size-3.5 shrink-0 opacity-60" aria-hidden /> : null}
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
