# Release Candidate 1 (RC1) checklist

Closed-beta gate for Awarix. Companion docs:
[ops-production.md](./ops-production.md),
[beta-launch-checklist.md](./beta-launch-checklist.md),
[sentry.md](./sentry.md),
[abuse-protection.md](./abuse-protection.md),
[payment-runbook.md](./payment-runbook.md).

## Environment

- [ ] Production Supabase URL + anon + **service role** (server only)
- [ ] `NEXT_PUBLIC_SITE_URL` = canonical HTTPS origin (`https://awarix.co.uk` in production)
- [ ] Stripe live: secret, publishable, webhook secret, Starter/Pro/Academy price IDs
- [ ] Resend API key + verified `RESEND_FROM_EMAIL` domain
- [ ] Turnstile site + secret (**required** in production startup validation)
- [ ] Sentry DSN (server + public) — strongly recommended
- [ ] Optional: `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` for source maps
- [ ] Optional: `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for shared rate limits
- [ ] `AWARIX_FOUNDER_EMAILS`, `ADMIN_API_SECRET`, `CRON_SECRET` as needed
- [ ] OpenAI key only if AI features are offered in beta

## Infrastructure

- [ ] All Supabase migrations applied in filename/timestamp order
- [ ] Hosting (Vercel) production project isolated from preview secrets
- [ ] DNS + TLS healthy on production domain
- [ ] Deploy order: migrations → env → app deploy → health → webhook smoke

## Monitoring

- [ ] `GET /api/health` healthy or only known warnings
- [ ] Synthetic probe on `/api/health` every 1–5 minutes
- [ ] Founders can open `/dashboard/ops`
- [ ] Sentry receiving events; release/commit visible on health
- [ ] Log filter `[awarix/` documented for on-call

## Billing

- [ ] Stripe webhook endpoint → `/api/stripe/webhook` (live mode)
- [ ] Customer portal configured
- [ ] `npm run smoke:webhook-rc` against staging/production base URL
- [ ] Optional full confirm smoke: `npm run smoke:webhook-confirm` (needs fixtures)
- [ ] Trial/checkout price IDs match Dashboard products

## Emails

- [ ] Booking confirmation + report share spot-checked (non-demo academy)
- [ ] Auth emails (confirm / reset) use correct redirect allow list
- [ ] Soft-fail behaviour understood if Resend is down (bookings still write)

## Security

- [ ] Supabase Auth: email confirmation required; redirect URLs allow-listed
- [ ] Supabase Auth Attack Protection: CAPTCHA (Turnstile) enabled if available on plan
- [ ] Supabase Auth rate limits reviewed in Dashboard
- [ ] App Turnstile on public contact/booking + auth preflight
- [ ] Service role never exposed as `NEXT_PUBLIC_*`
- [ ] RLS reviewed for academy/booking/parent tables
- [ ] Demo slug `riverside-united` reserved; write paths blocked in demo mode

## Analytics

- [ ] Activation + parent journey event tables migrated
- [ ] Product analytics dashboards deferred — catalog names stable only

## Backups

- [ ] Supabase automated backups + PITR window known
- [ ] RPO/RTO noted for beta support hours
- [ ] Pre-migration snapshot / PITR check before risky SQL

## Rollback

- [ ] Previous Vercel deployment ready for instant rollback
- [ ] Stripe webhook pause procedure known
- [ ] Prefer forward-fix migrations; DB restore plan documented

## Support

- [ ] Support inbox / founder emails staffed for beta hours
- [ ] Escalation: `/dashboard/ops` → payment runbook → Stripe/Supabase status
- [ ] Beta cohort size and success metrics agreed (see beta readiness report)

## Sign-off

| Role | Name | Date |
| --- | --- | --- |
| Engineering | | |
| Founder | | |
