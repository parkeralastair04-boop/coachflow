# Academy website

Launch Sprint 10 — public academy website architecture and ops.

## Architecture

Public routes live under `/academy/[academySlug]/(website)/*` with a shared branded shell:

- Layout resolves the academy via `getPublicAcademyContext`
- Theme tokens (`--accent`, `--academy-secondary`) come from academy branding
- Header/footer navigation is **content-aware** (`getAcademyWebsiteNavAvailability`)
- Booking lives at `/academy/[academySlug]/book` (same brand colours; link back to website)

Parent claim and family dashboard remain Awarix-authenticated surfaces (`/family/*`) after booking confirmation emails.

## Visibility rules

| Content | Public rule |
| --- | --- |
| Branding / booking | Public portal RPCs; sessions/series `is_public` |
| Teams | `teams.website_visible` (default true) |
| Fixtures / results | `matches.website_visible` + status/date filters (no squads/PII) |
| Camps | `camps.website_visible` (opt-in; existing rows grandfathered visible) |
| News | `published` + `published_at` |
| Coaches | `coach_public_profiles` for the academy |
| Gallery / Training brochure / Public videos | **Not shipped** — routes 404, omitted from nav & sitemap |
| Parent reports / video / training prep | `parent_visible` only — never reused for the open web |

Coaches publish camps with **Show on website** in Camps. Academy About/Contact copy uses `public_description` and `public_address` in Academy settings.

## Navigation

`getAcademyWebsiteNavItems` only returns available sections. Empty content sections are hidden (no “coming soon” stubs). Always available: Home, About, Contact, Book, Parent Login.

## SEO strategy

- Per-page `generateMetadata` + Open Graph via `buildAcademyWebsitePageMetadata`
- SportsClub / Organization / SportsEvent / NewsArticle JSON-LD where relevant
- Sitemap indexes core pages always; content pages only when available; never gallery/training/videos
- `robots.txt` allows `/academy/`, disallows dashboard/family/api
- Unavailable product pages set `robots: noindex` and call `notFound()`

## Public booking journey

Academy website → Book (academy branded) → Confirmation (email + claim/sign-in CTA) → `/family/claim` or `/login?next=/family` → Family dashboard.

Booking header includes **Academy website** when tenant is an academy so visitors do not feel they left the brand.

## Branding behaviour

- Website shell: logo, primary/secondary colours, public description/address
- Booking portal: same accent tokens from public portal
- Family portal: Awarix chrome (account surface); academy identity appears in emails and linked coach contacts

## Operational requirements

1. Apply migration `20260720140000_academy_website_visibility.sql`
2. Set Academy branding + public description/address in dashboard settings
3. Toggle camps **Show on website** for camps that should appear publicly
4. Publish news posts intentionally
5. Configure Turnstile env vars for contact form bot protection (see `docs/abuse-protection.md`)

## Commercial honesty

Academy plan markets: public website (Home/About/Coaches/Teams/Fixtures/Results/Camps/News/Contact), booking page, SEO, enquiries, white-label branding. It does **not** promise a public gallery, public training brochure, or public video library until those ship with `website_visible` content.
