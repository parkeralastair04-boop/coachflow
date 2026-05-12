import type { FeatureKey } from "@/lib/subscription";
import { hasFeatureAccess } from "@/lib/subscription";
import { UpgradePrompt } from "@/components/upgrade-prompt";

type FeatureGateProps = {
  feature: FeatureKey;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export async function FeatureGate({
  feature,
  title,
  description,
  children,
}: FeatureGateProps) {
  const allowed = await hasFeatureAccess(feature);
  if (!allowed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center py-12">
        <UpgradePrompt
          title={title}
          description={
            description ??
            "This capability is included on a higher CoachFlow plan. Compare options and upgrade when you are ready."
          }
          className="w-full max-w-lg"
        />
      </div>
    );
  }
  return <>{children}</>;
}
