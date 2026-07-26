# Awarix SaaS entitlement architecture

Stripe is the **source of truth** for paid Awarix subscriptions. Feature
access is resolved only from server-owned data — never from client-writable
Auth `user_metadata`.

## Source of truth

| Source | Role |
|--------|------|
| Stripe Subscription / Customer | Canonical paid, trial, canceled, past_due state |
| `public.coach_entitlements` | Server-owned mirror used by feature gates |
| `AWARIX_FOUNDER_EMAILS` (server env) | Complimentary Academy for founders |
| Auth `app_metadata.is_beta_tester` | Complimentary Academy (admin / service role only) |

Clients may `SELECT` their own `coach_entitlements` row. There are **no** RLS
write policies for `authenticated` or `anon`. Only `service_role` (webhooks /
admin) may upsert entitlements.

Founder emails are **server-only**. Client UI must call
`GET /api/account/entitlements` for authoritative complimentary status.

## Entitlement helper

All feature gates resolve through:

```
getUserEntitlements()  →  effectivePlan
hasFeatureAccess() / userHasFeatureAccess()  →  plan feature matrix
getCurrentSubscription()  →  UI / layout summary
```

Do not read `subscription_plan` / `subscription_status` from `user_metadata`.
Legacy fields are stripped on successful webhook sync.

## Stripe customer ownership rules

Ownership is proven **only** by Stripe Customer metadata:

```
metadata.awarix_user_id === authenticated Auth user id
```

| Situation | Behaviour |
|-----------|-----------|
| Customer owned by current user | Reuse |
| Customer owned by another user | **Reject** (checkout 409 / portal 403); log incident |
| Customer unbound (no `awarix_user_id`) | **Never claim by email**. Checkout creates a **new** customer. Portal **denies** and logs — admin repair required |
| Email match alone | **Never** establishes ownership |

Helpers live in `lib/stripe-customer-ownership.ts`:

- `evaluateStripeCustomerOwnership`
- `assertStripeCustomerOwnedByUser`
- `resolveOrCreateStripeCustomerForUser` (checkout)
- `resolveOwnedStripeCustomerForPortal` (portal)
- `logStripeCustomerOwnershipIncident`

`awarix_user_id` is set **only** when creating a new customer for the
authenticated user. Existing values are **never overwritten**.

## Binding lifecycle

1. Authenticated checkout resolves or creates a customer already bound to
   `awarix_user_id` (or creates a new bound customer).
2. Checkout session sets `client_reference_id` and subscription metadata to the
   same Auth user id.
3. Webhooks upsert `coach_entitlements` with `stripe_customer_id` /
   `stripe_subscription_id`.
4. Billing Portal opens only for customers already bound to that user.
5. Unbound customers referenced by entitlements block the portal until an
   administrator sets `metadata.awarix_user_id` correctly in Stripe.

## Checkout & Billing Portal

- Checkout (`POST /api/stripe/create-checkout-session`) requires a signed-in user.
  Customer identity comes from the session — never from a client email or customer id.
- Portal (`POST /api/stripe/create-portal-session`) requires auth and proven
  ownership. It does **not** silently bind unbound customers.

Price IDs come from environment variables (`STRIPE_PRICE_STARTER` /
`STRIPE_PRICE_PRO` / `STRIPE_PRICE_ACADEMY`). Checkout refuses to start if any
are missing (`assertStripePricesConfigured`).

## Webhook flow

```
Stripe event (checkout / subscription / invoice)
        ↓
POST /api/stripe/webhook
        ↓
lib/stripe-webhook.ts (idempotent via stripe_webhook_events)
        ↓
syncCoachSaasEntitlements()  →  upsert coach_entitlements
        ↓
clearLegacySubscriptionUserMetadata()
        ↓
assertCoachSaasSyncApplied()  — throws → HTTP 500 → Stripe retries
```

Only these trusted server paths may grant, remove, upgrade, downgrade, trial,
or complimentary-adjacent Stripe status for paid plans.

## Lifecycle

1. Authenticated checkout creates/reuses a Stripe Customer bound to `awarix_user_id`.
2. Checkout / subscription events upsert `coach_entitlements` (`trialing` | `active` | …).
3. Feature gates use `effectivePlan` (`trialing`/`active` → selected plan; otherwise Starter).
4. Cancel / expire / past_due updates status via webhook; access fails closed to Starter.
5. Complimentary founder/beta short-circuits to Academy without a Stripe row.

## Sync failure & recovery

If entitlement upsert or metadata cleanup fails:

1. The webhook handler throws (`assertCoachSaasSyncApplied` / upsert errors).
2. The API returns **500** so Stripe retries the event.
3. Development logs include `[entitlements] synced …` on success; failures surface
   in webhook error responses and server logs.

**Recovery if a user is stuck on Starter after paying:**

1. Confirm the Stripe subscription has `metadata.plan_id` and
   `metadata.awarix_user_id` (or customer metadata).
2. Replay the relevant Stripe event from the Dashboard (or wait for automatic retry).
3. Verify a row exists in `coach_entitlements` for that `user_id`.
4. As a last resort, run a trusted admin upsert of `coach_entitlements` from the
   live Stripe subscription — never restore plan fields into `user_metadata`.

**Recovery for unbound / ownership-conflict Stripe customers:**

1. In Stripe Dashboard, open the Customer and set
   `metadata.awarix_user_id` to the correct Auth user UUID (or clear a wrong
   binding after verifying no conflicting subscription).
2. Ensure `coach_entitlements.stripe_customer_id` matches that customer.
3. Ask the user to retry Billing Portal or Checkout.
4. Do **not** use email match alone to re-bind in application code.

## Legacy metadata cleanup

`clearLegacySubscriptionUserMetadata()` runs on successful Coach SaaS webhook
sync and deletes `subscription_plan`, `subscription_status`, `trial_ends_at`,
Stripe id fields, and `is_beta_tester` from Auth `user_metadata`.

**Removal strategy:** keep until a production audit shows no users retain those
keys; then remove the helper and its webhook call in a dedicated cleanup change.
No bulk migration tool is required beyond webhook-driven cleanup for active
subscribers; optional admin script can scan Auth users if desired.

## Migration notes (Sprint 6 → 6.5)

- Set `AWARIX_FOUNDER_EMAILS` (comma-separated) in every environment.
- Existing unbound Stripe customers are no longer auto-claimed; bind metadata
  manually or allow checkout to create a new bound customer.
- Deprecated complimentary `metadata` arguments and beta metadata aliases were
  removed.

## Security guarantees

- Clients cannot grant themselves Pro/Academy by editing Auth metadata.
- Beta complimentary requires admin-writable `app_metadata`, not `user_metadata`.
- Founder allowlists are not shipped in client bundles.
- Email alone never transfers Stripe customer ownership.
- Billing Portal never silently binds unbound customers.
- Checkout never overwrites an existing `awarix_user_id`.
- Anonymous SaaS checkout is blocked.
- Failed entitlement sync does not silently succeed.
