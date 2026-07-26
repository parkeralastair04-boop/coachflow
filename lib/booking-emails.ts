import { absoluteSitePath } from "@/lib/site-url";
import {
  buildParentPortalCtaHtml,
  buildParentPortalCtaText,
} from "@/lib/parent-notifications";

type BookingEmailKind = "confirmed" | "waitlist";

type BookingEmailArgs = {
  kind: BookingEmailKind;
  academyName: string;
  primaryColor: string;
  parentName: string;
  childName: string;
  sessionLabel: string;
  sessionDate: string;
  location?: string | null;
  /** When false, confirmation copy omits payment-received wording (free sessions). */
  paid?: boolean;
  supportEmail?: string | null;
  /** Continuous journey CTA: claim account or open family portal. */
  portalInviteUrl?: string | null;
  portalInviteKind?: "claim" | "sign_in" | null;
};

type EmailFooterArgs = {
  supportEmail?: string | null;
};

export const FAILED_PAYMENT_EMAIL_SUBJECT = "Payment issue for your football training";

export function getSessionBookingEmailSubject(args: {
  kind: BookingEmailKind;
  paid?: boolean;
}): string {
  if (args.kind === "waitlist") return "Added to the waiting list";
  if (args.paid === false) return "Training place confirmed";
  return "Training booking confirmed";
}

export function getRecurringBookingEmailSubject(): string {
  return "Weekly training package confirmed";
}

function buildEmailFooterHtml(args: EmailFooterArgs): string {
  const privacyUrl = absoluteSitePath("/privacy");
  const termsUrl = absoluteSitePath("/terms");
  const supportEmail = args.supportEmail?.trim();
  const emailLine = supportEmail
    ? `<p style="margin:0 0 8px;"><a href="mailto:${supportEmail}" style="color:#374151;text-decoration:underline;">${supportEmail}</a></p>`
    : "";

  return `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.65;">
    <p style="margin:0 0 8px;">Questions? Contact your coach</p>
    ${emailLine}
    <p style="margin:0 0 8px;"><a href="${privacyUrl}" style="color:#374151;text-decoration:underline;">Privacy Policy</a> · <a href="${termsUrl}" style="color:#374151;text-decoration:underline;">Terms of Service</a></p>
    <p style="margin:0;font-size:11px;color:#9ca3af;">Powered by Awarix</p>
  </div>`;
}

function buildEmailFooterText(args: EmailFooterArgs): string[] {
  const privacyUrl = absoluteSitePath("/privacy");
  const termsUrl = absoluteSitePath("/terms");
  const lines: string[] = ["Questions? Contact your coach"];
  const supportEmail = args.supportEmail?.trim();
  if (supportEmail) {
    lines.push(supportEmail);
  }
  lines.push("", "Privacy Policy", privacyUrl, "Terms of Service", termsUrl, "", "Powered by Awarix");
  return lines;
}

function getHeading(args: Pick<BookingEmailArgs, "kind" | "paid">) {
  return getSessionBookingEmailSubject(args);
}

function formatSessionDetails(args: BookingEmailArgs) {
  const locationLine = args.location?.trim() ? `\nLocation: ${args.location}` : "";
  return `${args.sessionLabel}\n${args.sessionDate}${locationLine}`;
}

function getBody(args: BookingEmailArgs) {
  const sessionDetails = formatSessionDetails(args);

  if (args.kind === "confirmed") {
    if (args.paid === false) {
      return ["Your child's place has been secured.", sessionDetails];
    }

    return [
      "Thank you for booking.",
      "Your child's place has been confirmed.",
      sessionDetails,
    ];
  }

  return [
    sessionDetails,
    "No payment is required.",
    "We'll contact you if a space becomes available.",
  ];
}

function buildPortalInviteBlockHtml(args: BookingEmailArgs): string {
  if (!args.portalInviteUrl?.trim() || !args.portalInviteKind) return "";
  const intro =
    args.portalInviteKind === "claim"
      ? `<p style="margin:0 0 8px;color:#374151;line-height:1.65;">Next step: create your free Awarix family account to view bookings, reports, and manage your child.</p>`
      : `<p style="margin:0 0 8px;color:#374151;line-height:1.65;">View this booking anytime in your Awarix family dashboard.</p>`;
  return `${intro}${buildParentPortalCtaHtml({
    inviteUrl: args.portalInviteUrl,
    inviteKind: args.portalInviteKind,
    primaryColor: args.primaryColor,
  })}`;
}

function buildPortalInviteBlockText(args: BookingEmailArgs): string[] {
  if (!args.portalInviteUrl?.trim() || !args.portalInviteKind) return [];
  const intro =
    args.portalInviteKind === "claim"
      ? "Next step: create your free Awarix family account to view bookings, reports, and manage your child."
      : "View this booking anytime in your Awarix family dashboard.";
  return [
    intro,
    "",
    ...buildParentPortalCtaText({
      inviteUrl: args.portalInviteUrl,
      inviteKind: args.portalInviteKind,
    }),
    "",
  ];
}

