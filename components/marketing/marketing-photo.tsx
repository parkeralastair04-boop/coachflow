import Image from "next/image";
import { cn } from "@/lib/utils";

type MarketingPhotoProps = {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
};

/** Football coaching photography — premium crop, subtle grade. */
export function MarketingPhoto({
  src,
  alt,
  priority = false,
  className,
}: MarketingPhotoProps) {
  return (
    <div
      className={cn(
        "relative aspect-[4/5] overflow-hidden rounded-xl sm:aspect-[3/4] sm:rounded-2xl",
        "shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 768px) 100vw, 420px"
        className="object-cover object-center"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-30"
        style={{
          background:
            "linear-gradient(135deg, rgba(5,150,105,0.35) 0%, transparent 55%)",
        }}
        aria-hidden
      />
    </div>
  );
}
