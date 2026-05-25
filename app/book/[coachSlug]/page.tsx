import type { Metadata } from "next";
import { BookingPortal } from "@/components/booking-portal";

type CoachBookPageProps = {
  params: Promise<{ coachSlug: string }>;
  searchParams: Promise<{
    booking?: string;
    subscription?: string;
    checkout_session_id?: string;
  }>;
};

export const metadata: Metadata = {
  title: "Coach Booking Portal",
};

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
