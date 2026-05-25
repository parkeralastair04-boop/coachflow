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
};

function getHeading(kind: BookingEmailKind) {
  return kind === "confirmed" ? "Booking confirmed" : "Added to the waitlist";
}

function getBody(args: BookingEmailArgs) {
  const locationLine = args.location?.trim() ? `Location: ${args.location}` : "";

  if (args.kind === "confirmed") {
    return [
      `Your booking for ${args.childName} is confirmed.`,
      `${args.sessionLabel}\n${args.sessionDate}${locationLine ? `\n${locationLine}` : ""}`,
      `Payment has been received and your space is now secured with ${args.academyName}.`,
    ];
  }

  return [
    `${args.childName} has been added to the waitlist for ${args.sessionLabel}.`,
    `${args.sessionDate}${locationLine ? `\n${locationLine}` : ""}`,
    `${args.academyName} will contact you if a space becomes available.`,
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
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;">${getHeading(args.kind)}</h1>
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

export function buildBookingEmailText(args: BookingEmailArgs) {
  const greeting = args.parentName ? `Hi ${args.parentName},` : "Hi,";
  return [greeting, "", ...getBody(args), "", args.academyName].join("\n");
}
