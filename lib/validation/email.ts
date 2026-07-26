/** Practical email check — not full RFC 5322. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed) return false;
  if (trimmed.length > 254) return false;
  return EMAIL_PATTERN.test(trimmed);
}
