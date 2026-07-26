import Link from "next/link";
import { LandPlot } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PitchSurface } from "@/components/football/pitch-surface";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type AuthCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
};

/** Branded sign-in / sign-up card with stadium lighting and pitch motifs. */
export function AuthCard({ title, description, children, className }: AuthCardProps) {
  return (
    <div className="mesh-gradient flex min-h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 sm:py-16">
        <Link href="/" className="mb-10 inline-flex" aria-label="Awarix home">
          <BrandLogo size="auth" priority />
        </Link>

        <PitchSurface
          variant="hero"
          className={cn(
            "football-auth-card page-content-enter w-full max-w-md rounded-2xl p-8 sm:p-10",
            className,
          )}
        >
          <div className="pointer-events-none absolute inset-0 tactical-grid opacity-[0.14]" aria-hidden />

          <div className="relative">
            <div className="mb-6 flex items-center gap-2">
              <LandPlot className="text-accent size-4" aria-hidden />
              <p className="text-accent text-[11px] font-bold tracking-[0.24em] uppercase">
                Football intelligence
              </p>
            </div>
            <h1 className={TYPE.pageTitle}>{title}</h1>
            <p className={cn(TYPE.description, "mt-2")}>{description}</p>
            <div className="mt-8">{children}</div>
          </div>
        </PitchSurface>
      </div>
    </div>
  );
}
