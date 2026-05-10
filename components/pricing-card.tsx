import Link from "next/link";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type PricingCardProps = {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  ctaHref?: string;
  ctaLabel?: string;
  cta?: ReactNode;
};

export function PricingCard({
  name,
  price,
  period = "/month",
  description,
  features,
  highlighted,
  ctaHref = "/signup",
  ctaLabel = "Start trial",
  cta,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "glass-panel relative flex flex-col rounded-2xl p-8",
        highlighted &&
          "border-accent/40 ring-accent/30 shadow-[0_0_0_1px_rgba(16,185,129,0.2)] ring-2",
      )}
    >
      {highlighted ? (
        <span className="bg-accent/15 text-accent mb-4 inline-flex w-fit rounded-full px-3 py-1 text-xs font-medium ring-1 ring-accent/30">
          Most popular
        </span>
      ) : null}
      <h3 className="text-lg font-semibold">{name}</h3>
      <p className="text-muted mt-2 text-sm">{description}</p>
      <p className="mt-6 flex items-baseline gap-1">
        <span className="text-4xl font-semibold tracking-tight">{price}</span>
        <span className="text-muted text-sm">{period}</span>
      </p>
      <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm">
        {features.map((f) => (
          <li key={f} className="flex gap-3">
            <Check
              className="text-accent mt-0.5 size-4 shrink-0"
              strokeWidth={2.5}
              aria-hidden
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {cta ? (
        <div className="mt-8">{cta}</div>
      ) : (
        <Link
          href={ctaHref}
          className={cn(
            "mt-8 inline-flex h-11 items-center justify-center rounded-full text-center text-sm font-medium transition-opacity",
            highlighted
              ? "bg-accent text-white hover:opacity-90"
              : "bg-foreground text-background hover:opacity-90 dark:bg-white dark:text-black",
          )}
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
