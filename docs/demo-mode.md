# Demo mode — Riverside United Academy

Launch Sprint 13. Static showcase for prospects, beta testers, and internal reviewers.

## Architecture

Demo content is **in-memory / static TypeScript** (`lib/demo/data.ts`), not rows in Supabase.

| Surface | Entry |
| --- | --- |
| Hub | `/demo` |
| Coach product tour | `/demo/dashboard/*` |
| Public website | `/academy/riverside-united/*` |
| Booking | `/academy/riverside-united/book` |

When `academySlug` (or coach slug `james-okonkwo`) matches the demo constants, public loaders short-circuit to demo data:

- `getPublicAcademyContext` / coaches / teams / fixtures / results / camps / news
- `resolvePublicPortal` / `loadPublicBookingPayload`

No seed migration is required for the demo to work in any environment.

## Safety measures

1. **No production writes** — demo academy id is a fixed sentinel UUID; content is never inserted via admin client for the showcase path.
2. **No email** — `POST /api/bookings`, `/api/bookings/recurring`, and `/api/academy/contact` return simulated success for the demo slug (and when `awarix_demo=1` cookie / `x-awarix-demo: 1` header is present).
3. **No Stripe** — demo booking responses never create Checkout Sessions.
4. **Visible banners** — amber “Demo mode / Demo academy” strips on demo hub, dashboard (via cookie), and public website.
5. **Robots** — `/demo` metadata is `noindex`.

Helpers: `lib/demo/http-guard.ts`, `lib/demo/safety.ts`, `lib/demo/mode.ts`, `lib/demo/constants.ts`.

## Reset strategy

- **Reset demo** button on `/demo` and the demo dashboard:
  - Sets `awarix_demo=1` cookie
  - Clears `awarix.demo.tour.dismissed` and mutation keys in `localStorage`
  - Reloads `/demo/dashboard`
- Tour can be **Dismiss**ed or **Replay**ed independently.
- Because data is static, there is nothing to re-seed in the database.

## Sample data

Riverside United Academy (Bristol-inspired):

- 3 coaches, 4 teams (U9–U16)
- Fixtures + results, 2 camps, 3 news articles
- Sessions (group, 1:1, full+waitlist), weekly memberships
- Players with varied ages/attendance; active & returning parents
- Reports: technical / physical / behavioural
- Bookings: upcoming, completed, cancelled, waitlist
- Analytics sample metrics (explicitly labelled)

## Guided tour & discovery

- `DemoProductTour` — optional overlay covering Dashboard, Players, Sessions, Reports, Website, Family, Billing, Analytics
- `DemoFeatureDiscovery` — subtle “How coaches use this” callouts per demo page

## Limitations

- Demo dashboard is a **showcase shell**, not the live authenticated managers (those still need a real account).
- Live Stripe Customer Portal / Subscribe buttons outside demo routes are unchanged (real users).
- Automations, AI insights, and push notifications are not fully simulated end-to-end.
- If a real academy later claims slug `riverside-united`, demos would take precedence — keep the slug reserved.
- Contact/booking “success” in demo does not create family claim tokens.

## Related

- Design system: `docs/design-system.md`
- Academy website: `docs/academy-website.md`
- Family journey: `docs/family-journey.md`
