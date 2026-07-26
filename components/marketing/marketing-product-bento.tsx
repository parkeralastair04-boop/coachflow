import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { MarketingFeature } from "@/lib/marketing-homepage";
import { MarketingScreenshot } from "@/components/marketing/marketing-screenshot";
import { cn } from "@/lib/utils";

type MarketingProductBentoProps = {
  features: MarketingFeature[];
};

export function MarketingProductBento({ features }: MarketingProductBentoProps) {
  return (
    <section
      id="product"
      className="scroll-mt-20 bg-background px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
      aria-labelledby="product-bento-heading"
    >
      <div className="mx-auto max-w-[90rem]">
        <div className="max-w-2xl">
          <p className="text-accent text-[11px] font-bold tracking-[0.28em] uppercase">
            Intelligence
          </p>
          <h2
            id="product-bento-heading"
            className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl"
          >
            Built for coaches who develop players
          </h2>
          <p className="text-muted mt-4 text-base leading-relaxed sm:text-lg">
            Real Awarix screens from the live demo — AI reports, player insights, and academy ops. No mockups.
          </p>
        </div>

        <div className="mt-14 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:gap-5">
          {features.map((feature, index) => {
            const layout =
              index === 0
                ? "sm:col-span-2 lg:col-span-7 lg:row-span-2"
                : index === 1
                  ? "lg:col-span-5"
                  : index === 2
                    ? "lg:col-span-5"
                    : index === 3
                      ? "lg:col-span-4"
                      : index === 4
                        ? "lg:col-span-4"
                        : "lg:col-span-4";

            return (
              <article
                key={feature.id}
                id={feature.id}
                className={cn(
                  "marketing-bento-card group relative overflow-hidden rounded-[1.5rem] border border-border/80",
                  layout,
                  index === 0 ? "min-h-[28rem]" : "min-h-[18rem]",
                )}
              >
                <Image
                  src={feature.photo.src}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  className="object-cover object-center opacity-[0.22] transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-[#030712]/88 to-[#030712]/55" />

                <div className="relative flex h-full flex-col p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-accent text-[10px] font-bold tracking-[0.24em] uppercase">
                        {feature.eyebrow}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                        {feature.title}
                      </h3>
                    </div>
                    <span className="font-mono text-xs text-white/25">{feature.number}</span>
                  </div>

                  <p className="mt-3 max-w-md text-sm leading-relaxed text-white/60">
                    {feature.description}
                  </p>

                  <ul className="mt-4 space-y-2">
                    {feature.bullets.slice(0, 2).map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2 text-xs text-white/75">
                        <span className="bg-accent mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden />
                        {bullet}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-6">
                    <MarketingScreenshot
                      src={feature.screenshot.src}
                      alt={feature.screenshot.alt}
                      captureRoute={feature.screenshot.captureRoute}
                      className={cn(index === 0 ? "max-w-none" : "max-w-sm")}
                    />
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/demo"
            className="text-accent inline-flex items-center gap-2 text-sm font-semibold hover:underline"
          >
            Explore the full demo workspace
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
