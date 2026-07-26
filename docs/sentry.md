# Sentry (error monitoring & source maps)

Runtime capture works with DSN alone. Source-map upload is optional and
enabled only when build-time auth is present.

## Runtime (errors)

Set either or both:

```
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

Wiring:

- `instrumentation.ts` / `instrumentation-client.ts`
- `sentry.server.config.ts` / `sentry.edge.config.ts`
- Client/server `captureException` via `lib/monitoring.ts`

Without a DSN, errors stay in structured logs (`[awarix/`).

## Source-map upload (recommended for RC / production)

Set all three on the **build** environment (Vercel project env or CI):

```
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=
```

When present, `next.config.ts` wraps the config with `withSentryConfig` and
uploads maps during `next build`. Maps are deleted after upload.

Assumptions:

- Token has `project:releases` / source maps write scope.
- Org + project slugs match the Sentry project receiving the DSN.
- Upload is skipped silently when any of the three is missing (local builds stay fast).

## Verify

1. Deploy with DSN + upload env set.
2. Trigger a handled test error (or wait for a natural one).
3. In Sentry, confirm the event resolves to TypeScript source, not minified bundles.
4. Confirm `/api/health` → `monitoring` component is `healthy`.
