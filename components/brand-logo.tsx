import Image from "next/image";
import { BrandMark } from "@/components/brand-mark";
import {
  BRAND_LOGO_SIZES,
  BRAND_LOGO_SRC,
  type BrandLogoSize,
} from "@/lib/brand";
import { BRAND } from "@/lib/brand-identity";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: BrandLogoSize;
  priority?: boolean;
  src?: string;
  alt?: string;
};

/**
 * Theme-aware Awarix mark.
 * Default: SVG wordmark (navy on light, white on dark).
 * Custom `src` (academy logos): single image with a soft outline so it stays
 * visible on light backgrounds.
 */
export function BrandLogo({
  className,
  size,
  priority,
  src,
  alt = BRAND.name,
}: BrandLogoProps) {
  const logoSize = size ? BRAND_LOGO_SIZES[size] : undefined;

  if (!src || src === BRAND_LOGO_SRC) {
    return (
      <span
        className={cn(
          "inline-flex items-center leading-none",
          logoSize?.wrapper,
          className,
        )}
      >
        <BrandMark
          className={cn(
            "text-navy drop-shadow-[0_0_0.5px_rgba(15,23,42,0.35)] dark:text-white dark:drop-shadow-none",
            logoSize?.icon,
          )}
        />
        <span
          className={cn(
            "font-semibold tracking-tight whitespace-nowrap",
            logoSize?.text,
          )}
        >
          <span className="text-navy dark:text-white">{BRAND.wordmark.lead}</span>
          <span className="text-accent">{BRAND.wordmark.accent}</span>
        </span>
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={512}
      height={342}
      priority={priority}
      unoptimized={src.startsWith("http")}
      className={cn(
        "w-auto max-w-full shrink-0 object-contain",
        "drop-shadow-[0_0_1px_rgba(15,23,42,0.55)] dark:drop-shadow-none",
        logoSize?.image,
        className,
      )}
    />
  );
}
