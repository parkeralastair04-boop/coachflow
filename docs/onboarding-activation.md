# Awarix onboarding & activation

First-run experience for new coaches. Goal: academy → session → booking page →
shared link in under 10 minutes.

## Activation funnel

```
Signup (+ email verification)
        ↓
Create academy (publishes booking page)
        ↓
Create first public session
        ↓
Copy / share booking link
        ↓
First parent booking (celebration)
```

Optional after activation: players, teams, reports, finance, website tools.

## Checklist rules

Critical path items (`lib/onboarding.ts` → `buildOnboardingProgress`):

| Key | Complete when |
|-----|----------------|
| `academy` | Coach has an academy membership |
| `session` | At least one session exists |
| `booking_page` | `coach_public_profiles.booking_enabled` + slug |
| `booking_link` | `user_metadata.onboarding_booking_link_shared` |

Players/teams **do not** block checklist completion.

Wizard steps (4): academy → session → share link → ready. Legacy 6-step metadata
is migrated via `migrateOnboardingStep`.

## Completion logic

- `onboarding_completed_at` in Auth `user_metadata` marks wizard finished.
- Checklist `isComplete` is factual (DB + link flag) and may complete before or
  after the wizard finish step.
- Getting Started card stays visible until **both** wizard completed **and**
  checklist complete.
- Progress survives refresh / re-login via Auth metadata + DB counts.

## First-run dashboard

When the coach has **no players, no sessions, and no bookings**,
`app/dashboard/page.tsx` renders `FirstRunDashboard` instead of advanced widgets
(finance, risk, AI, empty charts).

## Navigation during setup

While activation is incomplete (`isActivationSetupIncomplete`), the sidebar
shows only overview / coaching essentials / settings via
`filterNavForSetupPhase`.

## Celebrations

One-time flags in `user_metadata.activation_celebrations`:

- `academy_created`
- `session_published`
- `booking_link_copied`
- `first_booking`
- `first_parent` (reserved)

Persisted across devices (Auth metadata), not `sessionStorage`.

## Event tracking

Table: `public.coach_activation_events`  
API: `POST /api/activation/event`  
Client helper: `trackActivationEvent()` in `lib/activation-client.ts`

Events: `signup_complete`, `academy_created`, `first_session`,
`booking_page_published`, `booking_link_copied`, `first_booking_received`,
`first_parent_account`.

Apply migration `20260719160000_coach_activation_events.sql`.

## Verification

Signup shows clearer recovery copy and **Resend verification email** via
`supabase.auth.resend({ type: "signup" })`. Expired-link errors map to recovery
guidance in `lib/user-facing-errors.ts`.
