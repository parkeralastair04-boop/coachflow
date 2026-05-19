import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type NavbarProps = {
  className?: string;
  variant?: "marketing" | "minimal";
};

export function Navbar({ className, variant = "marketing" }: NavbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b backdrop-blur-xl",
        "border-border bg-background/80",
        className,
      )}
    >
      <nav className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-4 py-2 sm:min-h-[5.5rem] sm:px-6 sm:py-3 lg:px-8">
        <Link href="/" className="inline-flex items-center" aria-label="CoachFlow home">
          <BrandLogo size="navbarResponsive" priority />
        </Link>

        {variant === "marketing" ? (
          <>
            <ul className="hidden items-center gap-8 text-sm text-muted md:flex">
              <li>
                <a className="hover:text-foreground transition-colors" href="#features">
                  Features
                </a>
              </li>
              <li>
                <a className="hover:text-foreground transition-colors" href="#pricing">
                  Pricing
                </a>
              </li>
            </ul>
            <div className="flex items-center gap-2 sm:gap-3">
              <ThemeToggle />
              <Link
                href="/login"
                className="text-muted hover:text-foreground hidden text-sm transition-colors sm:inline"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="bg-foreground text-background hover:opacity-90 inline-flex items-center rounded-full px-4 py-2 text-sm font-medium shadow-sm transition-opacity"
              >
                Get started
              </Link>
            </div>
          </>
        ) : (
          <span className="text-muted text-sm">Dashboard</span>
        )}
      </nav>
    </header>
  );
}
