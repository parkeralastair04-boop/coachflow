import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicAcademyContext } from "@/lib/academy-website-data";

type UnavailablePageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: UnavailablePageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  void academySlug;
  return {
    title: "Not found",
    robots: { index: false, follow: false },
  };
}

/** Public video pages are not shipped — parent-visible clips stay in the family portal. */
export default async function AcademyVideosPage(props: UnavailablePageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();
  notFound();
}
