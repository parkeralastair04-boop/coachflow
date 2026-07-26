import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LandPlot } from "lucide-react";
import { MarketingScreenshot } from "@/components/marketing/marketing-screenshot";
import { MARKETING_HERO } from "@/lib/marketing-homepage";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HERO_STATS = [
  { value: "Squads", label: "Active Squad & registers" },
  { value: "Sessions", label: "Training & parent bookings" },
  { value: "Families", label: "Portal & communication" },
] as const;

export function MarketingHero() {
  const hero = MARKETING_HERO;

  return (
    <section className="marketing-pitch-hero relative min-h-[100svh] overflow-hidden bg-[#030a09] text-white">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(52,211,153,0.22),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(251,191,36,0.08),transparent_50%)]" />
        <div className="absolute inset-0 tactical-grid opacity-[0.14]" />
        <div className="marketing-pitch-lines absolute inset-0 opacity-70" />
        <Image
          src={hero.photo.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-[0.18] mix-blend-luminosity"
        />
      </div>

      <div className="relative mx-auto flex min-h-[100svh] max-w-[92rem] flex-col px-5 pb-10 pt-28 sm:px-8 sm:pb-14 sm:pt-32 lg:px-12">
        <div className="grid flex-1 items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 xl:gap-20">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5">
              <LandPlot className="text-accent size-4" aria-hidden />
              <span className="text-[11px] font-bold tracking-[0.28em] uppercase text-emerald-300/90">
                {hero.eyebrow}
              </span>
            </div>

            <h1 className="mt-6 text-[2.65rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-[4.5rem]">
              {hero.headline}
              <span className="mt-2 block text-emerald-400">{hero.headlineAccent}</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">
              {hero.subhead}
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={hero.primaryCta.href}
                className={cn(
                  buttonVariants({ variant: "accent", size: "lg" }),
                  "min-h-12 px-8 text-base font-semibold shadow-[0_0_40px_-8px_rgba(52,211,153,0.55)]",
                )}
              >
                {hero.primaryCta.label}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href={hero.secondaryCta.href}
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "min-h-12 border-white/20 bg-white/[0.04] px-8 text-base text-white hover:bg-white/10",
                )}
              >
                {hero.secondaryCta.label}
              </Link>
            </div>

            <dl className="mt-12 grid gap-4 border-t border-white/10 pt-8 sm:grid-cols-3">
              {HERO_STATS.map((stat) => (
                <div key={stat.value}>
                  <dt className="text-emerald-400/90 text-sm font-semibold">{stat.value}</dt>
                  <dd className="mt-1 text-xs leading-relaxed text-white/45">{stat.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="marketing-stadium-frame relative rounded-[1.75rem] border border-white/10 bg-[#071210]/80 p-3 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:p-4">
              <div className="pointer-events-none absolute -inset-px rounded-[1.75rem] bg-gradient-to-b from-emerald-500/20 via-transparent to-transparent opacity-60" aria-hidden />
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-[10px] font-bold tracking-[0.24em] text-white/40 uppercase">
                  Live Academy Pulse
                </p>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-400/80">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden />
                  Demo data
                </span>
              </div>
              <MarketingScreenshot
                src={hero.screenshot.src}
                alt={hero.screenshot.alt}
                captureRoute={hero.screenshot.captureRoute}
                priority
                className="rounded-xl"
              />
            </div>

            <div className="absolute -bottom-6 -left-2 hidden max-w-[11rem] rounded-2xl border border-white/10 bg-[#071210]/90 p-4 shadow-2xl backdrop-blur-md lg:block">
              <p className="text-[10px] font-bold tracking-[0.2em] text-emerald-400/80 uppercase">
                On the touchline
              </p>
              <p className="mt-1 text-sm font-medium text-white/85">
                Coaching first. Admin handled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
