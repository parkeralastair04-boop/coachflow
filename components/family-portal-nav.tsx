"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const FAMILY_LINKS = [
  { href: "/family", label: "Overview" },
  { href: "/family/manage", label: "Manage" },
] as const;

export function FamilyPortalNav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center gap-1 text-sm font-medium", className)} aria-label="Family">
      {FAMILY_LINKS.map((link) => {
        const active =
          link.href === "/family"
            ? pathname === "/family"
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-xl px-3 py-2 transition-colors",
              active
                ? "bg-accent/10 text-foreground"
                : "text-muted hover:text-foreground hover:bg-accent/8",
            )}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
