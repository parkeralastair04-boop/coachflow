# Payment operations runbook

Operational guide for Awarix parent payment flows after M4 payment-integrity lockdown.

**Access:** `stripe_webhook_events` and `security_audit_log` are not exposed to anon/authenticated clients. Use the Supabase SQL editor, `psql` with the pooler URL, or `createAdminClient()` in a trusted script.

---

## Quick reference

| Symptom | First check |
|---------|-------------|
| Parent paid but booking still pending | `stripe_webhook_events` for the event; replay if failed |
| Duplicate parent email | `security_audit_log` for multiple `confirmedNow: true` |
| Dashboard subscriptions stale | Coach session + `sync_recurring_subscription_state` via service role |
| Anon mutation attempt | Should return permission denied (M4 lockdown) |

---

## Replay webhook

Stripe retries failed webhooks automatically. To replay manually:

1. **Stripe Dashboard** → Developers → Events → select event → **Resend**.
2. Or use Stripe CLI: `stripe events resend evt_xxx`.

Awarix deduplicates by event `id` in `stripe_webhook_events`. A successful replay returns HTTP 200 with `"status":"duplicate"` and does **not** re-mutate or re-email.

To force re-processing (rare, only if ledger row is wrong): delete the ledger row in SQL editor, then resend from Stripe. Coordinate with engineering — this can have side effects.

---

## Failed webhook recovery

1. Find the event in Stripe Dashboard (filter by `checkout.session.completed`, subscription events, etc.).
2. Query the ledger:

```sql
select id, type, received_at, processed_at, last_error
from public.stripe_webhook_events
where id = 'evt_xxxxxxxx'
   or received_at > now() - interval '24 hours'
order by received_at desc
limit 50;
```

3. Rows with `processed_at` null and `last_error` set indicate a processing failure.
4. Check audit log for the same `request_id`:

```sql
select created_at, action, outcome, metadata
from public.security_audit_log
where request_id = 'evt_xxxxxxxx'
order by created_at;
```

5. Fix root cause (Stripe metadata missing, DB constraint, etc.), then resend from Stripe.
6. Verify row state:

```sql
-- Session booking
select id, booking_status, payment_status, stripe_checkout_session_id
from public.session_bookings
where stripe_checkout_session_id = 'cs_xxx';

-- Recurring enrolment
select id, status, stripe_checkout_session_id
from public.player_recurring_enrolments
where stripe_checkout_session_id = 'cs_xxx';
```

---

## Duplicate webhook behaviour

| Layer | Behaviour |
|-------|-----------|
| `stripe_webhook_events` | Primary key on `id`; second delivery short-circuits |
| Session confirm RPC | `confirmed_now = false` on replay |
| Recurring confirm | No re-activation if already `active` |
| Parent email | Session: only when `confirmedNow`; recurring: only on `pending` → `active` |

Expected replay response: `{"status":"duplicate","detail":"Event already processed."}`

---

## Stripe outage behaviour

| Phase | Impact |
|-------|--------|
| Checkout create | Fails if Stripe API unreachable; parent sees error, no charge |
| During payment | Stripe-hosted; parent may retry when Stripe recovers |
| Post-redirect poll | Poll returns `409` if Stripe session not yet `paid`, or `pending: true` if paid but webhook delayed |
| Webhook delivery | Stripe queues and retries; ledger shows unprocessed rows until recovery |

Parents may see *"Payment received. Confirmation may take a little longer."* if webhook is delayed beyond the 30s poll window. Confirmation still completes when the webhook arrives.

---

## Inspecting `stripe_webhook_events`

```sql
-- Recent unprocessed events
select id, type, received_at, last_error
from public.stripe_webhook_events
where processed_at is null
order by received_at desc
limit 20;

-- Recent failures
select id, type, received_at, processed_at, last_error
from public.stripe_webhook_events
where last_error is not null
order by received_at desc
limit 20;

-- Duplicate / replay check for one event
select *
from public.stripe_webhook_events
where id = 'evt_xxxxxxxx';
```

---

## Inspecting `security_audit_log`

Payment-related actions:

