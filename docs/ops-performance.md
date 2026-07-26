# Performance review notes (Sprint 11)

Operational snapshot — no code changes required for launch blockers.

## Slow API routes (watch)

- `POST /api/stripe/webhook` — fan-out confirmations + emails; keep handlers idempotent.
- Family dashboard aggregates (`/api/family/dashboard`) — multiple admin queries; cache later if needed.
- Public booking create/confirm — RPC + capacity checks.
- AI routes (`training/generate-*`, `generate-report`) — expect multi-second latency; rate-limit already applied.

## Client bundles

- Sentry is optional; without `NEXT_PUBLIC_SENTRY_DSN` client init is a no-op.
- Prefer dynamic import for heavy PDF/AI UI already pattern in managers.
- Avoid importing `server-only` modules into client components.

## Server Components & hydration

- Academy/public pages and `/dashboard/ops` are Server Components (good).
- Error boundaries are client-only by Next convention — keep them thin.
- Prefer passing serializable props; avoid Date objects across the RSC boundary.

## Caching

- Health and diagnostics: `no-store` / `force-dynamic` (correct).
- Do not cache authenticated JSON APIs at CDN.
- Marketing pages may use ISR later; booking portals must stay dynamic.

## Database hotspots

- `stripe_webhook_events` lookups by event id (indexed).
- Activation / parent journey inserts — low volume at launch.
- Session roster and attendance history — review indexes if registers grow.

## Recommendations

1. Add synthetic latency alerts on `/api/health` + webhook processing time.
2. Profile family dashboard queries before beta load tests.
3. Consider edge caching only for academy marketing HTML.
4. Upload Sentry source maps when enabling production DSN ([sentry.md](./sentry.md)).
