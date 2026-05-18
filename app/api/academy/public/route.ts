import { NextResponse } from "next/server";
import { getPublicAcademyForCoach } from "@/lib/academy";

export async function GET() {
  const coachId = process.env.BOOKING_COACH_ID ?? process.env.NEXT_PUBLIC_BOOKING_COACH_ID;
  if (!coachId) {
    return NextResponse.json({ academy: null });
  }

  const academy = await getPublicAcademyForCoach(coachId);
  return NextResponse.json({ academy });
}
