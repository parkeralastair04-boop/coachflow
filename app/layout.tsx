import type { Metadata, Viewport } from "next";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { ThemeColorMeta } from "@/components/theme-color-meta";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "CoachFlow",
  title: {
    default: "CoachFlow — The operating system for football coaching businesses",
    template: "%s · CoachFlow",
  },
  description:
    "The AI-powered operating system for football coaches.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "CoachFlow",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/app-icon/32", type: "image/png", sizes: "32x32" },
      { url: "/app-icon/192", type: "image/png", sizes: "192x192" },
      { url: "/app-icon/512", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/app-icon/32", type: "image/png", sizes: "32x32" }],
    apple: [{ url: "/app-icon/180", type: "image/png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#10B981",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <ThemeProvider>
          <ThemeColorMeta />
          {children}
          <PwaInstallBanner />
        </ThemeProvider>
      </body>
    </html>
  );
}