export function buildBookingEmailHtml(args: BookingEmailArgs) {
  const greeting = args.parentName ? `Hi ${args.parentName},` : "Hi,";
  const paragraphs = getBody(args);

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
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${getHeading(args)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                ${paragraphs
                  .map(
                    (paragraph) =>
                      `<p style="margin:0 0 16px;color:#374151;line-height:1.65;">${paragraph.replaceAll("\n", "<br />")}</p>`,
                  )
                  .join("")}
                ${buildPortalInviteBlockHtml(args)}
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;font-weight:600;">${args.academyName}</p>
                ${buildEmailFooterHtml({ supportEmail: args.supportEmail })}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildBookingEmailText(args: BookingEmailArgs) {
  const greeting = args.parentName ? `Hi ${args.parentName},` : "Hi,";
  return [
    greeting,
    "",
    ...getBody(args),
    "",
    ...buildPortalInviteBlockText(args),
    args.academyName,
    "",
    ...buildEmailFooterText({ supportEmail: args.supportEmail }),
  ].join("\n");
}

type RecurringSubscriptionEmailArgs = {
  academyName: string;
  primaryColor: string;
  parentName: string;
  childName: string;
  seriesTitle: string;
  monthlyPrice: string;
  startDayLabel: string;
  startTimeLabel: string;
  location?: string | null;
  supportEmail?: string | null;
  portalInviteUrl?: string | null;
  portalInviteKind?: "claim" | "sign_in" | null;
};

function getRecurringBody(args: RecurringSubscriptionEmailArgs) {
  const locationLine = args.location?.trim() ? `\nLocation: ${args.location}` : "";
  return [
    `Your child now has a regular weekly place for ${args.seriesTitle}.`,
    `Regular monthly payment: ${args.monthlyPrice}`,
    `Training schedule: ${args.startDayLabel} at ${args.startTimeLabel}${locationLine}`,
  ];
}

export function buildRecurringSubscriptionEmailHtml(
  args: RecurringSubscriptionEmailArgs,
) {
  const greeting = args.parentName ? `Hi ${args.parentName},` : "Hi,";
  const paragraphs = getRecurringBody(args);

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
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">Weekly training package confirmed</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                ${paragraphs
                  .map(
                    (paragraph) =>
                      `<p style="margin:0 0 16px;color:#374151;line-height:1.65;">${paragraph.replaceAll("\n", "<br />")}</p>`,
                  )
                  .join("")}
                ${
                  args.portalInviteUrl && args.portalInviteKind
                    ? `${
                        args.portalInviteKind === "claim"
                          ? `<p style="margin:0 0 8px;color:#374151;line-height:1.65;">Next step: create your free Awarix family account to view bookings and manage payments.</p>`
                          : `<p style="margin:0 0 8px;color:#374151;line-height:1.65;">Manage this package anytime in your family dashboard.</p>`
                      }${buildParentPortalCtaHtml({
                        inviteUrl: args.portalInviteUrl,
                        inviteKind: args.portalInviteKind,
                        primaryColor: args.primaryColor,
                      })}`
                    : ""
                }
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;font-weight:600;">${args.academyName}</p>
                ${buildEmailFooterHtml({ supportEmail: args.supportEmail })}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildRecurringSubscriptionEmailText(
  args: RecurringSubscriptionEmailArgs,
) {
  const greeting = args.parentName ? `Hi ${args.parentName},` : "Hi,";
  const inviteLines =
    args.portalInviteUrl && args.portalInviteKind
      ? [
          args.portalInviteKind === "claim"
            ? "Next step: create your free Awarix family account to view bookings and manage payments."
            : "Manage this package anytime in your family dashboard.",
          "",
          ...buildParentPortalCtaText({
            inviteUrl: args.portalInviteUrl,
            inviteKind: args.portalInviteKind,
          }),
          "",
        ]
      : [];
  return [
    greeting,
    "",
    ...getRecurringBody(args),
    "",
    ...inviteLines,
    args.academyName,
    "",
    ...buildEmailFooterText({ supportEmail: args.supportEmail }),
  ].join("\n");
}

type FailedPaymentEmailArgs = {
  academyName: string;
  primaryColor: string;
  parentName: string;
  childName: string;
  supportEmail?: string | null;
  stripePaymentUrl?: string | null;
};

function buildFailedPaymentActionBlock(args: FailedPaymentEmailArgs) {
  const paymentUrl = args.stripePaymentUrl?.trim();
  if (!paymentUrl) {
    return `<p style="margin:0 0 16px;color:#374151;line-height:1.65;">Please contact your coach to update your payment details.</p>`;
  }

  return `<p style="margin:0 0 12px;"><a href="${paymentUrl}" style="display:inline-block;padding:12px 20px;background:${args.primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Update payment details</a></p>
<p style="margin:0 0 16px;font-size:12px;color:#6b7280;">Secure online payments provided by Stripe.</p>`;
}

function getFailedPaymentTextBody(args: FailedPaymentEmailArgs): string[] {
  const paymentUrl = args.stripePaymentUrl?.trim();
  const lines = [
    "We weren't able to process the latest payment for your child's training.",
    "",
    "Please use the secure link below to update your payment details.",
  ];

  if (paymentUrl) {
    lines.push("", `Update payment details: ${paymentUrl}`, "", "Secure online payments provided by Stripe.");
  } else {
    lines.push("", "Please contact your coach to update your payment details.");
  }

  lines.push(
    "",
    "Once payment has been completed, regular training will continue as normal.",
  );

  return lines;
}

export function buildFailedPaymentEmailHtml(args: FailedPaymentEmailArgs) {
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
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">Action needed for your child's training</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">We weren't able to process the latest payment for your child's training.</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">Please use the secure link below to update your payment details.</p>
                ${buildFailedPaymentActionBlock(args)}
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">Once payment has been completed, regular training will continue as normal.</p>
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;font-weight:600;">${args.academyName}</p>
                ${buildEmailFooterHtml({ supportEmail: args.supportEmail })}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildFailedPaymentEmailText(args: FailedPaymentEmailArgs) {
  const greeting = args.parentName ? `Hi ${args.parentName},` : "Hi,";
  return [
    greeting,
    "",
    ...getFailedPaymentTextBody(args),
    "",
    args.academyName,
    "",
    ...buildEmailFooterText({ supportEmail: args.supportEmail }),
  ].join("\n");
}
