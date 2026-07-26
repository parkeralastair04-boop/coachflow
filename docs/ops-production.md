# Operations & production readiness

Launch Sprint 11 — monitoring, deployment, recovery, and diagnostics.

## Monitoring

### Error monitoring (Sentry)

Optional at runtime, strongly recommended for RC. Set:

- `SENTRY_DSN` (server/edge)
- `NEXT_PUBLIC_SENTRY_DSN` (browser)

Source-map upload (build-time): `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT`.
See [sentry.md](./sentry.md).

Wiring:

- `instrumentation.ts` / `instrumentation-client.ts`
- `sentry.server.config.ts` / `sentry.edge.config.ts`
- `app/error.tsx` + `app/global-error.tsx` via `captureClientException`
- `safeApiError` and Stripe webhook failures via `captureException`
- Release tag: `awarix@{version}+{commit}`
- `next.config.ts` → `withSentryConfig` when upload env is present

Without a DSN, errors still go to structured logs only.

### Health

`GET /api/health` returns:

- Overall status: `healthy` | `warning` | `unhealthy`
- Database connectivity (service role)
- Stripe / email / monitoring configuration presence
- App version, release, build timestamp, environment
- Env group summary (**never** secret values)

Use for load-balancer probes. `503` when unhealthy.

### Structured logging

`lib/logger.ts` — categories: `app`, `security`, `billing`, `webhook`, `activation`, `job`, `email`, `health`, `analytics`.

Sensitive keys and emails are redacted.

### Diagnostics

- Page: `/dashboard/ops` (founder emails in `AWARIX_FOUNDER_EMAILS` only)
- API: `GET /api/internal/diagnostics` (founder session **or** `Authorization: Bearer $ADMIN_API_SECRET`)

Shows health, webhook 24h outcomes, activation/parent journey counts, analytics catalog. No secrets.

## Startup validation

`lib/env/validate-startup.ts` runs on Node boot via `instrumentation.ts`.

Required in production:

- Supabase URL/anon + service role
- Stripe secret, webhook secret, price IDs
- Resend API key
- Turnstile site + secret keys

Optional: OpenAI, founders, cron/admin secrets, Sentry DSNs / upload token,
Upstash Redis REST, site URL.

## Analytics foundations

Catalog: `lib/analytics-catalog.ts`

| Funnel | Storage today |
| --- | --- |
| Activation | `coach_activation_events` |
| Parent adoption | `parent_journey_events` |
| Trial / billing outcomes | `security_audit_log` (+ Stripe ledger) |
| Feature usage / academy growth | Deferred — names reserved |

Do not build product dashboards yet; keep event names stable.

## Background jobs

No durable worker queue. Operational model:

| Job | Trigger | Failure strategy |
| --- | --- | --- |
| Stripe webhooks | Stripe delivery | HTTP 500 → Stripe retries; row kept with `last_error` for replay |
| Automations | Coach session POST | Logged; re-run manually |
| Notifications | Coach session POST | Rate-limited; re-send manually |
| Email | Inline on confirm/share | Soft-fail booking if Resend down |

Job outcomes: `lib/jobs/monitor.ts` → structured logs + Sentry on failure.

Webhook replay: see `docs/payment-runbook.md`.

## Deployment

### Ordering

1. Apply Supabase migrations (including entitlements, activation, parent journey, academy visibility, webhook ledger).
2. Set production env (see checklist below / [rc1-checklist.md](./rc1-checklist.md)).
3. Deploy application (`npm run build` / platform build).
4. Verify `GET /api/health` is healthy/warning-acceptable.
5. Run `npm run smoke:webhook-rc` (signed ping) and/or check `/dashboard/ops`.
6. Optional full booking confirm: `npm run smoke:webhook-confirm` with fixture env.

### Rollback

- App: redeploy previous release (Vercel instant rollback or prior image).
- Migrations: prefer forward-fix migrations; destructive rollbacks only with DB restore.
- Stripe: webhook endpoint can be paused in Dashboard; ledger prevents double-processing on replay.

### Release notes

Stamp version via `package.json` + build-time `NEXT_PUBLIC_BUILD_TIMESTAMP`. Include commit SHA from `VERCEL_GIT_COMMIT_SHA` when present.

## Environment checklist

**Required**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER` / `PRO` / `ACADEMY`
- `RESEND_API_KEY`

**Strongly recommended**

- `NEXT_PUBLIC_SITE_URL` (production: `https://awarix.co.uk`)
- `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` (source maps)
- `AWARIX_FOUNDER_EMAILS`
- `ADMIN_API_SECRET`
- `CRON_SECRET`
- Turnstile site/secret keys (**required in production**)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (shared rate limits)

## Backup & recovery

### Database

