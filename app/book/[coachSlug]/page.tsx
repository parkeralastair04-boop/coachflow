import type { Metadata } from "next";
import { BookingPortal } from "@/components/booking-portal";
import { absoluteSitePath } from "@/lib/site-url";
import { resolvePublicPortal } from "@/lib/public-booking";

type CoachBookPageProps = {
  params: Promise<{ coachSlug: string }>;
  searchParams: Promise<{
    booking?: string;
    subscription?: string;
    checkout_session_id?: string;
  }>;
};

export async function generateMetadata(props: CoachBookPageProps): Promise<Metadata> {
  const { coachSlug } = await props.params;
  const portal = await resolvePublicPortal({ kind: "coach", slug: coachSlug });
  const displayName = portal?.display_name ?? "Football coaching";
  const title = `${displayName} | Book Football Training`;
  const description = `Book football training sessions with ${displayName}.`;
  const path = `/book/${encodeURIComponent(coachSlug)}`;
  const canonical = absoluteSitePath(path);
  const imageUrl = portal?.logo_url?.trim() || null;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: displayName,
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  };
}

export default async function CoachBookPage(props: CoachBookPageProps) {
  const [{ coachSlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);

  return (
    <BookingPortal
      tenant={{ kind: "coach", slug: coachSlug }}
      initialQuery={{
        booking: searchParams.booking ?? null,
        subscription: searchParams.subscription ?? null,
        checkoutSessionId: searchParams.checkout_session_id ?? null,
      }}
    />
  );
}
