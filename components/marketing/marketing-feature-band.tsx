import Image from "next/image";
import type { MarketingFeature } from "@/lib/marketing-homepage";
import { MarketingScreenshot } from "@/components/marketing/marketing-screenshot";
import { cn } from "@/lib/utils";

type MarketingFeatureBandProps = {
  feature: MarketingFeature;
};

export function MarketingFeatureBand({ feature }: MarketingFeatureBandProps) {
  const isDark = feature.tone === "dark";
  const photoFirst = feature.photoSide === "left";

  return (
    <section
      id={feature.id}
      className={cn(
        "scroll-mt-20 overflow-hidden",
        isDark ? "bg-[#030712] text-white" : "bg-background text-foreground",
      )}
      aria-labelledby={`${feature.id}-title`}
    >
      <div className="mx-auto max-w-[90rem]">
        <div
          className={cn(
            "grid min-h-0 lg:min-h-[36rem] lg:grid-cols-2",
            !photoFirst && "lg:[&>*:first-child]:order-2",
          )}
        >
          {/* Photography column — full bleed on mobile, half on desktop */}
          <div className="relative min-h-[16rem] sm:min-h-[22rem] lg:min-h-full">
            <Image
              src={feature.photo.src}
              alt={feature.photo.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-center"
            />
            <div
              className={cn(
                "absolute inset-0",
                isDark
                  ? "bg-gradient-to-r from-[#030712]/20 to-[#030712]/80 lg:bg-gradient-to-r lg:from-transparent lg:to-[#030712]"
                  : "bg-gradient-to-r from-background/20 to-background/80 lg:bg-gradient-to-r lg:from-transparent lg:to-background",
              )}
              aria-hidden
            />
            <div className="absolute bottom-6 left-6 sm:bottom-8 sm:left-8 lg:hidden">
              <span className="text-accent text-[11px] font-bold tracking-[0.3em] uppercase">
                {feature.eyebrow}
              </span>
            </div>
          </div>

          {/* Content column */}
          <div
            className={cn(
              "flex flex-col justify-center px-5 py-14 sm:px-8 sm:py-16 lg:px-12 lg:py-20 xl:px-16",
              isDark ? "lg:border-l lg:border-white/[0.06]" : "lg:border-l lg:border-border",
            )}
          >
            <p
              className={cn(
                "text-[11px] font-bold tracking-[0.35em] uppercase",
                isDark ? "text-accent" : "text-accent",
              )}
            >
              <span className={cn(isDark ? "text-white/30" : "text-muted", "mr-3 font-mono")}>
                {feature.number}
              </span>
              {feature.eyebrow}
            </p>
            <h2
              id={`${feature.id}-title`}
              className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.08]"
            >
              {feature.title}
            </h2>
            <p
              className={cn(
                "mt-4 max-w-lg text-base leading-relaxed sm:text-lg",
                isDark ? "text-white/65" : "text-muted",
              )}
            >
              {feature.description}
            </p>
            <ul className="mt-8 space-y-3">
              {feature.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className={cn(
                    "flex items-start gap-3 text-sm sm:text-base",
                    isDark ? "text-white/80" : "text-foreground/85",
                  )}
                >
                  <span
                    className="bg-accent mt-2 size-1.5 shrink-0 rounded-full"
                    aria-hidden
                  />
                  {bullet}
                </li>
              ))}
            </ul>

            <div className="mt-10 lg:mt-12">
              <MarketingScreenshot
                src={feature.screenshot.src}
                alt={feature.screenshot.alt}
                captureRoute={feature.screenshot.captureRoute}
                className="max-w-xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
