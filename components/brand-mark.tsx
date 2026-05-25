import { BRAND_EMERALD, BRAND_NAVY } from "@/lib/theme";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      <path
        d="M32 6C23.6 11 17.6 12 12.5 12V33.2C12.5 45.1 20 53.6 32 58C44 53.6 51.5 45.1 51.5 33.2V12C46.4 12 40.4 11 32 6Z"
        stroke="currentColor"
        strokeWidth="4.75"
        strokeLinejoin="round"
      />
      <path
        d="M22 18.5H42"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.32"
      />
      <path
        d="M20 32H44"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.22"
      />
      <path
        d="M26 46.5H38"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.2"
      />
      <path
        d="M15.5 39L26.2 28.6L33.3 35.2L49.5 18.8"
        stroke={BRAND_EMERALD}
        strokeWidth="5.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M41.5 18.8H49.5V26.8"
        stroke={BRAND_EMERALD}
        strokeWidth="5.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrandAppIcon() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        borderRadius: "24%",
        background: `linear-gradient(160deg, ${BRAND_NAVY} 0%, #08111F 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "8%",
          borderRadius: "24%",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "-18%",
          background:
            "radial-gradient(circle at 22% 20%, rgba(16,185,129,0.32), transparent 42%), radial-gradient(circle at 78% 82%, rgba(59,130,246,0.22), transparent 44%)",
        }}
      />
      <svg
        viewBox="0 0 64 64"
        fill="none"
        aria-hidden="true"
        style={{
          width: "74%",
          height: "74%",
          color: "#F8FAFC",
          position: "relative",
        }}
      >
        <path
          d="M32 6C23.6 11 17.6 12 12.5 12V33.2C12.5 45.1 20 53.6 32 58C44 53.6 51.5 45.1 51.5 33.2V12C46.4 12 40.4 11 32 6Z"
          stroke="currentColor"
          strokeWidth="4.75"
          strokeLinejoin="round"
        />
        <path
          d="M22 18.5H42"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.28"
        />
        <path
          d="M20 32H44"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.2"
        />
        <path
          d="M26 46.5H38"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.18"
        />
        <path
          d="M15.5 39L26.2 28.6L33.3 35.2L49.5 18.8"
          stroke={BRAND_EMERALD}
          strokeWidth="5.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M41.5 18.8H49.5V26.8"
          stroke={BRAND_EMERALD}
          strokeWidth="5.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
