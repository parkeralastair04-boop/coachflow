"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  UserSquare2,
  FileText,
  CreditCard,
  Settings,
  LogOut,
  ClipboardList,
  Tent,
  Wallet,
  BarChart3,
  BellRing,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/automations", label: "Automations", icon: BellRing },
  { href: "/dashboard/players", label: "Players", icon: UserSquare2 },
  { href: "/dashboard/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/dashboard/reports", label: "Reports", icon: FileText },
  { href: "/dashboard/registers", label: "Registers", icon: ClipboardList },
  { href: "/dashboard/camps", label: "Camps", icon: Tent },
  { href: "/dashboard/payments", label: "Payments", icon: Wallet },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard#parents", label: "Parents", icon: Users },
  { href: "/dashboard#settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <aside className="glass-panel flex w-full flex-col border-r border-black/[0.06] dark:border-white/[0.08] lg:fixed lg:inset-y-0 lg:w-60">
      <div className="flex h-16 items-center gap-2 border-b border-black/[0.06] px-4 dark:border-white/[0.08] lg:h-20">
        <Link href="/dashboard" aria-label="CoachFlow dashboard">
          <BrandLogo className="h-14" priority />
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {nav.map(({ href, label, icon: Icon }) => {
          const base = href.split("#")[0] ?? href;
          const active =
            pathname === base ||
            (base !== "/dashboard" && pathname.startsWith(`${base}/`));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-accent/12 text-foreground ring-1 ring-accent/25"
                  : "text-muted hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.06]",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}
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
