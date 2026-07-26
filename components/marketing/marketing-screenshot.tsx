import Image from "next/image";
import { cn } from "@/lib/utils";

type MarketingScreenshotProps = {
  src: string;
  alt: string;
  /** Shown in a subtle caption under the frame */
  captureRoute?: string;
  priority?: boolean;
  className?: string;
};

/**
 * Product screenshot in a minimal browser frame.
 * Images are captured from real Awarix demo routes — not illustrated mockups.
 */
export function MarketingScreenshot({
  src,
  alt,
  captureRoute,
  priority = false,
  className,
}: MarketingScreenshotProps) {
  return (
    <figure className={cn("group", className)}>
      <div
        className={cn(
          "overflow-hidden rounded-xl sm:rounded-2xl",
          "border border-black/[0.08] bg-[#0a0f18] shadow-[0_32px_80px_-24px_rgba(0,0,0,0.55)]",
          "ring-1 ring-white/[0.06]",
          "dark:border-white/[0.1]",
        )}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.08] bg-[#0f172a] px-3 py-2 sm:px-4">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2 rounded-full bg-red-400/70 sm:size-2.5" />
            <span className="size-2 rounded-full bg-amber-400/70 sm:size-2.5" />
            <span className="size-2 rounded-full bg-emerald-400/70 sm:size-2.5" />
          </div>
          <p className="text-muted mx-auto hidden truncate text-center text-[10px] sm:block sm:max-w-[14rem] sm:text-[11px]">
            awarix.app{captureRoute ?? ""}
          </p>
        </div>
        <div className="relative aspect-[16/10] w-full bg-[#0f172a]">
          <Image
            src={src}
            alt={alt}
            fill
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 640px"
            className="object-cover object-top"
          />
        </div>
      </div>
      {captureRoute ? (
        <figcaption className="text-muted mt-2 text-center text-[11px]">
          Screenshot from live demo · {captureRoute}
        </figcaption>
      ) : null}
    </figure>
  );
}
