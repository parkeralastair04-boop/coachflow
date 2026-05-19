import Image from "next/image";
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
  return (
    <Image
      src={src}
      alt={alt}
      width={512}
      height={342}
      priority={priority}
      unoptimized={src.startsWith("http")}
      className={cn(
        "w-auto shrink-0 object-contain",
        size ? BRAND_LOGO_SIZES[size] : undefined,
        className,
      )}
    />
  );
}
