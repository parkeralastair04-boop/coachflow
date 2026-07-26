"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/icon";
import { SUPPORT_EMAIL } from "@/lib/help-support";
import { cn } from "@/lib/utils";

type NavbarProps = {
  className?: string;
  variant?: "marketing" | "minimal";
};

const MARKETING_LINKS = [
  { href: "/#product", label: "Product", hash: "product" },
  { href: "/#testimonials", label: "Coaches", hash: "testimonials" },
  { href: "/#pricing", label: "Pricing", hash: "pricing" },
  { href: "/#faq", label: "FAQ", hash: "faq" },
  { href: "/demo", label: "Demo", hash: null },
] as const;

export function Navbar({ className, variant = "marketing" }: NavbarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 8);
        if (Math.abs(y - lastY) > 6) {
          setHidden(y > lastY && y > 96);
          lastY = y;
        }
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-xl transition-[transform,background-color,border-color] duration-200 ease-out",
        pathname === "/" && !scrolled
          ? "border-transparent bg-transparent"
          : "border-border/80 bg-background/85",
        scrolled && pathname === "/" && "border-emerald-500/15 bg-[#030712]/85",
        scrolled && pathname !== "/" && "border-emerald-500/10 shadow-[0_8px_30px_rgba(5,150,105,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        hidden && !mobileOpen && "-translate-y-full",
        className,
      )}
    >
      <nav className="mx-auto flex min-h-[4.75rem] max-w-6xl items-center justify-between px-4 py-1.5 sm:min-h-[5.5rem] sm:px-6 sm:py-2 lg:px-8">
        <Link
          href="/"
          className="inline-flex items-center leading-none"
          aria-label="Awarix home"
        >
          <BrandLogo size="navbarResponsive" priority />
        </Link>

        {variant === "marketing" ? (
          <>
            <ul className="hidden items-center gap-8 text-sm md:flex">
              {MARKETING_LINKS.map((link) => {
                const active =
                  link.hash === null
                    ? pathname === "/pricing" || pathname.startsWith("/pricing/")
                    : pathname === "/";
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={cn(
                        "nav-link-underline relative pb-1 transition-colors duration-200",
                        pathname === "/" && !scrolled
                          ? "text-white/70 hover:text-white"
                          : "text-muted hover:text-foreground",
                        active &&
                          (pathname === "/" && !scrolled
                            ? "text-white nav-link-active"
                            : "text-foreground nav-link-active"),
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <Link
                href="/login"
                className={cn(
                  "hidden text-sm transition-colors duration-200 sm:inline",
                  pathname === "/" && !scrolled
                    ? "text-white/70 hover:text-white"
                    : "text-muted hover:text-foreground",
                )}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ variant: "primary", size: "sm" }),
                  "hidden shadow-sm sm:inline-flex",
                  pathname === "/" && !scrolled && "bg-white text-[#030712] hover:brightness-95",
                )}
              >
                Start coaching free
              </Link>
              <button
                type="button"
                className={buttonVariants({
                  variant: "ghost",
                  size: "icon",
                  shape: "soft",
                  className: "text-muted md:hidden",
                })}
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav"
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                onClick={() => setMobileOpen((open) => !open)}
              >
                {mobileOpen ? (
                  <AppIcon icon={X} size="md" />
                ) : (
                  <AppIcon icon={Menu} size="md" />
                )}
              </button>
            </div>
          </>
        ) : (
          <span className="text-muted text-sm">Dashboard</span>
        )}
      </nav>

      {variant === "marketing" ? (
        <div
          id="mobile-nav"
          className={cn(
            "border-border bg-background/95 overflow-hidden border-t backdrop-blur-xl md:hidden",
            "transition-[max-height,opacity] duration-200 ease-out",
            mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0",
          )}
          hidden={!mobileOpen}
        >
          <ul className="flex flex-col gap-1 px-4 py-4">
            {MARKETING_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:bg-surface-hover flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Awarix demo request")}`}
                className="hover:bg-surface-hover flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors"
              >
                Book a walkthrough
              </a>
            </li>
            <li>
              <Link
                href="/demo"
                className="hover:bg-surface-hover flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Explore live academy
              </Link>
            </li>
            <li>
              <Link
                href="/login"
                className="hover:bg-surface-hover flex min-h-11 items-center rounded-xl px-3 text-sm font-medium transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
            </li>
            <li className="pt-2">
              <Link
                href="/signup"
                className={buttonVariants({
                  variant: "primary",
                  className: "w-full",
                })}
                onClick={() => setMobileOpen(false)}
              >
                Start coaching free
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </header>
  );
}
