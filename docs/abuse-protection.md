# Abuse protection & platform hardening

Awarix controls for rate limiting, bot protection, security headers,
ownership checks, and safe API errors.

## Rate limiting

Shared helper: `lib/rate-limit.ts` + store abstraction `lib/rate-limit-store.ts`.

- Fixed-window limiter; returns HTTP **429** with `Retry-After`, `X-RateLimit-*`,
  and `{ error, code: "rate_limited" }`.
- Presets in `RATE_LIMITS` (contact, booking, AI, communication, billing, auth, …).
- **Default store:** in-memory (single Node instance / serverless isolate).
- **Shared store (optional):** set `UPSTASH_REDIS_REST_URL` +
  `UPSTASH_REDIS_REST_TOKEN`. On Upstash errors, falls back to memory so public
  APIs stay available.

Auth (login / signup / password reset) uses `POST /api/auth/preflight` before
Supabase Auth calls (app-level rate limit + Turnstile when configured).

### Supabase Auth (Dashboard — no app redesign)

Configure in **Supabase → Authentication → Attack Protection** (names vary by plan):

1. **CAPTCHA** — enable Cloudflare Turnstile with the same site/secret keys used
   by the app (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`).
2. **Rate limits** — keep Dashboard defaults or tighten for signup / recover /
   token refresh during beta.

App preflight does **not** replace Dashboard CAPTCHA; both are complementary.

## Bot protection

Shared server logic: `lib/bot-protection.ts`  
Client fields: `components/bot-protection-fields.tsx`

| Control | Behaviour |
|---------|-----------|
| Honeypot (`company_website`) | Must be empty; filled → reject (contact fakes success) |
| Cloudflare Turnstile | **Required in production** (startup validation). Enabled whenever both Turnstile env keys are set |
| Spam heuristics | Contact form URL/spam patterns |
| Duplicate contact | Same academy+email+message within 10 minutes |

Local/dev may run without Turnstile; production boot reports missing bot keys as unhealthy env.

## Communication ownership

`POST /api/communication/send`:

- Direct sends require a player owned by the coach (`coach_id` match).
- Parent email must match the player record (client email alone is rejected).
- Audience paths only resolve coach-owned players / camps.

`POST /api/notifications/send` ignores cross-user `userId` targets.

## Security headers

Configured in `next.config.ts` for all routes:

- Content-Security-Policy
- Strict-Transport-Security
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy

### CSP exceptions

| Source | Why |
|--------|-----|
| `https://js.stripe.com`, `checkout.stripe.com`, `billing.stripe.com`, `hooks.stripe.com` | Stripe Checkout / Elements / Portal |
| `https://*.supabase.co`, `wss://*.supabase.co` | Auth + data |
| `https://challenges.cloudflare.com` | Turnstile |
| `https://www.youtube.com`, `player.vimeo.com` | Embedded video |
| `'unsafe-inline'` / `'unsafe-eval'` on scripts | Next.js runtime / Stripe bootstrap |

Tighten script CSP further once a nonce-based Next CSP pipeline is adopted.

## Abuse logging

`lib/abuse-log.ts` → structured `console.warn("[awarix/abuse]", …)`.

Events: rate limits, ownership denials, validation failures, bot/Turnstile
blocks, communication blocks, duplicates. PII/secrets are redacted.

## Safe API responses

`lib/api-response.ts` — prefer `apiError` / `safeApiError` / `validationError`.
Clients receive short messages + `code`; details stay in server logs.

## Operational guidance

1. Production must have Turnstile keys (validated at startup).
2. Enable Supabase Auth CAPTCHA + review Auth rate limits in the Dashboard.
3. Monitor `[awarix/abuse]` logs for repeated rate-limit / ownership events.
4. For multi-instance shared limits, configure Upstash REST env vars.
5. Review CSP if adding new third-party embeds.

## Env

```
TURNSTILE_SECRET_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
UPSTASH_REDIS_REST_URL=   # optional
UPSTASH_REDIS_REST_TOKEN= # optional
```
