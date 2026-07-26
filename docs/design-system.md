# Awarix design system

Visual language and interaction patterns for consistent UX.  
**No business logic lives here** — only presentation and accessibility.

## Principles

1. Prefer shared primitives in `components/ui/` over one-off Tailwind recipes.
2. One job per control: primary action, secondary action, destructive confirm.
3. Skeletons for content loading; spinners only on in-button busy states.
4. Respect `prefers-reduced-motion` (see `app/globals.css`).
5. Never invent a third card/button style when an existing variant fits.

## Tokens

| Layer | Source |
| --- | --- |
| Colour / surface CSS vars | `app/globals.css` (`--accent`, `--foreground`, `--card`, …) |
| Motion CSS vars | `--motion-fast/base/slow`, `--motion-ease` |
| TS tokens | `lib/ui/tokens.ts` (`TYPE`, `SPACE`, `ICON_SIZES`, `FOCUS_RING`) |
| Button recipes | `lib/ui/button-variants.ts` |

Fonts: Geist Sans / Geist Mono via `app/layout.tsx` (`--font-geist-sans`).

## Components

Import from `@/components/ui` or specific files.

### Button

```tsx
import { Button, buttonVariants } from "@/components/ui/button";

<Button variant="primary">Save</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Filter</Button>
<Button variant="ghost">Skip</Button>
<Button variant="accent">Book</Button> // academy / marketing accent
<Button variant="icon" aria-label="Close"><X /></Button>

// Links
<Link href="/signup" className={buttonVariants({ variant: "primary" })} />
```

| Variant | Use |
| --- | --- |
| `primary` | Default app CTA (`bg-foreground`) |
| `accent` | Brand / academy CTA (`bg-accent`) |
| `secondary` / `outline` | Secondary actions |
| `destructive` | Irreversible confirms |
| `ghost` | Low-emphasis / text actions |
| `icon` | Icon-only controls (require `aria-label`) |

Shapes: `pill` (default) or `soft` (`rounded-xl` for dashboard toolbars).  
Sizes: `sm` | `md` | `lg` | `icon`.

### Forms

`Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Label`, `FieldHint`, `FieldError` from `@/components/ui/field`.

- Height `h-11`, `rounded-xl`, focus ring via `FOCUS_RING`.
- Form-level errors: `FormErrorAlert`.
- Form-level success: `FormSuccessAlert`.
- Field-level errors: `FieldError` + `aria-invalid` / `aria-describedby`.

### Cards

`Card` variants: `default` (football panel), `muted`, `interactive` (lift), `flush`, `stat`, `pitch`.  
Plus `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.

Domain cards (academy, overview widgets) should wrap `Card` / `FootballPanel` rather than inventing new borders.

Surface recipes also live in `SURFACE` (`lib/ui/tokens.ts`): `panel`, `panelInteractive`, `panelSpacious`, `iconBadge`.

Radii:
- Controls: `rounded-xl`
- Panels / cards: `rounded-2xl`
- Auth / hero shells: `rounded-[2rem]` or `rounded-3xl`

Panel padding: `p-5 sm:p-6` (standard). Reserve `p-6 sm:p-8` only for sparse empty/setup panels.

### Empty states

- Dashboard: `EmptyState` (`components/empty-state.tsx`)
- Academy website: `AcademyWebsiteEmptyState` (specialised public tone)

Do not invent new empty layouts unless the experience is genuinely specialised (e.g. first-run wizard).

### Loading

- Route / section: `BrandedLoading` (cold entry), `ContentSkeleton` / `PanelSkeleton` (in-shell)
- Inline placeholders: `Skeleton`, `SkeletonText`, `TableSkeleton`
- Button busy: small `Loader2` **inside** the button only
- Prefer skeletons over full-page spinners inside the dashboard shell

### Tables

`Table`, `TableHead`, `TableBody`, `TableRow`, `TableHeaderCell`, `TableCell`, `TableEmpty`, `TableSkeleton`.

- Horizontal scroll on small screens (`min-w` + overflow wrapper).
- Empty: `TableEmpty` or page-level `EmptyState`.
- Loading: `TableSkeleton`.

### Dialogs

`Dialog`, `ConfirmDialog`, `AlertBanner` in `components/ui/dialog.tsx`.

- Escape closes; focus returns to opener.
- Sizes: `sm` | `md` | `lg` | `xl`.
- Destructive confirms use `ConfirmDialog` with `destructive`.

### Toasts

`ToastProvider` (root layout) + `useToast()`:

```tsx
const toast = useToast();
toast.push({ tone: "success", title: "Saved" });
toast.push({ tone: "error", title: "Could not save", description: "…" });
```

Tones: `success` | `warning` | `error` | `info` | `loading`.

### Icons

`AppIcon` — sizes `xs`–`xl` from `ICON_SIZES`.  
Decorative: omit `label`. Meaningful: pass `label` (aria-label).

## Typography

Use `TYPE` from `lib/ui/tokens.ts`:

| Token | Role |
| --- | --- |
| `pageTitle` | Dashboard / feature page H1 |
| `sectionTitle` | Card / section H2–H3 |
| `cardTitle` | Compact card titles |
| `label` | Form labels |
| `description` | Supporting copy |
| `helper` | Hints under fields |
| `tableHeader` / `tableCell` | Data tables |
| `marketingHero` / `marketingLead` | Marketing only |

## Motion

Classes: `motion-fade-in`, `motion-press`, `motion-card-lift`.  
Timing: 150–220ms, easing `cubic-bezier(0.22, 1, 0.36, 1)`.  
Reduced motion: animations/transitions disabled in CSS media query.

## Accessibility

- Interactive targets ≥ 44px (`min-h-11` / `size-11`).
- Visible focus rings (`FOCUS_RING` / `focus-visible`).
- Errors: `role="alert"` + live regions.
- Icon-only buttons always labelled.
- Dialogs: `aria-modal`, labelled by title, Escape to close.
- Do not rely on colour alone for status (pair with text).

## Interaction rules

1. One primary button per obvious action group.
2. Destructive actions require confirmation (`ConfirmDialog`).
3. Disable + busy label while mutating; keep layout stable.
4. Prefer optimistic UI only when reversible; otherwise wait for success toast/alert.

## Migration notes

New UI **must** use `components/ui/*`.  
Legacy managers may still use raw Tailwind class strings — migrate opportunistically to `Button` / `Input` / `EmptyState` / `Card` when touching those files.

`EmptyState` variants:

- `panel` (default) — glass card for page-level empties
- `plain` — nested empties inside an existing card

Specialised experiences that may diverge:

- Onboarding wizard / celebrations
- Academy website empty sections (`AcademyWebsiteEmptyState`)
- Setup-required / entitlement gates (`SetupRequiredPanel`)
- Coach setup guidance (`CoachSetupGuidance`)
