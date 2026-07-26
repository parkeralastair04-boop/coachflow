/**
 * Marketing homepage content.
 * Screenshots: scripts/capture-marketing-screenshots.ts → public/marketing/screenshots/
 */

export type MarketingScreenshot = {
  src: string;
  alt: string;
  captureRoute: string;
};

export type MarketingPhoto = {
  src: string;
  alt: string;
};

export type MarketingFeature = {
  id: string;
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  screenshot: MarketingScreenshot;
  photo: MarketingPhoto;
  /** dark | light band */
  tone: "dark" | "light";
  photoSide: "left" | "right";
};

export type MarketingTestimonial = {
  quote: string;
  name: string;
  role: string;
  academy: string;
};

export type MarketingFaqItem = {
  question: string;
  answer: string;
};

export const MARKETING_SCREENSHOTS = {
  hero: {
    src: "/marketing/screenshots/hero-dashboard.png",
    alt: "Awarix Academy Pulse — squad, sessions, and bookings at a glance",
    captureRoute: "/demo/dashboard",
  },
  players: {
    src: "/marketing/screenshots/players.png",
    alt: "Active Squad in Awarix — player profiles and parent contacts",
    captureRoute: "/demo/dashboard/players",
  },
  sessions: {
    src: "/marketing/screenshots/sessions.png",
    alt: "Training Sessions in Awarix — plan and publish bookable training",
    captureRoute: "/demo/dashboard/sessions",
  },
  bookings: {
    src: "/marketing/screenshots/bookings.png",
    alt: "Parent Bookings in Awarix — confirmed places on training",
    captureRoute: "/demo/dashboard/bookings",
  },
  family: {
    src: "/marketing/screenshots/family.png",
    alt: "Parent portal in Awarix — training, reports, and payments",
    captureRoute: "/demo/dashboard/family",
  },
  reports: {
    src: "/marketing/screenshots/reports.png",
    alt: "AI player development reports in Awarix",
    captureRoute: "/demo/dashboard/reports",
  },
  analytics: {
    src: "/marketing/screenshots/analytics.png",
    alt: "Performance Insights in Awarix — attendance and squad patterns",
    captureRoute: "/demo/dashboard/analytics",
  },
} as const;

export const MARKETING_PHOTOS = {
  hero: {
    src: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=2400&q=85",
    alt: "Coach on a floodlit training pitch at dusk",
  },
  players: {
    src: "https://images.unsplash.com/photo-1529900748604-07564a03e7a6?auto=format&fit=crop&w=1400&q=85",
    alt: "Coach registering players at training",
  },
  sessions: {
    src: "https://images.unsplash.com/photo-1745778110673-c96c14d1c297?auto=format&fit=crop&w=1400&q=85",
    alt: "Coach surveying the pitch before session",
  },
  bookings: {
    src: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=1400&q=85",
    alt: "Players arriving for youth football training",
  },
  family: {
    src: "https://images.unsplash.com/photo-1529932398402-e0b30f66a559?auto=format&fit=crop&w=1400&q=85",
    alt: "Parent watching from the sideline",
  },
  reports: {
    src: "https://images.unsplash.com/photo-1631659718597-1b62ad76da3a?auto=format&fit=crop&w=1400&q=85",
    alt: "Coach giving feedback on the sideline",
  },
  analytics: {
    src: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1400&q=85",
    alt: "Coach reviewing notes at training",
  },
} as const;

export const MARKETING_HERO = {
  eyebrow: "Football intelligence platform",
  headline: "Develop players with clarity.",
  headlineAccent: "Coach with intelligence.",
  subhead:
    "Awarix helps coaches develop players through AI reports, player insights, and smarter coaching — with squads, sessions, and parent updates built for the pitch.",
  primaryCta: { label: "Start coaching free", href: "/signup" },
  secondaryCta: { label: "Explore live academy", href: "/demo" },
  photo: MARKETING_PHOTOS.hero,
  screenshot: MARKETING_SCREENSHOTS.hero,
} as const;

export const MARKETING_PILLARS = [
  {
    label: "Player intelligence",
    description: "Profiles, development, attendance",
  },
  {
    label: "Smarter coaching",
    description: "Sessions, plans, match insights",
  },
  {
    label: "AI reports",
    description: "Parent-ready development updates",
  },
  {
    label: "Academy ops",
    description: "Bookings, payments, family portal",
  },
] as const;

export const MARKETING_WORKFLOW = [
  {
    number: "01",
    title: "Build your squad",
    description: "Register players, assign squads, and keep parent contacts current.",
  },
  {
    number: "02",
    title: "Plan training",
    description: "Publish sessions, set capacity, and open parent booking.",
  },
  {
    number: "03",
    title: "Families book",
    description: "Parents confirm places and pay online when required.",
  },
  {
    number: "04",
    title: "Mark registers",
    description: "Take attendance pitch-side — mobile-first registers.",
  },
  {
    number: "05",
    title: "Share progress",
    description: "Development reports and updates reach parents automatically.",
  },
  {
    number: "06",
    title: "Match day ready",
    description: "Fixtures, availability, and match reports ready for kick-off.",
  },
] as const;

