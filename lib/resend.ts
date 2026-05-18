import { Resend } from "resend";

let resendClient: Resend | null = null;

export function getResendServerClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export const resendFromEmail =
  process.env.RESEND_FROM_EMAIL ?? "CoachFlow <onboarding@resend.dev>";