| Action | Source |
|--------|--------|
| `booking.confirm_session_from_stripe` | `lib/booking-confirmation.ts` |
| `booking.confirm_enrolment_from_stripe` | `lib/booking-confirmation.ts` |
| `subscription.apply_stripe_snapshot` | `lib/booking-confirmation.ts` |
| `stripe.webhook.processed` | `lib/stripe-webhook.ts` |
| `stripe.webhook.duplicate` | `lib/stripe-webhook.ts` |
| `stripe.webhook.failed` | `lib/stripe-webhook.ts` |

```sql
-- Recent webhook processing
select created_at, action, outcome, resource_id, request_id
from public.security_audit_log
where action like 'stripe.webhook.%'
order by created_at desc
limit 30;
```

---

## Common SQL queries

### Recent webhook failures

```sql
select e.id, e.type, e.received_at, e.last_error,
       a.action, a.outcome, a.metadata
from public.stripe_webhook_events e
left join public.security_audit_log a on a.request_id = e.id
where e.last_error is not null
   or (e.processed_at is null and e.received_at < now() - interval '5 minutes')
order by e.received_at desc
limit 25;
```

### Recent booking confirmations

```sql
select created_at, resource_id as booking_id, outcome,
       metadata->>'confirmedNow' as confirmed_now,
       metadata->>'stripeCheckoutSessionId' as checkout_session_id
from public.security_audit_log
where action = 'booking.confirm_session_from_stripe'
order by created_at desc
limit 25;
```

### Recent recurring confirmations

```sql
select created_at, resource_id as enrolment_id, outcome,
       metadata->>'recurringStatus' as recurring_status,
       metadata->>'stripeSubscriptionId' as subscription_id
from public.security_audit_log
where action = 'booking.confirm_enrolment_from_stripe'
order by created_at desc
limit 25;
```

### Duplicate events (replays)

```sql
select created_at, action, request_id, metadata
from public.security_audit_log
where action = 'stripe.webhook.duplicate'
order by created_at desc
limit 25;
```

### Grant verification (post-M4)

```sql
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'confirm_public_session_booking',
    'confirm_public_recurring_enrolment',
    'sync_recurring_subscription_state'
  )
  and privilege_type = 'EXECUTE'
order by routine_name, grantee;
```

Expected grantees: `postgres`, `service_role` only.

---

## Verification scripts

| Script | Purpose |
|--------|---------|
| `npm run smoke:webhook-rc` | Signature reject/accept + health stripe check (no fixtures) |
| `npm run smoke:webhook-confirm` | Full webhook-first confirmation smoke (`smoke-m402-…`) |
| `npx tsx scripts/verify-m403-m404.ts` | Grant lockdown + anon attack tests |
| `npx tsx scripts/smoke-m404-lockdown-verify.ts` | End-to-end smoke + audit checks |

---

## Rollback (grants only)

Only if reverting M4 lockdown (not recommended in production):

```sql
grant execute on function public.confirm_public_session_booking(uuid, text, text)
  to anon, authenticated;
grant execute on function public.confirm_public_recurring_enrolment(uuid, text, text, text, timestamptz)
  to anon, authenticated;
grant execute on function public.sync_recurring_subscription_state(text, text, timestamptz)
  to anon, authenticated;
```

This re-exposes public mutation paths. Prefer fixing webhook/poll issues instead.

---

## Future hygiene tasks

Low-priority edge cases and pre-existing risks. **No schema changes until prioritised.**

### 1. Expired holds stay `pending`

When a Stripe checkout expires, capacity is released (`expires_at` passed) but the booking/enrolment row remains `status = pending` rather than transitioning to `cancelled`.

**Impact:** Orphan pending rows in reports; capacity math is correct.

**Future fix:** Scheduled job or trigger to mark expired holds as `cancelled`.

### 2. Confirm RPCs do not reject expired holds

`confirm_public_session_booking` and `confirm_public_recurring_enrolment` do not check `expires_at` before confirming. A very late webhook could theoretically confirm after hold expiry.

**Impact:** Low risk in practice (Stripe session also expires).

**Future fix:** Add `expires_at` guard inside confirm RPCs.

### 3. `sync_recurring_enrolment_bookings` TOCTOU

Pre-existing time-of-check-time-of-use concurrency risk when syncing recurring enrolments to session registers under concurrent webhooks or coach actions.

**Impact:** Rare duplicate or missed register rows under extreme concurrency.

**Future fix:** Advisory locks or idempotent upsert pattern in the sync RPC.

---

## Related documentation

- [payment-integrity-architecture.md](./payment-integrity-architecture.md) — system design and security model
