import type { CSSProperties } from "react";
import type { Metadata } from "next";
import type { PublicPortal } from "@/lib/public-booking";
import type { PublicAcademy } from "@/lib/academy-website-types";
import { buildAcademyOpenGraphMetadata } from "@/lib/academy-og";

export type AcademyWebsiteNavItem = {
  id: string;
  label: string;
  href: string | null;
  /** When false, item is reserved for a later phase and must not navigate. */
  available: boolean;
};

export type AcademyWebsitePageKey =
  | "home"
  | "about"
  | "coaches"
  | "teams"
  | "fixtures"
  | "results"
  | "training"
  | "camps"
  | "videos"
  | "gallery"
  | "news"
  | "article"
  | "contact";

const PAGE_META: Record<
  AcademyWebsitePageKey,
  { pathSuffix: string; title: string; description: (name: string) => string }
> = {
  home: {
    pathSuffix: "",
    title: "",
    description: (name) =>
      `Visit ${name} for football training information and online booking.`,
  },
  about: {
    pathSuffix: "/about",
    title: "About",
    description: (name) => `Learn more about ${name} and our football coaching approach.`,
  },
  coaches: {
    pathSuffix: "/coaches",
    title: "Coaches",
    description: (name) => `Meet the coaching team at ${name}.`,
  },
  teams: {
    pathSuffix: "/teams",
    title: "Teams",
    description: (name) => `Explore age groups and teams at ${name}.`,
  },
  fixtures: {
    pathSuffix: "/fixtures",
    title: "Fixtures",
    description: (name) => `Upcoming fixtures for ${name}.`,
  },
  results: {
    pathSuffix: "/results",
    title: "Results",
    description: (name) => `Latest match results for ${name}.`,
  },
  training: {
    pathSuffix: "/training",
    title: "Training",
    description: (name) => `Training information from ${name}.`,
  },
  camps: {
    pathSuffix: "/camps",
    title: "Holiday camps",
    description: (name) => `Holiday camps and clinics run by ${name}.`,
  },
  videos: {
    pathSuffix: "/videos",
    title: "Videos",
    description: (name) => `Public videos from ${name}.`,
  },
  gallery: {
    pathSuffix: "/gallery",
    title: "Gallery",
    description: (name) => `Photos from ${name}.`,
  },
  news: {
    pathSuffix: "/news",
    title: "News",
    description: (name) => `News and updates from ${name}.`,
  },
  article: {
    pathSuffix: "/news",
    title: "Article",
    description: (name) => `News from ${name}.`,
  },
  contact: {
    pathSuffix: "/contact",
    title: "Contact",
    description: (name) => `Contact ${name} for training and enquiries.`,
  },
};

export function getAcademyWebsitePaths(academySlug: string) {
  const base = `/academy/${encodeURIComponent(academySlug)}`;
  return {
    home: base,
    book: `${base}/book`,
    about: `${base}/about`,
    coaches: `${base}/coaches`,
    teams: `${base}/teams`,
    fixtures: `${base}/fixtures`,
    results: `${base}/results`,
    training: `${base}/training`,
    camps: `${base}/camps`,
    videos: `${base}/videos`,
    gallery: `${base}/gallery`,
    news: `${base}/news`,
    contact: `${base}/contact`,
    parentLogin: "/login?next=/family",
    privacy: "/privacy",
    terms: "/terms",
  };
}

export function getAcademyNewsArticlePath(academySlug: string, articleSlug: string): string {
  const paths = getAcademyWebsitePaths(academySlug);
  return `${paths.news}/${encodeURIComponent(articleSlug)}`;
}

