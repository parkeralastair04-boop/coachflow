/** Primary brand mark served from `/public/logo.png`. */
export const BRAND_LOGO_SRC = "/logo.png";

/** Tailwind classes for consistent default wordmark sizing and fallback image heights. */
export const BRAND_LOGO_SIZES = {
  navbarMobile: {
    wrapper: "gap-2",
    icon: "size-11",
    text: "text-[1.65rem]",
    image: "h-16",
  },
  navbar: {
    wrapper: "gap-2.5",
    icon: "size-[3.6rem]",
    text: "text-[2.5rem]",
    image: "h-[5.25rem]",
  },
  navbarResponsive: {
    wrapper: "gap-2 sm:gap-2.5",
    icon: "size-11 sm:size-[3.6rem]",
    text: "text-[1.7rem] sm:text-[2.5rem]",
    image: "h-16 sm:h-[5.25rem]",
  },
  sidebar: {
    wrapper: "gap-2.5",
    icon: "size-[3.15rem]",
    text: "text-[2.05rem]",
    image: "h-[4.5rem]",
  },
  auth: {
    wrapper: "gap-3",
    icon: "size-[4rem]",
    text: "text-[2.8rem]",
    image: "h-[6.25rem]",
  },
  footer: {
    wrapper: "gap-2.5",
    icon: "size-[3.1rem]",
    text: "text-[2.15rem]",
    image: "h-[4.75rem]",
  },
  pwaBanner: {
    wrapper: "gap-2",
    icon: "size-10",
    text: "text-[1.5rem]",
    image: "h-14",
  },
} as const;

export type BrandLogoSize = keyof typeof BRAND_LOGO_SIZES;
