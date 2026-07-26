import type { Metadata } from "next";
import { absoluteSitePath } from "@/lib/site-url";
import type { PublicAcademy } from "@/lib/academy-website-types";

type AcademyOgArgs = {
  academy: PublicAcademy | null;
  academySlug: string;
  title: string;
  description: string;
  path: string;
  imageUrl?: string | null;
};

/**
 * Academy OG / Twitter / canonical helper.
 * Prefer buildAcademyWebsitePageMetadata for full page metadata;
 * use this when composing custom metadata (e.g. booking).
 */
export function buildAcademyOpenGraphMetadata(args: AcademyOgArgs): Metadata {
  const displayName = args.academy?.name?.trim() || "Football academy";
  const canonical = absoluteSitePath(args.path);
  const imageUrl =
    args.imageUrl?.trim() || args.academy?.logoUrl?.trim() || null;

  return {
    title: { absolute: args.title },
    description: args.description,
    alternates: { canonical },
    openGraph: {
      title: args.title,
      description: args.description,
      type: "website",
      url: canonical,
      siteName: displayName,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title: args.title,
      description: args.description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}
