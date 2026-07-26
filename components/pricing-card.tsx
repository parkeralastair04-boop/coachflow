import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { TrialPricingPerks } from "@/components/trial-pricing-perks";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppIcon } from "@/components/ui/icon";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

type PricingCardProps = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
  ctaHref?: string;
  ctaLabel?: string;
  cta?: ReactNode;
  showTrialPerks?: boolean;
  className?: string;
};

export function PricingCard({
  name,
  price,
  period = "/month",
  description,
  features,
  highlighted,
  badge,
  ctaHref = "/signup",
  ctaLabel = "Start coaching free",
  cta,
  showTrialPerks = true,
  className,
}: PricingCardProps) {
  return (
    <Card
      variant="interactive"
      className={cn(
        "relative flex h-full flex-col p-8",
        highlighted &&
          "border-accent/40 ring-accent/30 shadow-[0_0_0_1px_rgba(16,185,129,0.2)] ring-2",
        className,
      )}
    >
      <div className="min-h-[1.75rem]">
        {badge || highlighted ? (
          <span
            className={cn(
              "inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ring-1",
              highlighted || badge === "Most chosen"
                ? "bg-accent/15 text-accent ring-accent/30"
                : "bg-black/[0.04] text-foreground ring-black/[0.08] dark:bg-white/[0.06] dark:ring-white/[0.1]",
            )}
          >
            {badge ?? "Most chosen"}
          </span>
        ) : null}
      </div>
      <h3 className={cn(TYPE.sectionTitle, "mt-4 text-xl")}>{name}</h3>
      <p className={cn(TYPE.description, "mt-2 min-h-[2.75rem]")}>{description}</p>
      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        <span className="text-muted text-sm">{period}</span>
      </p>
      {showTrialPerks ? <TrialPricingPerks /> : null}
      <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-3">
            <AppIcon icon={Check} size="sm" className="text-accent mt-0.5" />
            <span className="leading-snug">{f}</span>
          </li>
        ))}
      </ul>
      {cta ? (
        <div className="mt-8">{cta}</div>
      ) : (
        <Link
          href={ctaHref}
          className={buttonVariants({
            variant: highlighted ? "accent" : "primary",
            className: "mt-8 w-full",
          })}
        >
          {ctaLabel}
        </Link>
      )}
    </Card>
  );
}
