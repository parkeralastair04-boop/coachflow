import { BRAND } from "@/lib/brand-identity";

export function getReferralCode(userId: string): string {
  return `AX-${userId.replaceAll("-", "").toUpperCase()}`;
}

export function getReferralUrl(code: string): string {
  return `${BRAND.siteUrl}/signup?ref=${encodeURIComponent(code)}`;
}

export function isReferralCode(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}
