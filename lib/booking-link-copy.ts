export const BOOKING_LINK_GUIDANCE = {
  headline: "Which booking link should I share?",
  primaryIntro:
    "Share one link with parents. They pick a session, enter their child's details, and book online — no back-and-forth on WhatsApp.",
  coachPage: {
    title: "Coach booking page",
    description:
      "Your personal page at /book/your-name. Ideal when you coach on your own or want a simple link straight to your sessions.",
  },
  academyPage: {
    title: "Academy booking page",
    description:
      "Your branded club page at /academy/your-club/book. Shows your academy name and branding — best for squads and multi-coach setups.",
  },
  whichToShare:
    "If you set up a club or academy name during onboarding, share your academy link — that's the one parents see on your branded page. Otherwise share your coach link.",
  whatsAppExample: (url: string) =>
    `Hi everyone — book this week's training here: ${url}`,
  emailExample: {
    subject: "Book training sessions online",
    body: (url: string) =>
      `Hi,\n\nYou can now book training sessions online here:\n${url}\n\nPick a session, add your child's details, and you're done.\n\nThanks!`,
  },
} as const;

export function getRecommendedBookingUrl(args: {
  academySlug: string | null;
  coachSlug: string | null;
  origin: string;
}): { url: string | null; kind: "academy" | "coach" | null } {
  const origin = args.origin.replace(/\/$/, "");
  if (args.academySlug) {
    return { url: `${origin}/academy/${args.academySlug}/book`, kind: "academy" };
  }
  if (args.coachSlug) {
    return { url: `${origin}/book/${args.coachSlug}`, kind: "coach" };
  }
  return { url: null, kind: null };
}
