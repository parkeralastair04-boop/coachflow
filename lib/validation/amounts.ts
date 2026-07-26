export { MIN_SUBSCRIPTION_AMOUNT_PENCE } from "./constants";

import { MIN_SUBSCRIPTION_AMOUNT_PENCE } from "./constants";

export function isValidSubscriptionAmount(amount: number): boolean {
  return Number.isFinite(amount) && amount >= MIN_SUBSCRIPTION_AMOUNT_PENCE;
}
