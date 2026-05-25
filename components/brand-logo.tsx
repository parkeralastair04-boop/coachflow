import Image from "next/image";
import { BrandMark } from "@/components/brand-mark";
import {
  BRAND_LOGO_SIZES,
  BRAND_LOGO_SRC,
  type BrandLogoSize,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: BrandLogoSize;
  priority?: boolean;
  src?: string;
  alt?: string;
};

export function BrandLogo({
  className,
  size,
  priority,
  src = BRAND_LOGO_SRC,
  alt = "CoachFlow",
}: BrandLogoProps) {
  const logoSize = size ? BRAND_LOGO_SIZES[size] : undefined;

  if (src === BRAND_LOGO_SRC) {
    return (
      <span
        className={cn(
          "inline-flex items-center leading-none",
          logoSize?.wrapper,
          className,
        )}
      >
        <BrandMark className={cn("text-navy dark:text-white", logoSize?.icon)} />
        <span className={cn("font-semibold tracking-tight whitespace-nowrap", logoSize?.text)}>
          <span className="text-navy dark:text-white">Coach</span>
          <span className="text-accent">Flow</span>
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
        logoSize?.image,
        className,
      )}
    />
  );
}
