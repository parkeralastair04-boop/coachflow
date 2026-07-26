# Family journey (parent portal)

Launch Sprint 9 — booking → claim → family dashboard.

## End-to-end path

1. Parent books a session (public booking portal).
2. Confirmation email is sent (free booking immediately; paid after Stripe webhook confirm).
3. If no Awarix account exists for that email, a **claim invite** is created and linked in the email.
4. Parent opens `/family/claim?token=…`, sets a password (email ownership proven by the token).
5. Parent lands on `/family?welcome=1` with a success moment + lightweight onboarding.
6. Parent views bookings, shared reports, payments, and manages children under `/family/manage`.

Existing accounts receive a **sign in** CTA to `/login?next=/family` instead of a claim token.

## Claim flow

| Property | Behaviour |
| --- | --- |
| Token | 32-byte random `base64url`, stored only as SHA-256 hash |
| TTL | 7 days |
| Replay | `used_at` set atomically; second redeem fails |
| Revocation | New invite for the same email revokes unused prior claims |
| Recovery | `/family/claim` without a valid token can reissue by parent email (only if a linked player exists) |
| Email confirm | Admin `createUser` with `email_confirm: true` — token delivery is the ownership proof |

Tables: `public.parent_account_claims` (service role only).

APIs:

- `GET /api/family/claim?token=` — lookup status (no secrets beyond email/child/academy labels)
- `POST /api/family/claim` — `action: claim | reissue`

## Identity model

Parents are normal Supabase auth users. There is no separate parent role table.

**Join key:** case-insensitive match of `auth.users.email` ↔ `players.parent_email`.

Family APIs gate with `requireParentPortalAccess()`, then scope every child mutation by that email (`loadPlayerOwnedByParent`). Academy/coach scope is inherited from the player row — parents cannot escalate by guessing IDs across academies.

Coach SaaS entitlements never apply to parent accounts; parents must not be routed into the coach dashboard as a substitute for `/family`.

## Visibility rules

| Content | Parent can see when |
| --- | --- |
| Progress reports | `progress_reports.parent_visible = true` (emailing a report also sets this) |
| Training prep | `training_plans.parent_visible = true` |
| Video clips | `video_clips.parent_visible = true` |
| Match squads | Child on squad; full published roster only if `squad_published` |
| Bookings / attendance / payments | Always for linked children (email match) |

Coaches share reports via **Share with parent** on saved reports, or by sending the report email.

Migration grandfather: existing reports were set visible once so current families were not blanked overnight. New reports default to hidden until shared.

## Notification lifecycle

Consistent parent notification kinds (`lib/parent-notifications.ts`):

- booking confirmed (includes claim/sign-in CTA)
- session reminder (template ready for scheduled send)
- report shared (email + portal CTA)
- payment received (tracked via payment journey events on confirm)
- session cancelled (template ready for coach-triggered send)

Booking and report emails always offer a next step into the family portal — never a dead end.

## Parent Stripe customers

`ensureStripeCustomerForParent`:

1. Prefer `parent_subscriptions.stripe_customer_id` for that player.
2. Else reuse an email-listed Stripe customer only if it is **not** bound to `awarix_user_id` (coach SaaS) and not tagged to a different `player_id`.
3. Else create a new customer with `customer_kind=parent_payment`.

Email alone never claims a coach SaaS customer. Full parent↔Stripe user binding remains a deferred hardening item.

## Analytics

Table: `public.parent_journey_events`

Events: `claim_account`, `first_login`, `return_visit`, `report_opened`, `booking_completed`, `payment_completed`, `notification_opened`.

Client posts interactive events to `POST /api/family/events`. Server records booking/payment/claim.

Coach activation also records `first_parent_account` when a claim succeeds.

## Ops

Apply migration `20260720120000_parent_journey.sql` before relying on claim tokens or report visibility filters.
