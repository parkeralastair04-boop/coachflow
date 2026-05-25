import type { Metadata } from "next";
import { BookingPortal } from "@/components/booking-portal";

type AcademyBookPageProps = {
  params: Promise<{ academySlug: string }>;
  searchParams: Promise<{
    booking?: string;
    subscription?: string;
    checkout_session_id?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Academy Booking Portal",
};

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
