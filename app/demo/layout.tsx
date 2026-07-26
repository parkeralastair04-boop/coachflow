import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoModeBanner } from "@/components/demo-mode-banner";

export const metadata: Metadata = {
  title: "Awarix demo",
  description:
    "Explore Riverside United Academy — a guided Awarix product demo with sample data. No emails or payments.",
  robots: { index: false, follow: false },
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full">
      <DemoModeBanner />
      {children}
    </div>
  );
}
