import { NextResponse } from "next/server";
import {
  buildAcademyEnquiryNotificationHtml,
  buildAcademyEnquiryNotificationText,
} from "@/lib/academy-enquiry-email";
import { apiError, safeApiError, validationError } from "@/lib/api-response";
import { logAbuseEvent } from "@/lib/abuse-log";
import {
  enforceBotProtection,
  isDuplicatePublicContact,
  looksLikeSpamContact,
} from "@/lib/bot-protection";
import { HONEYPOT_FIELD_NAME } from "@/lib/bot-protection-shared";
import { resolvePublicPortal } from "@/lib/public-booking";
import { enforceRateLimit, getRequestIp, hashIp, RATE_LIMITS } from "@/lib/rate-limit";
import { getResendServerClient, resendFromEmail } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/supabase-errors";
import { isValidEmail } from "@/lib/validation/email";
import { normalisePhone } from "@/lib/validation/phone";
import { clampString, optionalClampString, ValidationError } from "@/lib/validation/common";
import { rejectDemoMutation } from "@/lib/demo/http-guard";

type ContactBody = {
  academySlug?: string;
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  turnstileToken?: string;
  [key: string]: unknown;
};

export async function POST(request: Request) {
  const route = "/api/academy/contact";
  try {
    const limited = await enforceRateLimit({
      request,
      config: RATE_LIMITS.publicContact,
      route,
    });
    if (limited) return limited;

    const body = (await request.json()) as ContactBody;

    const bot = await enforceBotProtection({
      request,
      route,
      input: {
        honeypot:
          typeof body[HONEYPOT_FIELD_NAME] === "string"
            ? body[HONEYPOT_FIELD_NAME]
            : typeof body.company_website === "string"
              ? body.company_website
              : "",
        turnstileToken: body.turnstileToken,
      },
    });
    if (!bot.ok) {
      // Honeypot: fake success so bots do not retry with variants.
      if (bot.code === "honeypot") {
        return NextResponse.json({ ok: true });
      }
      return apiError(400, bot.message, "bot_blocked");
    }

    let academySlug: string;
    let name: string;
    let email: string;
    let subject: string;
    let message: string;
    let phone: string | null;
    try {
      academySlug = clampString(body.academySlug, { max: 120, field: "Academy" });
      name = clampString(body.name, { max: 120, field: "Name" });
      email = clampString(body.email, { max: 254, field: "Email" });
      subject = clampString(body.subject, { max: 200, field: "Subject" });
      message = clampString(body.message, { max: 5000, min: 8, field: "Message" });
      phone = optionalClampString(body.phone, { max: 40, field: "Phone" });
    } catch (error) {
      if (error instanceof ValidationError) {
        return validationError(error.message, request, route);
      }
      throw error;
    }

    if (!isValidEmail(email)) {
      return validationError("Please enter a valid email address.", request, route);
    }

    const demoContact = rejectDemoMutation(request, "send a contact email", {
      academySlug,
    });
    if (demoContact) {
      return NextResponse.json({
        ok: true,
        demo: true,
        message: "Demo enquiry received. No email was sent.",
      });
    }

    phone = phone ? normalisePhone(phone) : null;

    if (looksLikeSpamContact({ name, subject, message })) {
      logAbuseEvent({
        event: "bot_blocked",
        route,
        ipHash: hashIp(getRequestIp(request)),
        detail: "spam_heuristic",
      });
      return NextResponse.json({ ok: true });
    }

    if (isDuplicatePublicContact({ academySlug, email, message })) {
      logAbuseEvent({
        event: "duplicate_request",
        route,
        ipHash: hashIp(getRequestIp(request)),
        detail: "duplicate_contact",
      });
      return NextResponse.json({ ok: true });
    }

    const portal = await resolvePublicPortal({ kind: "academy", slug: academySlug });
    if (!portal?.academy_id) {
      return apiError(404, "Academy not found.", "not_found");
    }

    const admin = createAdminClient();
    const { error: insertError } = await admin.from("academy_enquiries").insert({
      academy_id: portal.academy_id,
      name,
      email,
      phone,
      subject,
      message,
    });

    if (insertError) {
      if (isMissingTableError(insertError)) {
        return apiError(
          503,
          "Contact form is not available yet. Please try again later.",
          "unavailable",
        );
      }
      throw insertError;
    }

    const supportEmail = portal.support_email?.trim() || null;
    if (supportEmail && isValidEmail(supportEmail)) {
      try {
        const branding = {
          academyName: portal.display_name,
          primaryColor: portal.primary_color,
          supportEmail,
        };
        const emailInput = {
          branding,
          name,
          email,
          phone,
          subject,
          message,
          academySlug,
        };
        const resend = getResendServerClient();
        await resend.emails.send({
          from: resendFromEmail,
          to: supportEmail,
          replyTo: email,
          subject: `Enquiry: ${subject}`,
          html: buildAcademyEnquiryNotificationHtml(emailInput),
          text: buildAcademyEnquiryNotificationText(emailInput),
        });
      } catch (emailError) {
        console.error("[academy-contact] notification email failed", emailError);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return safeApiError({
      request,
      route,
      error,
      clientMessage: "Unable to send enquiry.",
    });
  }
}
