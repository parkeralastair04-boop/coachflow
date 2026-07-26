# Payment integrity architecture

Awarix parent payments use a **webhook-first** confirmation model. The browser never mutates payment state after checkout is created. Stripe webhooks and server-side `service_role` RPCs are the only writers.

M4 (payment integrity) is complete as of migration `20260610150000_payment_integrity_lockdown.sql`.

## Key modules

| Module | Role |
|--------|------|
| `app/api/bookings/route.ts` | Session checkout creation |
| `app/api/bookings/recurring/route.ts` | Recurring checkout creation |
| `app/api/bookings/confirm/route.ts` | Read-only session confirmation poll |
| `app/api/bookings/recurring/confirm/route.ts` | Read-only recurring confirmation poll |
| `components/booking-portal.tsx` | Post-checkout polling UX |
| `lib/stripe-webhook.ts` | Stripe event routing and idempotency |
| `lib/booking-confirmation.ts` | Canonical payment mutations + parent emails |
| `lib/supabase/admin.ts` | `createAdminClient()` (`service_role`) |

## Checkout create

```
Parent submits booking form
        ↓
app/api/bookings (or /recurring)
        ↓
RPC: create_public_* (anon) — pending row only
        ↓
Stripe Checkout Session created (metadata: booking_id / enrolment_id)
        ↓
createAdminClient().rpc(attach_stripe_checkout_to_*)
        ↓
stripe_checkout_session_id + expires_at persisted on row
        ↓
Parent redirected to Stripe hosted checkout
```

**Attach RPCs** (`attach_stripe_checkout_to_session_booking`, `attach_stripe_checkout_to_recurring_enrolment`) are `service_role` only. Checkout expiry is aligned to Stripe `expires_at` (30-minute hold).

## Redirect and polling

```
Stripe success redirect → booking portal with checkout_session_id
        ↓
components/booking-portal.tsx polls every 2s (max 30s)
        ↓
POST /api/bookings/confirm (or /recurring/confirm)
        ↓
Stripe API: verify payment_status === paid
        ↓
RPC: get_booking_confirmation_status / get_recurring_confirmation_status (read-only, anon)
        ↓
{ confirmed: true, ... } or { confirmed: false, pending: true }
```

Poll endpoints **never** call mutation RPCs. If the webhook is slow, the UI shows: *"Payment received. Confirmation may take a little longer."*

## Webhook confirmation

```
Stripe event
        ↓
app/api/stripe/webhook/route.ts
        ↓
lib/stripe-webhook.ts (idempotency via stripe_webhook_events)
        ↓
lib/booking-confirmation.ts
        ↓
createAdminClient().rpc(confirm_public_* / sync_recurring_subscription_state)
        ↓
Database mutation + security_audit_log entry
```

Handled events include:

- `checkout.session.completed` — session bookings and recurring enrolments
- `customer.subscription.created` — recurring enrolment (alternate path)
- `customer.subscription.updated` / `deleted` — subscription snapshot sync
- `invoice.paid` / `invoice.payment_failed` — subscription state updates

## Email flow

```
lib/booking-confirmation.ts
        ↓
Resend (parent confirmation email)
        ↓
Sent at most once per payment
```

| Flow | Send condition |
|------|----------------|
| Session booking | `confirmedNow === true` from `confirm_public_session_booking` |
| Recurring enrolment | First activation only (`pending` → `active`) |

Webhook replay is safe: duplicate events are deduplicated by `stripe_webhook_events` and email guards prevent duplicate sends.

## Payments dashboard sync

```
Coach opens /dashboard/payments
        ↓
GET /api/payments/list-subscriptions (authenticated coach)
        ↓
Stripe API: refresh subscription status
        ↓
createAdminClient().rpc(sync_recurring_subscription_state) when stale
        ↓
Returns refreshed list to UI
```

Coach auth uses the authenticated Supabase session; **mutation** uses `service_role` only.

## Security model

**Browser / anon / authenticated clients cannot mutate payment state.**

| RPC | anon | authenticated | service_role |
|-----|------|---------------|--------------|
| `confirm_public_session_booking` | ❌ | ❌ | ✅ |
| `confirm_public_recurring_enrolment` | ❌ | ❌ | ✅ |
| `sync_recurring_subscription_state` | ❌ | ❌ | ✅ |
| `get_booking_confirmation_status` | ✅ | ✅ | — |
| `get_recurring_confirmation_status` | ✅ | ✅ | — |
| `attach_stripe_checkout_to_*` | ❌ | ❌ | ✅ |

Canonical mutation entrypoint: **`lib/booking-confirmation.ts`** (called from webhooks and payments sync via admin client).

## Observability

| Store | Purpose | Access |
|-------|---------|--------|
| `stripe_webhook_events` | Idempotency ledger, delivery status | Service role / SQL editor |
| `security_audit_log` | Privileged action audit trail | Service role / SQL editor |

See [payment-runbook.md](./payment-runbook.md) for operational queries and incident response.

## Related migrations

| Migration | Purpose |
|-----------|---------|
| `20260610120000_security_audit_log.sql` | Audit log table |
| `20260610130000_stripe_webhook_events.sql` | Webhook idempotency ledger |
| `20260610140000_checkout_hold_alignment.sql` | Checkout hold + attach RPCs |
| `20260610152000_confirmation_status_lookup.sql` | Read-only poll RPCs |
| `20260610150000_payment_integrity_lockdown.sql` | Revoke public mutation grants |

## Future hygiene (known limitations)

Tracked in [payment-runbook.md#future-hygiene-tasks](./payment-runbook.md#future-hygiene-tasks). No schema changes planned until those tasks are prioritised.
