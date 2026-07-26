import type { FeatureKey } from "@/lib/subscription";
import { getCurrentSubscription, planHasFeature } from "@/lib/subscription";
import { UpgradePrompt } from "@/components/upgrade-prompt";

type FeatureGateProps = {
  feature: FeatureKey;
  /** Optional override; defaults to copy from `FEATURE_DEFINITIONS`. */
  title?: string;
  description?: string;
  children: React.ReactNode;
};

export async function FeatureGate({
  feature,
  title,
  description,
  children,
}: FeatureGateProps) {
  const subscription = await getCurrentSubscription();
  const allowed = subscription
    ? planHasFeature(subscription.effectivePlan, feature)
    : false;

  if (!allowed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center py-12">
        <UpgradePrompt
          feature={feature}
          title={title}
          description={description}
          currentPlan={subscription?.effectivePlan ?? "starter"}
          className="max-w-lg"
        />
      </div>
    );
  }

  return <>{children}</>;
}
