import Link from "next/link";
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
        "border-black/[0.06] bg-background/75 dark:border-white/[0.08] dark:bg-background/70",
        className,
      )}
    >
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/35">
            <span className="text-sm font-bold text-accent">CF</span>
          </span>
          <span>CoachFlow</span>
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
            <div className="flex items-center gap-3">
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