export const MARKETING_FEATURES: MarketingFeature[] = [
  {
    id: "squad",
    number: "01",
    eyebrow: "Active Squad",
    title: "Know every player in your squad.",
    description:
      "Register players, link parent contacts, and keep every age group ready for registers, reports, and match day.",
    bullets: [
      "Player profiles with parent details",
      "Age-group squads for every team",
      "Attendance trends at a glance",
    ],
    screenshot: MARKETING_SCREENSHOTS.players,
    photo: MARKETING_PHOTOS.players,
    tone: "dark",
    photoSide: "left",
  },
  {
    id: "sessions",
    number: "02",
    eyebrow: "Training Sessions",
    title: "Plan the week on the pitch.",
    description:
      "Publish group sessions, 1:1 blocks, and weekly packages. Set capacity, pricing, and locations — then open booking when you are ready.",
    bullets: [
      "Recurring weekly templates",
      "Capacity and pricing per session",
      "Availability that parents can book into",
    ],
    screenshot: MARKETING_SCREENSHOTS.sessions,
    photo: MARKETING_PHOTOS.sessions,
    tone: "light",
    photoSide: "right",
  },
  {
    id: "bookings",
    number: "03",
    eyebrow: "Parent Bookings",
    title: "Families book. You coach.",
    description:
      "Share a branded booking link. Parents confirm places, pay when required, and every booking lands on your list.",
    bullets: [
      "Public booking page for your academy",
      "Confirmed, waitlisted, and cancelled places",
      "Stripe checkout when payment is needed upfront",
    ],
    screenshot: MARKETING_SCREENSHOTS.bookings,
    photo: MARKETING_PHOTOS.bookings,
    tone: "dark",
    photoSide: "right",
  },
  {
    id: "family",
    number: "04",
    eyebrow: "Parent Portal",
    title: "Parents stay in the loop.",
    description:
      "After booking, families claim an account and view upcoming training, attendance, shared development notes, and payments.",
    bullets: [
      "Upcoming training per child",
      "Shared development reports",
      "Fees and invoices under one login",
    ],
    screenshot: MARKETING_SCREENSHOTS.family,
    photo: MARKETING_PHOTOS.family,
    tone: "light",
    photoSide: "left",
  },
  {
    id: "reports",
    number: "05",
    eyebrow: "AI Player Development",
    title: "Session notes → intelligent parent reports.",
    description:
      "Turn coaching observations into structured, parent-ready development updates with AI — then edit before anything is shared.",
    bullets: [
      "AI-drafted development reports",
      "Edit before parents see anything",
      "PDF export and share history",
    ],
    screenshot: MARKETING_SCREENSHOTS.reports,
    photo: MARKETING_PHOTOS.reports,
    tone: "dark",
    photoSide: "left",
  },
  {
    id: "insights",
    number: "06",
    eyebrow: "Performance Insights",
    title: "See the patterns that shape your squad.",
    description:
      "See bookings, attendance, and income together. Spot who is progressing, who needs a nudge, and how your academy is performing.",
    bullets: [
      "Bookings and attendance intelligence",
      "Monthly income overview",
      "Coach-ready academy insights",
    ],
    screenshot: MARKETING_SCREENSHOTS.analytics,
    photo: MARKETING_PHOTOS.analytics,
    tone: "light",
    photoSide: "right",
  },
];

/** Representative feedback — beta / demo academies, not fabricated customer logos. */
export const MARKETING_TESTIMONIALS: MarketingTestimonial[] = [
  {
    quote:
      "Awarix turned our session notes into reports parents actually read — and the insights tell us who needs attention next week.",
    name: "Sarah Chen",
    role: "Academy director",
    academy: "Riverside United (demo academy)",
  },
  {
    quote:
      "I still coach on the pitch. Awarix handles the intelligence layer — squads, bookings, and how each player is developing.",
    name: "Marcus Okonkwo",
    role: "Head coach, U14s",
    academy: "Grassroots beta coach",
  },
  {
    quote:
      "The AI reports sound like me, not a robot. Parents finally understand how their child is developing.",
    name: "Elena Vasquez",
    role: "Technical director",
    academy: "Beta programme",
  },
];

export const MARKETING_FAQ: MarketingFaqItem[] = [
  {
    question: "Is Awarix only for large academies?",
    answer:
      "No. Starter is built for independent coaches and small squads. Pro and Academy add registers, analytics, payments, and a public website as you grow.",
  },
  {
    question: "Can I try it before paying?",
    answer:
      "Yes. Every plan includes a 7-day free trial with no payment today. You can also explore the live demo with sample academy data — no signup required.",
  },
  {
    question: "Are the screenshots on this page real?",
    answer:
      "Yes. Every product image is captured from the live Awarix demo academy — the same screens you can open at /demo.",
  },
  {
    question: "Do parents need their own login?",
    answer:
      "After booking, families can claim a parent account to view sessions, attendance, shared reports, and payments. You control what is shared.",
  },
  {
    question: "How is Awarix different from admin software?",
    answer:
      "Awarix is built as football intelligence — AI reports, player insights, and smarter coaching workflows — not a generic spreadsheet replacement with a sports theme.",
  },
  {
    question: "Can I take payments from parents?",
    answer:
      "On Pro and Academy plans you can connect Stripe for parent subscriptions and booking checkout. Starter includes Awarix billing for your own subscription.",
  },
];

export const MARKETING_FINAL_CTA = {
  headline: "Ready to coach with intelligence?",
  subhead:
    "Join academies using Awarix to develop players through AI reports, insights, and smarter coaching.",
  primaryCta: { label: "Start coaching free", href: "/signup" },
  secondaryCta: { label: "Explore live academy", href: "/demo" },
} as const;
