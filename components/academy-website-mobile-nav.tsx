"use client";

import { useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { AcademyWebsiteNavLink } from "@/components/academy-website-nav-link";
import type { AcademyWebsiteNavItem } from "@/lib/academy-website";
import { cn } from "@/lib/utils";

type AcademyWebsiteMobileNavProps = {
  academyName: string;
  items: AcademyWebsiteNavItem[];
  bookHref: string;
  parentLoginHref: string;
};

export function AcademyWebsiteMobileNav({
  academyName,
  items,
  bookHref,
  parentLoginHref,
}: AcademyWebsiteMobileNavProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="relative">
      <button
        type="button"
        className="border-border focus-visible:ring-accent/40 inline-flex size-11 items-center justify-center rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : `Open ${academyName} menu`}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      {open ? (
        <div
          id={panelId}
          className="border-border absolute right-0 z-50 mt-2 w-[min(100vw-2rem,18rem)] rounded-2xl border bg-[var(--background)] p-3 shadow-lg"
          role="dialog"
          aria-label={`${academyName} navigation`}
        >
          <nav aria-label="Mobile academy">
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id}>
                  {item.href ? (
                    <AcademyWebsiteNavLink
                      href={item.href}
                      exact={item.id === "home"}
                      onNavigate={() => setOpen(false)}
                      className={cn(
                        "focus-visible:ring-accent/40 flex min-h-11 items-center rounded-xl px-3 text-sm font-medium outline-none focus-visible:ring-2",
                        item.id === "book" && "bg-accent text-accent-foreground",
                      )}
                      activeClassName={
                        item.id === "book"
                          ? "ring-2 ring-offset-2 ring-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
                          : "bg-black/[0.05] dark:bg-white/[0.08]"
                      }
                    >
                      {item.label}
                    </AcademyWebsiteNavLink>
                  ) : null}
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-3 grid gap-2 border-t border-[color-mix(in_srgb,var(--academy-secondary)_18%,transparent)] pt-3">
            <AcademyWebsiteNavLink
              href={bookHref}
              onNavigate={() => setOpen(false)}
              className="bg-accent text-accent-foreground focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              activeClassName="ring-2 ring-offset-2 ring-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
            >
              Book Training
            </AcademyWebsiteNavLink>
            <AcademyWebsiteNavLink
              href={parentLoginHref}
              onNavigate={() => setOpen(false)}
              className="border-border focus-visible:ring-accent/40 inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              activeClassName="bg-black/[0.05] dark:bg-white/[0.08]"
            >
              Parent Login
            </AcademyWebsiteNavLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
