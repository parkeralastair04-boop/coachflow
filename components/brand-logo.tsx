import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
  src?: string;
  alt?: string;
};

export function BrandLogo({
  className,
  priority,
  src = "/logo.png",
  alt = "CoachFlow",
}: BrandLogoProps) {
  return (
    <Image
      src={src}
      alt={alt}
      width={180}
      height={120}
      priority={priority}
      unoptimized={src.startsWith("http")}
      className={cn("w-auto object-contain", className)}
    />
  );
}