- Use Supabase automated backups + Point-in-Time Recovery (Pro+).
- Document RPO/RTO with your plan.
- Before risky migrations: snapshot or ensure PITR window covers rollback.

### Stripe

- Customers/subscriptions live in Stripe — rebuild local mirrors from Stripe Dashboard/API if needed.
- Webhook replay: Stripe Dashboard → event → Resend, or CLI `stripe events resend`.
- Idempotency: `stripe_webhook_events.id` is the Stripe event id.

### Email

- Resend outage: bookings still succeed; emails may soft-fail. Re-send from coach tools where available.
- Keep `RESEND_FROM_EMAIL` verified.

### Migration rollback

1. Prefer additive migrations.
2. If a release depends on a bad migration, restore DB to pre-migration point then redeploy matching app version.
3. Never drop production tables without a restore plan.

## Operational runbooks

### Webhook failures

1. Check `/dashboard/ops` failed count and `last_error`.
2. Inspect Stripe Dashboard delivery logs.
3. Fix code/config; redeploy.
4. Resend event from Stripe (ledger dedupes processed events).

### Stripe outage

1. Mark status page / support note.
2. Pause non-critical billing UI if needed.
3. When restored, reconcile subscriptions via webhook replay + `coach_entitlements`.

### Supabase outage

1. Health endpoint → unhealthy database.
2. Public booking/APIs fail closed.
3. Wait for provider; no local DB failover in v1.

### Email outage

1. Health → email warning if key missing; otherwise check Resend status.
2. Confirm bookings still write; queue manual parent emails if urgent.

### High error rates

1. Open Sentry (if configured) + platform logs filtered `[awarix/`.
2. Check `/api/health` and `/dashboard/ops`.
3. Roll back app release if correlated with deploy.

### Rate-limit spikes

1. Review `[awarix/abuse]` logs.
2. Confirm Turnstile enabled on public forms + Supabase Auth CAPTCHA if configured.
3. Prefer Upstash REST env for multi-instance; otherwise limits are per isolate.

### Customer support workflow

1. Identify user email + academy/coach.
2. Check entitlements, recent webhooks, booking rows.
3. Founders: use `/dashboard/ops` for system health.
4. Payment issues: follow `docs/payment-runbook.md`.

## Performance notes (review)

- Prefer Server Components for academy/public pages (already).
- Bundle: keep Sentry optional; no DSN → minimal client work.
- Hotspots to watch: public booking RPCs, family dashboard admin aggregates, Stripe webhook fan-out.
- Rate limits: memory by default; Upstash when `UPSTASH_REDIS_REST_*` is set.
- Consider CDN caching for marketing pages only; never cache authenticated APIs.

## Production checklist

See [rc1-checklist.md](./rc1-checklist.md) and [beta-launch-checklist.md](./beta-launch-checklist.md).

- [ ] Migrations applied
- [ ] Required env set (including Turnstile in production)
- [ ] `/api/health` healthy or known warnings only
- [ ] Sentry DSN set (recommended); source maps if upload env set
- [ ] Stripe webhook endpoint live + signed; `npm run smoke:webhook-rc`
- [ ] Resend domain verified
- [ ] Founder emails configured for `/dashboard/ops`
- [ ] Turnstile enabled on public contact/booking; Supabase Auth CAPTCHA reviewed
- [ ] Backup/PITR confirmed on Supabase plan
- [ ] Smoke: signup → session → booking → webhook → family claim
- [ ] Demo slug `riverside-united` reserved / smoke-tested

## Remaining risks & gaps

| Risk | Severity | Mitigation / next step |
| --- | --- | --- |
| Sentry optional — ops blind without DSN | High if unset | Require DSN in RC checklist |
| Rate limits memory unless Upstash set | Medium | Set Upstash REST for multi-instance beta |
| No durable job queue / dead-letter worker | Medium | Stripe replay + `recordJobOutcome`; add queue when volume grows |
| Email failures soft-fail without retry queue | Medium | Manual re-send; optional Outbox table later |
| Feature usage / academy growth events deferred | Low | Emit into audit or new table when dashboards start |
| Multi-region health is single-DB | Medium | Accept for v1; status page when multi-region |
| Source maps need upload env | Low | Documented in [sentry.md](./sentry.md); wired via `withSentryConfig` |
| Automations/notifications lack central job table | Low | Log via `lib/jobs/monitor.ts`; persist if SLAs appear |

### Future infrastructure recommendations

1. Keep Upstash (or Redis) for shared rate limiting in production.
2. Outbox pattern for transactional email + webhook side effects.
3. Log drain → APM (Datadog/Axiom) filtering on `[awarix/`.
4. Synthetic checks hitting `/api/health` every minute.
5. Feature-usage event table when product analytics ships.
