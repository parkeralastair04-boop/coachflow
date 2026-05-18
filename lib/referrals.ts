export function getReferralCode(userId: string): string {
  return `CF-${userId.replaceAll("-", "").toUpperCase()}`;
}

export function getReferralUrl(code: string): string {
  return `https://coachflow.website/signup?ref=${encodeURIComponent(code)}`;
}

export function isReferralCode(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}
