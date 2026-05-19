/** Primary brand mark served from `/public/logo.png`. */
export const BRAND_LOGO_SRC = "/logo.png";

/** Tailwind height classes for consistent logo sizing. */
export const BRAND_LOGO_SIZES = {
  /** Mobile marketing navbar — 56px */
  navbarMobile: "h-14",
  /** Desktop marketing navbar — 72px */
  navbar: "h-[72px]",
  /** Marketing navbar: 56px mobile, 72px from sm breakpoint */
  navbarResponsive: "h-14 sm:h-[72px]",
  /** Dashboard sidebar — 64px */
  sidebar: "h-16",
  /** Login and signup — 96px */
  auth: "h-24",
  /** Site footer — 72px */
  footer: "h-[72px]",
  /** PWA install prompt — 64px */
  pwaBanner: "h-16",
} as const;

export type BrandLogoSize = keyof typeof BRAND_LOGO_SIZES;