export function getAcademyWebsiteNavItems(
  academySlug: string,
  availability?: Partial<Record<string, boolean>>,
): AcademyWebsiteNavItem[] {
  const paths = getAcademyWebsitePaths(academySlug);
  const isAvailable = (id: string, fallback = true) =>
    availability?.[id] ?? fallback;

  const items: AcademyWebsiteNavItem[] = [
    { id: "home", label: "Home", href: paths.home, available: true },
    { id: "about", label: "About", href: paths.about, available: true },
    {
      id: "coaches",
      label: "Coaches",
      href: paths.coaches,
      available: isAvailable("coaches"),
    },
    {
      id: "teams",
      label: "Teams",
      href: paths.teams,
      available: isAvailable("teams"),
    },
    {
      id: "fixtures",
      label: "Fixtures",
      href: paths.fixtures,
      available: isAvailable("fixtures"),
    },
    {
      id: "results",
      label: "Results",
      href: paths.results,
      available: isAvailable("results"),
    },
    {
      id: "camps",
      label: "Camps",
      href: paths.camps,
      available: isAvailable("camps"),
    },
    {
      id: "news",
      label: "News",
      href: paths.news,
      available: isAvailable("news"),
    },
    { id: "contact", label: "Contact", href: paths.contact, available: true },
    { id: "book", label: "Book Training", href: paths.book, available: true },
    {
      id: "parent",
      label: "Parent Login",
      href: paths.parentLogin,
      available: true,
    },
  ];

  // Never surface unavailable / unfinished sections (no coming-soon stubs in nav).
  return items.filter((item) => item.available);
}

type BrandThemeSource = {
  primaryColor: string;
  secondaryColor: string;
};

/** Theme tokens aligned with the public booking portal accent pattern. */
export function getAcademyWebsiteThemeStyle(
  source: PublicPortal | BrandThemeSource,
): CSSProperties {
  const primary =
    "primary_color" in source ? source.primary_color : source.primaryColor;
  const secondary =
    "secondary_color" in source ? source.secondary_color : source.secondaryColor;

  return {
    "--accent": primary,
    "--accent-dim": `${primary}24`,
    "--ring-glow": `${primary}66`,
    "--academy-secondary": secondary,
  } as CSSProperties;
}

export function getAcademyWebsiteIntroduction(
  source: Pick<PublicAcademy, "name" | "description"> | Pick<PublicPortal, "display_name">,
  description?: string | null,
): string {
  const name =
    "name" in source ? source.name : source.display_name;
  const fromAcademy = "description" in source ? source.description : null;
  const trimmed = (description ?? fromAcademy)?.trim();
  if (trimmed) return trimmed;
  return `${name} provides football coaching for players and families. Use this site to find training options and book sessions online.`;
}

export function buildAcademyWebsiteMetadata(args: {
  portal?: PublicPortal | null;
  academy?: PublicAcademy | null;
  academySlug: string;
  pathSuffix?: string;
  pageTitle?: string;
  pageDescription?: string;
  imageUrl?: string | null;
}): Metadata {
  const displayName =
    args.academy?.name?.trim() ||
    args.portal?.display_name?.trim() ||
    "Football academy";
  const title = args.pageTitle
    ? `${args.pageTitle} · ${displayName}`
    : `${displayName} · Football Academy`;
  const description =
    args.pageDescription?.trim() ||
    `Visit ${displayName} for football training information and online booking.`;
  const paths = getAcademyWebsitePaths(args.academySlug);
  const pagePath = args.pathSuffix ? `${paths.home}${args.pathSuffix}` : paths.home;
  const imageUrl =
    args.imageUrl?.trim() ||
    args.academy?.logoUrl?.trim() ||
    args.portal?.logo_url?.trim() ||
    null;

  return buildAcademyOpenGraphMetadata({
    academy: args.academy ?? null,
    academySlug: args.academySlug,
    title,
    description,
    path: pagePath,
    imageUrl,
  });
}

/**
 * Shared metadata builder for future academy website pages.
 * Prefer this over hand-rolled generateMetadata on each route.
 */
export function buildAcademyWebsitePageMetadata(args: {
  academy: PublicAcademy | null;
  academySlug: string;
  page: AcademyWebsitePageKey;
  pageTitle?: string;
  pageDescription?: string;
  pathSuffix?: string;
  imageUrl?: string | null;
}): Metadata {
  const meta = PAGE_META[args.page];
  const displayName = args.academy?.name?.trim() || "Football academy";

  return buildAcademyWebsiteMetadata({
    academy: args.academy,
    academySlug: args.academySlug,
    pathSuffix: args.pathSuffix ?? meta.pathSuffix,
    pageTitle:
      args.pageTitle?.trim() ||
      (args.page === "home" ? undefined : meta.title),
    pageDescription: args.pageDescription?.trim() || meta.description(displayName),
    imageUrl: args.imageUrl,
  });
}
