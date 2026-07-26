# Operational runbooks (quick reference)

Full context: [ops-production.md](./ops-production.md). Payment-specific: [payment-runbook.md](./payment-runbook.md).

## Webhook failures

1. `/dashboard/ops` → failed webhooks + `last_error`
2. Stripe Dashboard delivery attempts
3. Fix → redeploy → Resend event (idempotent ledger)

## Stripe outage

Pause non-critical billing UX; reconcile via webhook replay when restored.

## Supabase outage

Health shows DB unhealthy; wait for provider. No secondary DB in v1.

## Email outage

Bookings may succeed without email. Check Resend; re-notify parents manually if needed.

## High error rates

Sentry + logs `[awarix/` + health + recent deploy rollback.

## Rate-limit spikes

Abuse logs; confirm Turnstile + Supabase Auth CAPTCHA; Upstash if multi-instance.

## Support workflow

Identify email → entitlements/bookings → ops health (founders) → payment runbook.
