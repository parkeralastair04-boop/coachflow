import { Fragment } from "react";
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
      <span className="text-accent inline-flex items-center justify-center text-sm font-medium whitespace-nowrap">
        ✓ Included
      </span>
    );
  }

  return (
    <span className="text-muted/70 inline-flex items-center justify-center text-sm whitespace-nowrap">
      — Not included
    </span>
  );
}

export function PricingComparisonTable() {
  const plans = PLAN_IDS.map((id) => BILLING_PLANS.find((plan) => plan.id === id)!);

  return (
    <section className="mt-24" aria-labelledby="pricing-comparison-heading">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          id="pricing-comparison-heading"
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          Compare every feature
        </h2>
        <p className="text-muted mt-3 text-sm leading-relaxed sm:text-base">
          Built from what Awarix ships today — not a wishlist. Upgrade when you need
          AI reports, parent payments, or a public academy website.
        </p>
      </div>

      <div className="mt-10 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="glass-panel inline-block min-w-full overflow-hidden rounded-2xl sm:block">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] dark:border-white/[0.08]">
                <th
                  scope="col"
                  className="bg-background/95 sticky left-0 z-20 min-w-[11rem] px-4 py-5 text-left text-xs font-medium tracking-wide text-muted uppercase sm:px-6"
                >
                  Feature
                </th>
                {plans.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className={cn(
                      "min-w-[8.5rem] px-3 py-5 text-center sm:px-4",
                      plan.highlighted && "bg-accent/[0.04]",
                    )}
                  >
                    <div className="flex flex-col items-center gap-1.5">
                      {plan.badge ? (
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1",
                            plan.id === "pro"
                              ? "bg-accent/15 text-accent ring-accent/30"
                              : "bg-black/[0.04] text-foreground ring-black/[0.08] dark:bg-white/[0.06] dark:ring-white/[0.1]",
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
                      className="bg-black/[0.02] px-4 pb-2 pt-7 text-left text-xs font-semibold tracking-wide text-foreground uppercase sm:px-6 dark:bg-white/[0.03]"
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
                      <th
                        scope="row"
                        className="bg-background/95 sticky left-0 z-10 px-4 py-3.5 text-left font-medium sm:px-6"
                      >
                        {row.label}
                      </th>
                      {PLAN_IDS.map((planId) => {
                        const plan = plans.find((item) => item.id === planId)!;
                        return (
                          <td
                            key={planId}
                            className={cn(
                              "px-3 py-3.5 text-center sm:px-4",
                              plan.highlighted && "bg-accent/[0.03]",
                            )}
                          >
                            <FeatureCell
                              included={isComparisonRowIncluded(planId, row)}
                            />
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
      </div>
    </section>
  );
}
