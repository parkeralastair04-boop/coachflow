import { Fragment } from "react";
import { Check, Minus } from "lucide-react";
import { BILLING_PLANS, type PlanId } from "@/lib/billing";
import {
  isComparisonRowIncluded,
  PLAN_COMPARISON,
} from "@/lib/pricing-comparison";
import { cn } from "@/lib/utils";

const PLAN_IDS: PlanId[] = ["starter", "pro", "academy"];

function FeatureCell({ included }: { included: boolean }) {
  if (included) {
    return (
      <span className="inline-flex items-center justify-center" aria-label="Included">
        <span className="bg-accent/10 ring-accent/25 flex size-8 items-center justify-center rounded-full ring-1">
          <Check className="text-accent size-4" strokeWidth={2.5} aria-hidden />
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center justify-center" aria-label="Not included">
      <span className="text-muted/50 flex size-8 items-center justify-center">
        <Minus className="size-4" strokeWidth={2} aria-hidden />
      </span>
    </span>
  );
}

export function PricingComparisonTable() {
  const plans = PLAN_IDS.map((id) => BILLING_PLANS.find((plan) => plan.id === id)!);

  return (
    <section className="mt-20" aria-labelledby="pricing-comparison-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="pricing-comparison-heading"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Compare plans in detail
        </h2>
        <p className="text-muted mt-3 text-sm leading-relaxed sm:text-base">
          Every tier builds on the last. Upgrade when you need AI reports, automations,
          parent payments, or white-label academy branding.
        </p>
      </div>

      {/* Mobile: scrollable matrix */}
      <div className="mt-10 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 lg:hidden">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="bg-background/95 sticky left-0 z-20 min-w-[9.5rem] border-b border-black/[0.06] py-4 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted dark:border-white/[0.08]"
              >
                Feature
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className="border-b border-black/[0.06] px-3 py-4 text-center dark:border-white/[0.08]"
                >
                  <div className="flex flex-col items-center gap-1.5">
                    {plan.badge ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1",
                          plan.id === "pro"
                            ? "bg-accent/15 text-accent ring-accent/30"
                            : "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
                        )}
                      >
                        {plan.badge}
                      </span>
                    ) : (
                      <span className="h-[18px]" aria-hidden />
                    )}
                    <span className="text-foreground font-semibold">{plan.name}</span>
                    <span className="text-muted text-xs">
                      {plan.price}
                      <span className="font-normal">/mo</span>
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_COMPARISON.map((category) => (
              <Fragment key={category.name}>
                <tr>
                  <th
                    colSpan={4}
                    scope="colgroup"
                    className="bg-black/[0.02] px-0 pb-2 pt-8 text-left text-xs font-semibold uppercase tracking-wide text-foreground first:pl-0 dark:bg-white/[0.03]"
                  >
                    {category.name}
                  </th>
                </tr>
                {category.rows.map((row) => (
                  <tr
                    key={`${category.name}-${row.label}`}
                    className="border-b border-black/[0.04] dark:border-white/[0.06]"
                  >
                    <th
                      scope="row"
                      className="bg-background/95 sticky left-0 z-10 py-3.5 pr-4 text-left font-medium"
                    >
                      {row.label}
                    </th>
                    {PLAN_IDS.map((planId) => (
                      <td key={planId} className="px-3 py-3.5 text-center">
                        <FeatureCell included={isComparisonRowIncluded(planId, row)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Desktop: full-width table */}
      <div className="glass-panel mt-10 hidden overflow-hidden rounded-2xl lg:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
              <th
                scope="col"
                className="w-[28%] px-6 py-5 text-left text-xs font-medium uppercase tracking-wide text-muted"
              >
                Features
              </th>
              {plans.map((plan) => (
                <th
                  key={plan.id}
                  scope="col"
                  className={cn(
                    "px-4 py-5 text-center",
                    plan.highlighted && "bg-accent/[0.04]",
                  )}
                >
                  <div className="flex flex-col items-center gap-2">
                    {plan.badge ? (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-3 py-1 text-xs font-medium ring-1",
                          plan.id === "pro"
                            ? "bg-accent/15 text-accent ring-accent/30"
                            : "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
                        )}
                      >
                        {plan.badge}
                      </span>
                    ) : null}
                    <span className="text-lg font-semibold tracking-tight">{plan.name}</span>
                    <span className="text-muted flex items-baseline gap-0.5">
                      <span className="text-foreground text-2xl font-semibold">
                        {plan.price}
                      </span>
                      <span className="text-xs">/month</span>
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PLAN_COMPARISON.map((category) => (
              <Fragment key={category.name}>
                <tr>
                  <th
                    colSpan={4}
                    scope="colgroup"
                    className="bg-black/[0.02] px-6 pb-2 pt-8 text-left text-xs font-semibold uppercase tracking-wide text-foreground dark:bg-white/[0.03]"
                  >
                    {category.name}
                  </th>
                </tr>
                {category.rows.map((row, index) => (
                  <tr
                    key={`${category.name}-${row.label}`}
                    className={cn(
                      "border-b border-black/[0.04] dark:border-white/[0.06]",
                      index === category.rows.length - 1 && "last:border-0",
                    )}
                  >
                    <th scope="row" className="px-6 py-4 text-left font-medium">
                      {row.label}
                    </th>
                    {PLAN_IDS.map((planId) => {
                      const plan = plans.find((item) => item.id === planId)!;
                      return (
                        <td
                          key={planId}
                          className={cn(
                            "px-4 py-4 text-center",
                            plan.highlighted && "bg-accent/[0.03]",
                          )}
                        >
                          <FeatureCell included={isComparisonRowIncluded(planId, row)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
