"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  CreditCard,
  HelpCircle,
  LogOut,
  UserRound,
} from "lucide-react";
import { signOutAndRedirect } from "@/lib/auth/sign-out-client";
import { supportMailto } from "@/lib/help-support";
import { cn } from "@/lib/utils";

type AccountMenuVariant = "coach" | "family";

type MenuItem = {
  href: string;
  label: string;
  icon: typeof UserRound;
  external?: boolean;
};

type UserAccountMenuProps = {
  email?: string | null;
  variant?: AccountMenuVariant;
  /** Sidebar footer uses full-width trigger; header uses compact pill. */
  layout?: "header" | "sidebar";
  className?: string;
};

function buildMenuItems(variant: AccountMenuVariant): MenuItem[] {
  if (variant === "family") {
    return [
      { href: "/family/manage", label: "Profile", icon: UserRound },
      { href: "/family/manage#payments", label: "Billing", icon: CreditCard },
      {
        href: supportMailto("Awarix parent support"),
        label: "Help",
        icon: HelpCircle,
        external: true,
      },
    ];
  }

  return [
    { href: "/dashboard/settings/account", label: "Profile", icon: UserRound },
    { href: "/dashboard/academy", label: "Academy Settings", icon: Building2 },
    { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
    { href: "/dashboard/help", label: "Help", icon: HelpCircle },
  ];
}

function displayNameFromEmail(email: string | null | undefined): string {
  const trimmed = email?.trim();
  if (!trimmed) return "Account";
  const local = trimmed.split("@")[0]?.trim();
  return local || "Account";
}

function initialsFromEmail(email: string | null | undefined): string {
  const label = displayNameFromEmail(email);
  const parts = label.split(/[.\-_]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export function UserAccountMenu({
  email = null,
  variant = "coach",
  layout = "header",
  className,
}: UserAccountMenuProps) {
  const pathname = usePathname();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const items = buildMenuItems(variant);
  const displayName = displayNameFromEmail(email);
  const initials = initialsFromEmail(email);
  const signOutRedirect = variant === "family" ? "/login?next=/family" : "/";

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        close();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutAndRedirect(signOutRedirect);
    } finally {
      setSigningOut(false);
    }
  }

  const triggerClassName =
    layout === "sidebar"
      ? "text-muted hover:text-foreground hover:bg-surface-hover flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors"
      : "border-border bg-background/80 hover:bg-surface-hover text-foreground inline-flex max-w-[14rem] items-center gap-2 rounded-full border py-1.5 pr-2 pl-1.5 text-sm font-medium transition-colors";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span
          className={cn(
            "bg-accent/15 text-accent ring-accent/25 inline-flex shrink-0 items-center justify-center rounded-full ring-1",
            layout === "sidebar" ? "size-8 text-xs font-semibold" : "size-8 text-xs font-semibold",
          )}
          aria-hidden
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1 truncate">{displayName}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account menu"
          className={cn(
            "border-border bg-background absolute z-50 min-w-[15rem] overflow-hidden rounded-2xl border py-1 shadow-xl",
            layout === "sidebar"
              ? "bottom-full left-0 mb-2 w-full"
              : "top-full right-0 mt-2",
          )}
        >
          {email ? (
            <p className="text-muted border-border border-b px-3 py-2 text-xs leading-snug">
              {email}
            </p>
          ) : null}

          {items.map((item) => {
            const Icon = item.icon;
            const active =
              !item.external &&
              (pathname === item.href ||
                pathname.startsWith(`${item.href.split("#")[0]}/`));

            const className = cn(
              "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition-colors",
              active
                ? "bg-accent/10 text-foreground"
                : "text-muted hover:bg-surface-hover hover:text-foreground",
            );

            if (item.external) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  className={className}
                  onClick={close}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </a>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={className}
                onClick={close}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}

          <div className="border-border my-1 border-t" role="separator" />

          <button
            type="button"
            role="menuitem"
            className="text-muted hover:bg-surface-hover hover:text-foreground flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition-colors disabled:opacity-60"
            disabled={signingOut}
            onClick={() => void handleSignOut()}
          >
            <LogOut className="size-4 shrink-0" aria-hidden />
            {signingOut ? "Signing out…" : "Sign Out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
