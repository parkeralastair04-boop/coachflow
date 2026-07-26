# Beta readiness report (RC1)

Status: **feature complete for closed beta** — Sprint 15 focused on stability and ops, not new product surface.

## Product completeness

Coach, academy, booking, payments, family portal, matches, training, finance, communication, demo mode, and ops diagnostics are in tree. Treat remaining work as polish and deferred enhancements, not blockers for a small closed beta.

## Operational readiness

| Area | Ready? | Notes |
| --- | --- | --- |
| Health / diagnostics | Yes | `/api/health`, `/dashboard/ops` |
| Payments integrity | Yes | Webhook ledger + runbooks + RC smoke |
| Bot protection | Yes | Turnstile required in production validation |
| Error monitoring | Yes* | DSN recommended; source maps when upload env set |
| Shared rate limits | Optional | Memory default; Upstash when configured |
| Backups | Plan-dependent | Confirm Supabase PITR before invite |

\*Ship without Sentry only if founders accept log-only triage.

## Known limitations

- In-memory rate limits unless Upstash env is set (per-instance on serverless).
- No durable email/job outbox — soft-fail + manual re-send.
- `getUserByEmail` not in current Supabase Auth Admin SDK; claim path uses optional method + paginated `listUsers` (bounded).
- Feature-usage / academy-growth analytics deferred.
- Expired Stripe holds may remain `pending` (capacity math still correct) — see payment runbook.

## Deferred enhancements

- Full Redis-backed limits everywhere without memory fallback telemetry dashboards.
- Outbox / retry worker for email and side effects.
- Tighter CSP (nonces).
- Broader design-system migration beyond high-traffic forms.

## Recommended beta cohort

**8–15 academies** (or ~20–40 active coaches), mixed free + paid trial. Prefer coaches who already run sessions weekly so booking/webhook paths exercise quickly. Exclude production use of the `riverside-united` demo slug.

## Success metrics (first 4–6 weeks)

1. Webhook success rate ≥ 99% (failed ledger rows investigated same day).
2. Time-to-first paid or confirmed booking ≤ 7 days for ≥ 50% of cohort.
3. Parent claim completion ≥ 40% of invite emails sent.
4. P0 incidents ≤ 2; mean time to acknowledge < 4 business hours.
5. Support tickets per academy ≤ 3/week after week 2.

## Suggested support process

1. Shared inbox (or Linear/email) with severity tags: billing, auth, booking, other.
2. Founders use `/dashboard/ops` + Sentry for system health before deep SQL.
3. Payment issues follow `docs/payment-runbook.md`; replay via Stripe, never ad-hoc DB confirms.
4. Weekly 30-minute triage; freeze feature work for P0/P1 until green.
5. Demo academy for sales; never mix demo slug with live Stripe keys testing.
