# Beta launch checklist

Final production checklist for shipping Awarix to the first paying academies.
Companion to [ops-production.md](./ops-production.md) and [demo-mode.md](./demo-mode.md).

## Pre-deploy

- [ ] All Supabase migrations applied in timestamp order (37 files under `supabase/migrations/`)
- [ ] `npm run lint` and `npm run build` pass on the release commit
- [ ] `npm run build:secure` (bundle secret scan) if shipping a public build
- [ ] `npm run validate:gating` for entitlement regression checks
- [ ] Review `git diff` for accidental `.env` / keys

## DNS & hosting

- [ ] Production domain DNS → Vercel (or host)
- [ ] `NEXT_PUBLIC_SITE_URL` matches canonical HTTPS origin (`https://awarix.co.uk` in production)
- [ ] TLS certificate healthy
- [ ] Preview deployments isolated from production Stripe/webhook secrets

## Supabase

- [ ] Production project (not local) wired in env
- [ ] Auth email templates + site URL / redirect allow list include `/auth/callback`, `/family/claim`
- [ ] Email confirmation **required** for new users (parent portal enforces `email_confirmed_at`)
- [ ] Service role key only on server; never `NEXT_PUBLIC_`
- [ ] Backups + PITR enabled on plan
- [ ] RLS policies reviewed for academy_members / bookings / parent tables

## Stripe

- [ ] Live mode keys for production (`STRIPE_SECRET_KEY`, publishable)
- [ ] Price IDs: `STRIPE_PRICE_STARTER` / `PRO` / `ACADEMY`
- [ ] Webhook endpoint → `/api/stripe/webhook` with `STRIPE_WEBHOOK_SECRET`
- [ ] Events subscribed: checkout, subscription, invoice payment failures (as in payment runbook)
- [ ] Customer portal configured
- [ ] Test a live webhook delivery after deploy

## Resend

- [ ] `RESEND_API_KEY` set
- [ ] Sending domain verified; `RESEND_FROM_EMAIL` uses verified domain
- [ ] Spot-check booking + report emails in production (not demo slug)

## Bot protection

- [ ] Cloudflare Turnstile site + secret keys set (**required in production** startup validation)
- [ ] Confirm login/signup/booking/contact show widget when keys present
- [ ] Supabase Auth Attack Protection CAPTCHA enabled (same Turnstile keys) when plan supports it
- [ ] Optional shared rate limits: Upstash REST URL + token

## Monitoring

- [ ] `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set; first error appears in project
- [ ] Optional build upload: `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` (see [sentry.md](./sentry.md))
- [ ] Release / commit SHA visible on `/api/health`
- [ ] Synthetic check hits `/api/health` every 1–5 minutes
- [ ] Founders can open `/dashboard/ops`
- [ ] Log drain filters `[awarix/` if using external APM
- [ ] RC checklist signed: [rc1-checklist.md](./rc1-checklist.md)

## Demo mode

- [ ] Reserve public slug `riverside-united` (static demo takes precedence)
- [ ] Smoke `/demo` and `/academy/riverside-united` — banners visible
- [ ] Confirm demo booking/contact return simulated success (no email/Stripe)

## Analytics & activation

- [ ] Activation events table migrated (`coach_activation_events`)
- [ ] Parent journey events migrated
- [ ] Decide beta analytics sink (catalog only until dashboards)

## Go-live smoke (real academy, not demo)

1. Coach signup → confirm email → create academy → branding  
2. Add player + session → publish booking link  
3. Parent books (paid or free) → webhook confirms → claim email  
4. Parent claims → family dashboard → shared report  
5. Coach upgrade trial/checkout → entitlement refresh  
6. Public website contact form delivers to support email  

## Rollback

- [ ] Previous Vercel deployment ready for instant rollback  
- [ ] Know Stripe webhook pause procedure  
- [ ] DB restore / PITR window documented for last migration  

## Sign-off

| Role | Name | Date |
| --- | --- | --- |
| Engineering | | |
| Founder | | |
