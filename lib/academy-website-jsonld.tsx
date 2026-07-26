import { absoluteSitePath } from "@/lib/site-url";
import type { PublicAcademy, PublicFixture, PublicNewsArticle } from "@/lib/academy-website-types";

function absoluteMaybe(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return absoluteSitePath(trimmed.startsWith("/") ? trimmed : `/${trimmed}`);
}

export function buildSportsClubJsonLd(args: {
  academy: PublicAcademy;
  academySlug: string;
}): Record<string, unknown> {
  const url = absoluteSitePath(`/academy/${encodeURIComponent(args.academySlug)}`);
  const logo = absoluteMaybe(args.academy.logoUrl);
  const email = args.academy.supportEmail?.trim() || null;
  const telephone = args.academy.supportPhone?.trim() || null;

  return {
    "@context": "https://schema.org",
    "@type": "SportsClub",
    name: args.academy.name,
    url,
    ...(logo ? { logo, image: logo } : {}),
    ...(email ? { email } : {}),
    ...(telephone ? { telephone } : {}),
  };
}

export function buildOrganizationJsonLd(args: {
  academy: PublicAcademy;
  academySlug: string;
}): Record<string, unknown> {
  const url = absoluteSitePath(`/academy/${encodeURIComponent(args.academySlug)}`);
  const logo = absoluteMaybe(args.academy.logoUrl);
  const email = args.academy.supportEmail?.trim() || null;
  const telephone = args.academy.supportPhone?.trim() || null;

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: args.academy.name,
    url,
    ...(logo ? { logo } : {}),
    ...(email ? { email } : {}),
    ...(telephone ? { telephone } : {}),
  };
}

export function buildSportsEventJsonLd(args: {
  fixture: PublicFixture;
  academyName: string;
  academySlug: string;
}): Record<string, unknown> {
  const startDate = args.fixture.kickoffTime
    ? `${args.fixture.kickoffDate}T${args.fixture.kickoffTime}`
    : args.fixture.kickoffDate;
  const locationName = [args.fixture.venue, args.fixture.pitch].filter(Boolean).join(" · ") || null;

  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: args.fixture.title,
    startDate,
    eventStatus: "https://schema.org/EventScheduled",
    organizer: {
      "@type": "SportsClub",
      name: args.academyName,
      url: absoluteSitePath(`/academy/${encodeURIComponent(args.academySlug)}`),
    },
    homeTeam: {
      "@type": "SportsTeam",
      name: args.fixture.isHome ? args.fixture.teamName : args.fixture.opposition,
    },
    awayTeam: {
      "@type": "SportsTeam",
      name: args.fixture.isHome ? args.fixture.opposition : args.fixture.teamName,
    },
    ...(locationName
      ? {
          location: {
            "@type": "Place",
            name: locationName,
          },
        }
      : {}),
    url: absoluteSitePath(`/academy/${encodeURIComponent(args.academySlug)}/fixtures`),
  };
}

export function buildNewsArticleJsonLd(args: {
  article: PublicNewsArticle;
  academyName: string;
  academySlug: string;
}): Record<string, unknown> {
  const url = absoluteSitePath(
    `/academy/${encodeURIComponent(args.academySlug)}/news/${encodeURIComponent(args.article.slug)}`,
  );
  const image = absoluteMaybe(args.article.coverImageUrl);

  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: args.article.title,
    description: args.article.summary || undefined,
    datePublished: args.article.publishedAt,
    mainEntityOfPage: url,
    url,
    author: {
      "@type": "Organization",
      name: args.academyName,
    },
    publisher: {
      "@type": "Organization",
      name: args.academyName,
    },
    ...(image ? { image: [image] } : {}),
  };
}

export function JsonLdScript({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
