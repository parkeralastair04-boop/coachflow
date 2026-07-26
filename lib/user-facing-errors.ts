export const DEFAULT_ERROR = "Something went wrong. Please try again.";
const SIGN_UP_ERROR = DEFAULT_ERROR;

export const SETUP_UNAVAILABLE_TITLE = "We couldn't load this section right now.";
export const SETUP_UNAVAILABLE_DESCRIPTION =
  "This area may still be finishing setup or temporarily unavailable.";

export const SUPPORT_UNAVAILABLE_MESSAGE = "Support is temporarily unavailable.";
export const SUPPORT_UNAVAILABLE_DETAIL =
  "Please try again later or contact support directly.";

export const BOOKING_FAILURE_MESSAGE =
  "We couldn't complete your booking right now. Please try again in a moment. Contact your coach if the problem continues.";

export const DASHBOARD_SAVE_ERROR =
  "We couldn't save your changes right now. Please try again. Contact support if the problem continues.";

export const FORGOT_PASSWORD_SUCCESS =
  "Check your email for password reset instructions.";

export const RESET_LINK_EXPIRED = "This reset link has expired.";

export const RESET_PASSWORD_SUCCESS = "Password updated — you are back in.";

export const RESET_PASSWORD_REDIRECT = "Redirecting to sign in…";

export type UserFacingErrorContext =
  | "sign-in"
  | "sign-up"
  | "password-reset"
  | "general";

function extractMessage(error: unknown): string | null {
  if (typeof error === "string") return error.trim() || null;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message.trim() || null;
  }
  return null;
}

function logSanitizedError(message: string, logLabel?: string) {
  if (typeof console === "undefined") return;
  if (logLabel) {
    console.error(`[${logLabel}]`, message);
    return;
  }
  console.error(message);
}

function isTechnicalMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /supabase|postgres|pgrst|postgresql|relation .* does not exist|could not find the table|migration|schema|jwt|rpc|sql state|unexpected token|network error|fetch failed|provider|exception|stack trace|undefined|postgrest|database|internal server|status code|http \d{3}|unauthorized|forbidden|bad gateway|service unavailable|gateway timeout|timeout exceeded|econnrefused|enotfound|failed to fetch|typeerror|syntaxerror|referenceerror/i.test(
      lower,
    ) ||
    /^(error|failed):/i.test(message) ||
    /\b(401|403|404|409|422|429|500|502|503|504)\b/.test(message) ||
    /\bat\s+\w+\.\w+\(/.test(message)
  );
}

function isNetworkFailureMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /network error|fetch failed|failed to fetch|network request failed|load failed|econnrefused|enotfound|offline|connection/i.test(
      lower,
    ) || lower === "networkerror when attempting to fetch resource."
  );
}

function mapAuthMessage(message: string, context: UserFacingErrorContext): string {
  const lower = message.toLowerCase();

  if (/invalid login credentials|invalid email or password/i.test(lower)) {
    return "Incorrect email or password.";
  }
  if (/email not confirmed/i.test(lower)) {
    return "Please verify your email before signing in. You can resend the confirmation from the signup page.";
  }
  if (/otp_expired|link.*(expired|invalid)|token.*(expired|invalid)/i.test(lower)) {
    return "This verification link has expired. Request a new one from the signup page, then try again.";
  }
  if (/user already registered|already been registered|already exists/i.test(lower)) {
    return "An account already exists with this email.";
  }
  if (/password should be at least|weak password|password must be at least/i.test(lower)) {
    return "Password must be at least 8 characters.";
  }
  if (
    /link expired|otp expired|token expired|expired token|invalid refresh token|session expired|email link is invalid|one-time token/i.test(
      lower,
    )
  ) {
    return "This link has expired. Please request a new one.";
  }
  if (/rate limit|too many requests|too many attempts/i.test(lower)) {
    return "Please wait a moment and try again.";
  }
  if (/invalid email/i.test(lower)) {
    return "Please enter a valid email address.";
  }
  if (/passwords do not match|passwords don't match/i.test(lower)) {
    return "Passwords don't match.";
  }

  if (context === "sign-in") return DEFAULT_ERROR;
  if (context === "sign-up") return SIGN_UP_ERROR;
  if (context === "password-reset") return DEFAULT_ERROR;
  return DEFAULT_ERROR;
}

export function sanitizeUserFacingError(
  error: unknown,
  options?: {
    fallback?: string;
    context?: UserFacingErrorContext;
    logLabel?: string;
  },
): string {
  const fallback = options?.fallback ?? DEFAULT_ERROR;
  const message = extractMessage(error);

  if (!message) return fallback;

  if (isNetworkFailureMessage(message)) {
    logSanitizedError(message, options?.logLabel);
    return "We couldn't connect right now. Please try again.";
  }

  if (isTechnicalMessage(message)) {
    logSanitizedError(message, options?.logLabel);
    return fallback;
  }

  if (
    options?.context === "sign-in" ||
    options?.context === "sign-up" ||
    options?.context === "password-reset"
  ) {
    const mapped = mapAuthMessage(message, options.context);
    if (mapped !== DEFAULT_ERROR || !options?.logLabel) {
      return mapped;
    }
    logSanitizedError(message, options?.logLabel);
    return mapped;
  }

  return message;
}

export function sanitizeBookingPortalError(
  error: unknown,
  options?: { logLabel?: string },
): string {
  const message = extractMessage(error);
  if (message) {
    logSanitizedError(message, options?.logLabel ?? "booking-portal");
  }
  return BOOKING_FAILURE_MESSAGE;
}

export function sanitizeDashboardSaveError(
  error: unknown,
  options?: { logLabel?: string },
): string {
  const message = extractMessage(error);
  if (message) {
    logSanitizedError(message, options?.logLabel ?? "dashboard");
  }
  return DASHBOARD_SAVE_ERROR;
}

export function getSetupUnavailableMessage(): { title: string; description: string } {
  return {
    title: SETUP_UNAVAILABLE_TITLE,
    description: SETUP_UNAVAILABLE_DESCRIPTION,
  };
}
