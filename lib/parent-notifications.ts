import { absoluteSitePath } from "@/lib/site-url";

export type ParentNotificationKind =
  | "booking_confirmed"
  | "session_reminder"
  | "report_shared"
  | "payment_received"
  | "session_cancelled";

const SUBJECTS: Record<ParentNotificationKind, string> = {
  booking_confirmed: "Training booking confirmed",
  session_reminder: "Reminder: training session coming up",
  report_shared: "A new progress report is ready",
  payment_received: "Payment received",
  session_cancelled: "Session cancelled",
};

export function getParentNotificationSubject(kind: ParentNotificationKind): string {
  return SUBJECTS[kind];
}

type PortalCtaArgs = {
  url: string;
  label: string;
  primaryColor: string;
};

function buildPortalCtaHtml(args: PortalCtaArgs): string {
  return `<p style="margin:24px 0 8px;"><a href="${args.url}" style="display:inline-block;padding:12px 20px;background:${args.primaryColor};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">${args.label}</a></p>
<p style="margin:0 0 16px;font-size:12px;color:#6b7280;">Or open your family dashboard anytime: ${absoluteSitePath("/family")}</p>`;
}

function buildPortalCtaText(args: { url: string; label: string }): string[] {
  return [
    `${args.label}: ${args.url}`,
    "",
    `Family training hub: ${absoluteSitePath("/family")}`,
  ];
}

export function buildParentPortalCtaHtml(args: {
  inviteUrl: string;
  inviteKind: "claim" | "sign_in";
  primaryColor: string;
}): string {
  const label =
    args.inviteKind === "claim"
      ? "Create your family account"
      : "Open your family dashboard";
  return buildPortalCtaHtml({
    url: args.inviteUrl,
    label,
    primaryColor: args.primaryColor,
  });
}

export function buildParentPortalCtaText(args: {
  inviteUrl: string;
  inviteKind: "claim" | "sign_in";
}): string[] {
  const label =
    args.inviteKind === "claim"
      ? "Create your family account"
      : "Open your family dashboard";
  return buildPortalCtaText({ url: args.inviteUrl, label });
}

export function buildReportSharedEmailHtml(args: {
  academyName: string;
  primaryColor: string;
  parentName: string;
  childName: string;
  portalUrl: string;
  bodyHtml: string;
}): string {
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
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${getParentNotificationSubject("report_shared")}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  Your coach has shared a progress report for ${args.childName}.
                </p>
                ${args.bodyHtml}
                ${buildPortalCtaHtml({
                  url: args.portalUrl,
                  label: "View in family dashboard",
                  primaryColor: args.primaryColor,
                })}
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

export function buildSessionReminderEmailHtml(args: {
  academyName: string;
  primaryColor: string;
  parentName: string;
  childName: string;
  sessionLabel: string;
  sessionDate: string;
  location?: string | null;
  portalUrl: string;
}): string {
  const greeting = args.parentName ? `Hi ${args.parentName},` : "Hi,";
  const locationLine = args.location?.trim()
    ? `<p style="margin:0 0 16px;color:#374151;line-height:1.65;">Location: ${args.location}</p>`
    : "";
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
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${getParentNotificationSubject("session_reminder")}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  Reminder: ${args.childName} has training coming up.
                </p>
                <p style="margin:0 0 8px;color:#374151;line-height:1.65;font-weight:600;">${args.sessionLabel}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">${args.sessionDate}</p>
                ${locationLine}
                ${buildPortalCtaHtml({
                  url: args.portalUrl,
                  label: "View sessions",
                  primaryColor: args.primaryColor,
                })}
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

export function buildSessionCancelledEmailHtml(args: {
  academyName: string;
  primaryColor: string;
  parentName: string;
  childName: string;
  sessionLabel: string;
  sessionDate: string;
  portalUrl: string;
}): string {
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
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${getParentNotificationSubject("session_cancelled")}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#111827;line-height:1.65;">${greeting}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">
                  The following session for ${args.childName} has been cancelled.
                </p>
                <p style="margin:0 0 8px;color:#374151;line-height:1.65;font-weight:600;">${args.sessionLabel}</p>
                <p style="margin:0 0 16px;color:#374151;line-height:1.65;">${args.sessionDate}</p>
                ${buildPortalCtaHtml({
                  url: args.portalUrl,
                  label: "View family dashboard",
                  primaryColor: args.primaryColor,
                })}
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
