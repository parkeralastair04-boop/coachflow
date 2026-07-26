/**
 * Awarix brand identity — single source for product naming and mission copy.
 */

export const BRAND = {
  name: "Awarix",
  nameLower: "awarix",
  legalName: "Awarix",
  tagline: "Football intelligence for coaches who develop players.",
  mission:
    "Awarix is a premium football intelligence platform helping coaches develop players through AI, insights and smarter coaching.",
  shortDescription:
    "Develop players with AI-powered insights, smarter coaching, and academy ops built for the pitch.",
  siteHost: "awarix.co.uk",
  siteUrl: "https://awarix.co.uk",
  supportEmail: "support@awarix.co.uk",
  featuresUrl: "https://awarix.co.uk/#features",
  appId: "com.awarix.app",
  /** Wordmark split for accent styling */
  wordmark: { lead: "Awar", accent: "ix" },
} as const;

export type Brand = typeof BRAND;
