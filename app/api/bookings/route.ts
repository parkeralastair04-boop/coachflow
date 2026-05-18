import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { getStripeServerClient } from "@/lib/stripe";
import { getPublicAcademyForCoach } from "@/lib/academy";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

type BookingBody = {
  childName?: string;
  childDateOfBirth?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  serviceType?: string;
  notes?: string;
  redirectToCheckout?: boolean;
};

const servicePrices: Record<string, { label: string; amount: number }> = {
  "1-to-1": { label: "1-to-1 coaching session", amount: 4500 },
  group: { label: "Group coaching session", amount: 1500 },
  camp: { label: "Holiday camp booking", amount: 12000 },
};

export const runtime = "nodejs";

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return "Unable to submit booking.";
}

function confirmationHtml(args: {
  parentName: string;
  childName: string;
  serviceLabel: string;
  academyName: string;
  primaryColor: string;
}) {
  const greeting = args.parentName ? `Hi ${args.parentName},` : "Hi,";
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px;background:#0f172a;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${args.primaryColor};">${args.academyName}</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">Booking request received</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  Thanks for requesting ${args.serviceLabel} for ${args.childName}. Your booking is pending and the ${args.academyName} team will confirm availability shortly.
                </p>
                <p style="margin:0;color:#111827;line-height:1.65;font-weight:600;">${args.academyName}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const coachId = process.env.BOOKING_COACH_ID ?? process.env.NEXT_PUBLIC_BOOKING_COACH_ID;
    if (!coachId) {
      return NextResponse.json(
        { error: "Missing BOOKING_COACH_ID environment variable." },
        { status: 500 },
      );
    }
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Missing Supabase environment variables." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as BookingBody;
    const childName = body.childName?.trim();
    const parentEmail = body.parentEmail?.trim();
    const serviceType = body.serviceType?.trim();

    if (!childName || !parentEmail || !serviceType) {
      return NextResponse.json(
        { error: "Child name, parent email, and service are required." },
        { status: 400 },
      );
    }

    const service = servicePrices[serviceType];
    if (!service) {
      return NextResponse.json(
        { error: "Selected service is not available." },
        { status: 400 },
      );
    }

    const academy = await getPublicAcademyForCoach(coachId);
    const academyName = academy?.name ?? "CoachFlow";
    const primaryColor = academy?.primary_color ?? "#10b981";

    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });

    const { data, error } = await supabase.rpc("create_public_booking", {
      p_coach_id: coachId,
      p_child_name: childName,
      p_child_date_of_birth: body.childDateOfBirth || null,
      p_parent_name: body.parentName?.trim() || null,
      p_parent_email: parentEmail,
      p_parent_phone: body.parentPhone?.trim() || null,
      p_service_type: serviceType,
      p_notes: body.notes?.trim() || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let checkoutUrl: string | null = null;
    if (body.redirectToCheckout) {
      const stripe = getStripeServerClient();
      const origin = new URL(request.url).origin;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: parentEmail,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "gbp",
              product_data: {
                name: service.label,
              },
              unit_amount: service.amount,
            },
          },
        ],
        success_url: `${origin}/book?booking=success`,
        cancel_url: `${origin}/book?booking=pending`,
        metadata: {
          coach_id: coachId,
          player_id: data?.[0]?.player_id ?? "",
          booking_id: data?.[0]?.booking_id ?? "",
          service_type: serviceType,
        },
      });
      checkoutUrl = session.url;
    }

    try {
      const resend = getResendServerClient();
      await resend.emails.send({
        from: resendFromEmail,
        to: parentEmail,
        subject: `Booking request received for ${childName}`,
        html: confirmationHtml({
          parentName: body.parentName?.trim() ?? "",
          childName,
          serviceLabel: service.label,
          academyName,
          primaryColor,
        }),
        text: `Hi${body.parentName ? ` ${body.parentName}` : ""},

Thanks for requesting ${service.label} for ${childName}. Your booking is pending and the ${academyName} team will confirm availability shortly.

${academyName}`,
      });
    } catch {
      // Booking should still succeed if email delivery is temporarily unavailable.
    }

    return NextResponse.json({
      bookingId: data?.[0]?.booking_id ?? null,
      playerId: data?.[0]?.player_id ?? null,
      checkoutUrl,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
