# Awarix SaaS trial & abuse prevention

## Native Stripe trial

Every new paid Awarix plan (Starter, Pro, Academy) uses Stripe Checkout
`subscription_data.trial_period_days = 7` on the **existing** subscription Price
objects. There are no separate trial products.

- No charge is collected at checkout (card is collected for later).
- Stripe automatically starts billing when the trial ends unless cancelled.
- Customers cancel via the Stripe Billing Portal (`/dashboard/billing`).

Complimentary founder/beta accounts are unchanged and cannot start Checkout.

Existing paying subscribers are unchanged: Checkout only affects new subscription
sessions. Trial is only attached when the Stripe customer is trial-eligible.

## One trial per Stripe customer (server-side)

Enforced in `POST /api/stripe/create-checkout-session` (authenticated only):

1. Resolve or create a Stripe Customer **owned by** the signed-in user
   (`metadata.awarix_user_id`). Email alone never claims a customer.
2. Call `customerHasUsedTrial(customer)`:
   - If `customer.metadata.awarix_trial_used === "true"` → **no trial**.
   - Else list all subscriptions for that customer; if any has `trial_start` or
     `trial_end` → **no trial**.
3. Eligible customers get `trial_period_days: 7`.
4. Ineligible customers still get a normal paid subscription (no second trial).

After a trial subscription is created, the webhook marks
`customer.metadata.awarix_trial_used = "true"` via
`markStripeCustomerTrialUsed`.

Do **not** rely on client-side checks for eligibility. The Subscribe button only
displays messaging; the API decides whether to attach a trial.

## Entitlements during trial

Webhook handlers sync **server-owned** `public.coach_entitlements`:

- `plan_id` — starter | pro | academy
- `status` — `trialing` | `active` | `inactive` | `past_due` | `canceled`
- `trial_ends_at` — ISO timestamp when applicable
- Stripe customer / subscription ids

`getUserEntitlements()` / `getCurrentSubscription()` treat `trialing` as active
for feature gating, so trial users receive the same features as paid users on
that plan. See [entitlement-architecture.md](./entitlement-architecture.md).

## Helpers

- `getUserEntitlements()` — authoritative plan + status for gates.
- `getTrialStatus()` — billing UI (reads entitlements; optional Stripe display fallback).
- `assertStripePricesConfigured()` — fails checkout when price env vars are missing.

## Emails

There is no separate Awarix SaaS confirmation email path today. Parent booking
payment emails are unrelated and must not be duplicated for SaaS trials.
