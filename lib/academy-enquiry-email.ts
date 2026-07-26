import { absoluteSitePath } from "@/lib/site-url";

type EnquiryEmailBranding = {
  academyName: string;
  primaryColor?: string;
  supportEmail?: string | null;
};

export type AcademyEnquiryEmailInput = {
  branding: EnquiryEmailBranding;
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  academySlug: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildFooterHtml(supportEmail?: string | null): string {
  const privacyUrl = absoluteSitePath("/privacy");
  const termsUrl = absoluteSitePath("/terms");
  const email = supportEmail?.trim();
  const emailLine = email
    ? `<p style="margin:0 0 8px;"><a href="mailto:${escapeHtml(email)}" style="color:#374151;text-decoration:underline;">${escapeHtml(email)}</a></p>`
    : "";

  return `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.65;">
    <p style="margin:0 0 8px;">New enquiry from your academy website</p>
    ${emailLine}
    <p style="margin:0 0 8px;"><a href="${privacyUrl}" style="color:#374151;text-decoration:underline;">Privacy Policy</a> · <a href="${termsUrl}" style="color:#374151;text-decoration:underline;">Terms of Service</a></p>
    <p style="margin:0;font-size:11px;color:#9ca3af;">Powered by Awarix</p>
  </div>`;
}

export function buildAcademyEnquiryNotificationHtml(input: AcademyEnquiryEmailInput): string {
  const accent = input.branding.primaryColor?.trim() || "#10B981";
  const dashboardUrl = absoluteSitePath("/dashboard/enquiries");
  const phoneLine = input.phone
    ? `<p style="margin:0 0 8px;"><strong>Phone:</strong> ${escapeHtml(input.phone)}</p>`
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
                <div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(input.branding.academyName)}</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">New website enquiry</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;color:#374151;line-height:1.65;">
                <p style="margin:0 0 16px;">Someone sent a message from your academy contact form.</p>
                <p style="margin:0 0 8px;"><strong>Name:</strong> ${escapeHtml(input.name)}</p>
                <p style="margin:0 0 8px;"><strong>Email:</strong> <a href="mailto:${escapeHtml(input.email)}" style="color:#0f172a;">${escapeHtml(input.email)}</a></p>
                ${phoneLine}
                <p style="margin:0 0 8px;"><strong>Subject:</strong> ${escapeHtml(input.subject)}</p>
                <p style="margin:16px 0 8px;"><strong>Message</strong></p>
                <p style="margin:0 0 16px;white-space:pre-wrap;">${escapeHtml(input.message).replaceAll("\n", "<br />")}</p>
                <p style="margin:0 0 16px;"><a href="${dashboardUrl}" style="display:inline-block;background:${escapeHtml(accent)};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">View enquiries</a></p>
                ${buildFooterHtml(input.branding.supportEmail)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildAcademyEnquiryNotificationText(input: AcademyEnquiryEmailInput): string {
  const lines = [
    `New website enquiry for ${input.branding.academyName}`,
    "",
    `Name: ${input.name}`,
    `Email: ${input.email}`,
  ];
  if (input.phone) lines.push(`Phone: ${input.phone}`);
  lines.push(`Subject: ${input.subject}`, "", "Message:", input.message, "", absoluteSitePath("/dashboard/enquiries"));
  return lines.join("\n");
}
