import { Check } from "lucide-react";

const TRIAL_PERKS = [
  "7-day free trial",
  "Cancel anytime during your trial",
  "No payment today",
  "Charged automatically after trial",
] as const;

export function TrialPricingPerks() {
  return (
    <ul className="mt-4 flex flex-col gap-2 text-sm">
      {TRIAL_PERKS.map((perk) => (
        <li key={perk} className="text-muted flex gap-2">
          <Check className="text-accent mt-0.5 size-4 shrink-0" strokeWidth={2.5} aria-hidden />
          <span>{perk}</span>
        </li>
      ))}
    </ul>
  );
}
