"use client";

import type { AcademyBranding } from "@/lib/academy-shared";

type AcademyBrandShellProps = {
  academy: AcademyBranding | null;
  children: React.ReactNode;
};

export function AcademyBrandShell({ academy, children }: AcademyBrandShellProps) {
  const style = academy
    ? ({
        "--accent": academy.primary_color,
        "--accent-dim": `${academy.primary_color}24`,
        "--ring-glow": `${academy.primary_color}66`,
      } as React.CSSProperties)
    : undefined;

  return <div style={style}>{children}</div>;
}
