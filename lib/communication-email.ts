import { absoluteSitePath } from "@/lib/site-url";

type CoachEmailBranding = {
  academyName: string;
  primaryColor?: string;
  supportEmail?: string | null;
};

function buildEmailFooterHtml(args: { supportEmail?: string | null }): string {
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

function buildEmailFooterText(args: { supportEmail?: string | null }): string {
  const privacyUrl = absoluteSitePath("/privacy");
  const termsUrl = absoluteSitePath("/terms");
  const lines = ["Questions? Contact your coach"];
  const supportEmail = args.supportEmail?.trim();
  if (supportEmail) lines.push(supportEmail);
  lines.push("", "Privacy Policy", privacyUrl, "Terms of Service", termsUrl, "", "Powered by Awarix");
  return lines.join("\n");
}

export function buildCoachCommunicationEmailHtml(args: {
  branding: CoachEmailBranding;
  subject: string;
  body: string;
}): string {
  const greetingHandled = args.body.trim().toLowerCase().startsWith("hi ");
  const paragraphs = args.body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f7f9;font-family:Inter,Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #e5e7eb;">
            <tr>
              <td style="padding:28px 32px;background:#0f172a;color:#ffffff;">
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${args.branding.primaryColor ?? "#10B981"};">${args.branding.academyName}</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${args.subject}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#374151;line-height:1.65;">
                ${paragraphs
                  .map(
                    (paragraph) =>
                      `<p style="margin:0 0 16px;">${paragraph.replaceAll("\n", "<br />")}</p>`,
                  )
                  .join("")}
                ${greetingHandled ? "" : ""}
                ${buildEmailFooterHtml({ supportEmail: args.branding.supportEmail })}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildCoachCommunicationEmailText(args: {
  branding: CoachEmailBranding;
  subject: string;
  body: string;
}): string {
  return `${args.subject}\n\n${args.body.trim()}\n\n${buildEmailFooterText({ supportEmail: args.branding.supportEmail })}`;
}
