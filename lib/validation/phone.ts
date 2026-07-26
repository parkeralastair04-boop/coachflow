function stripPhoneFormatting(phone: string): string {
  return phone.replace(/[\s-]/g, "");
}

const UK_MOBILE_DOMESTIC = /^07\d{9}$/;
const UK_MOBILE_INTERNATIONAL = /^\+447\d{9}$/;

export function isValidSupportPhone(phone: string): boolean {
  const stripped = stripPhoneFormatting(phone.trim());
  if (!stripped) return false;

  return UK_MOBILE_DOMESTIC.test(stripped) || UK_MOBILE_INTERNATIONAL.test(stripped);
}

export function normaliseSupportPhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  const stripped = stripPhoneFormatting(trimmed);
  if (UK_MOBILE_DOMESTIC.test(stripped)) return stripped;
  if (UK_MOBILE_INTERNATIONAL.test(stripped)) return stripped;
  if (/^447\d{9}$/.test(stripped)) return `+${stripped}`;

  return null;
}

export function normalisePhone(phone: string | null | undefined): string | null {
  if (phone == null) return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  const hasLeadingPlus = trimmed.startsWith("+");
  const collapsed = trimmed.replace(/[\s-]+/g, " ").trim();

  if (!hasLeadingPlus) {
    return collapsed;
  }

  const digitsAndSpaces = collapsed.slice(1).replace(/\s+/g, " ");
  return `+${digitsAndSpaces}`;
}
