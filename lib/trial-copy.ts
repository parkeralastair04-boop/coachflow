/** Client-safe trial copy helpers (no Stripe / server-only imports). */

export const TRIAL_PERIOD_DAYS = 7;

export function addTrialDays(from: Date, days = TRIAL_PERIOD_DAYS): Date {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatUkShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

export function formatUkLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

export function buildCheckoutTrialMessage(args: {
  monthlyPounds: number;
  firstPaymentDate: Date;
}): string {
  return `You won't be charged today. Your first payment of £${args.monthlyPounds}/month will be collected on ${formatUkShortDate(args.firstPaymentDate)} unless you cancel before then.`;
}
