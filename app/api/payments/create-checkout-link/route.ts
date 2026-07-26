import { NextResponse } from "next/server";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { getStripeServerClient } from "@/lib/stripe";
import {
  ensureStripeCustomerForParent,
  loadPlayerForCoach,
  type ParentPlayerRow,
  requireParentPaymentsAccess,
} from "@/lib/parent-payments";
import { isValidSubscriptionAmount } from "@/lib/validation/amounts";
import { rejectDemoMutation } from "@/lib/demo/http-guard";

type BillingInterval = "monthly" | "weekly";

type CheckoutLinkBody = {
  playerId?: string;
  amount?: number;
  interval?: BillingInterval;
  sendEmail?: boolean;
};

const intervalToStripeInterval: Record<BillingInterval, "month" | "week"> = {
  monthly: "month",
  weekly: "week",
};

export const runtime = "nodejs";

function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amount / 100);
}

function emailHtml(args: {
  parentName: string | null;
  playerName: string;
  checkoutUrl: string;
  amount: number;
  interval: BillingInterval;
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
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#86efac;">Awarix</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">Payment setup for ${args.playerName}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  Please use the secure Stripe checkout link below to set up ${formatMoney(args.amount)} ${args.interval} coaching payments for ${args.playerName}.
                </p>
                <p style="margin:24px 0;">
                  <a href="${args.checkoutUrl}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 22px;font-weight:600;">Open secure checkout</a>
                </p>
                <p style="margin:0 0 16px;color:#6b7280;line-height:1.65;font-size:13px;">
                  If the button does not work, copy and paste this link into your browser:<br />
                  <a href="${args.checkoutUrl}" style="color:#047857;">${args.checkoutUrl}</a>
                </p>
                <p style="margin:0;color:#111827;line-height:1.65;font-weight:600;">The Awarix Team</p>
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
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.paymentsWrite,
      route: "/api/payments/create-checkout-link",
    });
    if (limited) return limited;

    const demoBlocked = rejectDemoMutation(request, "create a parent checkout link");
    if (demoBlocked) return demoBlocked;

    const access = await requireParentPaymentsAccess();
    if (!access.ok) return access.response;

    const body = (await request.json()) as CheckoutLinkBody;
    const playerId = body.playerId?.trim();
    const interval = body.interval;
    const amount = Number(body.amount);

    if (!playerId) {
      return NextResponse.json(
        { error: "playerId is required." },
        { status: 400 },
      );
    }
    if (interval !== "monthly" && interval !== "weekly") {
      return NextResponse.json(
        { error: "interval must be monthly or weekly." },
        { status: 400 },
      );
    }
    if (!isValidSubscriptionAmount(amount)) {
      return NextResponse.json(
        { error: "amount must be at least 100 pence." },
        { status: 400 },
      );
    }

    const { data: player, error: playerError } = await loadPlayerForCoach(
      access.supabase,
      access.coachId,
      playerId,
    );

    if (playerError) {
      return NextResponse.json({ error: playerError.message }, { status: 404 });
    }

    const safePlayer = player as ParentPlayerRow | null;
    if (!safePlayer) {
      return NextResponse.json(
        { error: "Selected player was not found." },
        { status: 404 },
      );
    }

    const customer = await ensureStripeCustomerForParent(safePlayer);
    const stripe = getStripeServerClient();
    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customer.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            product_data: {
              name: `Awarix coaching subscription - ${safePlayer.player_name}`,
            },
            recurring: {
              interval: intervalToStripeInterval[interval],
            },
            unit_amount: amount,
          },
        },
      ],
      success_url: `${origin}/dashboard/payments?checkout=success`,
      cancel_url: `${origin}/dashboard/payments?checkout=cancelled`,
      metadata: {
        coach_id: access.coachId,
        player_id: playerId,
        billing_interval: interval,
        amount: String(amount),
      },
      subscription_data: {
        metadata: {
          coach_id: access.coachId,
          player_id: playerId,
          billing_interval: interval,
          amount: String(amount),
        },
      },
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Could not create checkout link." },
        { status: 500 },
      );
    }

    if (body.sendEmail) {
      const parentEmail = safePlayer.parent_email?.trim();
      if (!parentEmail) {
        return NextResponse.json(
          { error: "This player does not have a parent email address." },
          { status: 400 },
        );
      }

      const resend = getResendServerClient();
      const { error } = await resend.emails.send({
        from: resendFromEmail,
        to: parentEmail,
        subject: `Payment setup for ${safePlayer.player_name}`,
        html: emailHtml({
          parentName: safePlayer.parent_name,
          playerName: safePlayer.player_name,
          checkoutUrl: session.url,
          amount,
          interval,
        }),
        text: `${safePlayer.parent_name ? `Hi ${safePlayer.parent_name},` : "Hi,"}

Please use this secure Stripe checkout link to set up ${formatMoney(amount)} ${interval} coaching payments for ${safePlayer.player_name}:

${session.url}

The Awarix Team`,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 502 });
      }
    }

    return NextResponse.json({ url: session.url, emailed: Boolean(body.sendEmail) });
  } catch (error: unknown) {
    const message =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unable to create checkout link.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
