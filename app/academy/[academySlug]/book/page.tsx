import type { Metadata } from "next";
import { BookingPortal } from "@/components/booking-portal";
import { buildAcademyWebsiteMetadata } from "@/lib/academy-website";
import { getPublicAcademyContext } from "@/lib/academy-website-data";

type AcademyBookPageProps = {
  params: Promise<{ academySlug: string }>;
  searchParams: Promise<{
    booking?: string;
    subscription?: string;
    checkout_session_id?: string;
  }>;
};

export async function generateMetadata(props: AcademyBookPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  const displayName = context?.academy.name?.trim() || "Football coaching";

  return buildAcademyWebsiteMetadata({
    academy: context?.academy ?? null,
    academySlug,
    pathSuffix: "/book",
    pageTitle: "Book training",
    pageDescription: `Book football training sessions with ${displayName}.`,
  });
}

export default async function AcademyBookPage(props: AcademyBookPageProps) {
  const [{ academySlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  return (
    <BookingPortal
      tenant={{ kind: "academy", slug: academySlug }}
      initialQuery={{
        booking: searchParams.booking ?? null,
        subscription: searchParams.subscription ?? null,
        checkoutSessionId: searchParams.checkout_session_id ?? null,
      }}
    />
  );
}
