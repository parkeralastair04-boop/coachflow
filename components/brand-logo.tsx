import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority }: BrandLogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="CoachFlow"
      width={180}
      height={120}
      priority={priority}
      className={cn("w-auto object-contain", className)}
    />
  );
}
