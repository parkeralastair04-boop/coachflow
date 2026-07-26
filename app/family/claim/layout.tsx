import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { LAYOUT } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

/** Public claim shell — no session required. */
export default function FamilyClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mesh-gradient min-h-full">
      <header className="football-family-header sticky top-0 z-30 backdrop-blur-xl">
        <div className={cn(LAYOUT.pageMax, "flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6")}>
          <Link href="/" className="inline-flex" aria-label="Awarix home">
            <BrandLogo size="auth" />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}
