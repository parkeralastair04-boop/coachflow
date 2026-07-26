import { DemoFeatureDiscovery } from "@/components/demo-feature-discovery";
import { AlertBanner } from "@/components/ui/dialog";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TYPE } from "@/lib/ui/tokens";
import { cn } from "@/lib/utils";

export default function DemoBillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className={TYPE.pageTitle}>Billing</h1>
        <p className={cn(TYPE.description, "mt-1")}>
          Entitlements showcase — demo mode never opens live Stripe Checkout.
        </p>
      </div>
      <DemoFeatureDiscovery page="billing" />
      <AlertBanner tone="warning">
        Demo billing is read-only. Manage plan and Start coaching free are disabled for this
        experience so no cards are charged.
      </AlertBanner>
      <Card>
        <CardHeader>
          <CardTitle>Current plan · Academy (demo)</CardTitle>
          <CardDescription>
            Complimentary showcase entitlement. Camps, automations, finance, and the public
            website are unlocked for exploration.
          </CardDescription>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            <li>Unlimited players & sessions</li>
            <li>Academy website & camps</li>
            <li>Family portal & shared reports</li>
            <li>Sample analytics widgets</li>
          </ul>
        </CardHeader>
      </Card>
    </div>
  );
}
