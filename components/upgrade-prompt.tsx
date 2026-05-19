import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import type { PlanId } from "@/lib/billing";
import {
  getPlanDisplayName,
  getPrimaryDefinitionForGateFeature,
  type FeatureKey,
} from "@/lib/feature-definitions";
import { cn } from "@/lib/utils";

type UpgradePromptProps = {
  feature: FeatureKey;
  title?: string;
  description?: string;
  benefits?: readonly string[];
  currentPlan?: PlanId | null;
  requiredPlan?: PlanId;
  className?: string;
};

export function UpgradePrompt({
  feature,
  title,
  description,
  benefits,
  currentPlan = "starter",
  requiredPlan,
  className,
}: UpgradePromptProps) {
  const definition = getPrimaryDefinitionForGateFeature(feature);
  const resolvedTitle = title ?? definition.title;
  const resolvedRequired = requiredPlan ?? definition.minimumPlan;
  const resolvedBenefits = benefits ?? definition.benefits;
  const currentLabel = getPlanDisplayName(currentPlan ?? "starter");
  const requiredLabel = getPlanDisplayName(resolvedRequired);

  return (
    <div
      className={cn(
        "glass-panel flex w-full flex-col gap-6 rounded-2xl p-8 sm:p-10",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="bg-accent/12 ring-accent/25 flex size-14 shrink-0 items-center justify-center rounded-2xl ring-1">
          <Sparkles className="text-accent size-7" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">{resolvedTitle}</h2>
          {description ? (
            <p className="text-muted text-sm leading-relaxed">{description}</p>
          ) : null}
        </div>
      </div>

      <ul className="space-y-2.5">
        {resolvedBenefits.map((benefit) => (
          <li
            key={benefit}
            className="text-muted flex items-start gap-2.5 text-sm leading-relaxed"
          >
            <span className="bg-accent mt-1.5 size-1.5 shrink-0 rounded-full" aria-hidden />
            {benefit}
          </li>
        ))}
      </ul>

      <div className="border-border flex flex-col gap-3 rounded-xl border bg-black/[0.02] p-4 text-sm dark:bg-white/[0.03] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted text-xs font-medium tracking-wide uppercase">
            Your plan
          </p>
          <p className="mt-0.5 font-semibold">{currentLabel}</p>
        </div>
        <div className="hidden text-muted sm:block" aria-hidden>
          →
        </div>
        <div>
          <p className="text-muted text-xs font-medium tracking-wide uppercase">
            Required plan
          </p>
          <p className="text-accent mt-0.5 font-semibold">{requiredLabel}</p>
        </div>
      </div>

      <Link
        href="/pricing"
        className="bg-accent hover:opacity-90 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-medium text-white transition-opacity sm:w-auto sm:px-8"
      >
        View plans & upgrade
        <ArrowUpRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
