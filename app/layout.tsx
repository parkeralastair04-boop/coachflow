import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaInstallBanner } from "@/components/pwa-install-banner";
import { ThemeColorMeta } from "@/components/theme-color-meta";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { BRAND } from "@/lib/brand-identity";
import { getMetadataBase } from "@/lib/site-url";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteTitle = `${BRAND.name} — Football intelligence for coaches`;
const siteDescription = BRAND.shortDescription;

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  applicationName: BRAND.name,
  title: {
    default: siteTitle,
    template: `%s · ${BRAND.name}`,
  },
  description: siteDescription,
  keywords: [
    "football coaching software",
    "academy management",
    "player development",
    "AI coaching insights",
    "youth football",
    "Awarix",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
    siteName: BRAND.name,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: BRAND.name,
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
    <html
      lang="en"
      className={`h-full antialiased ${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full font-sans">
        <ThemeProvider>
          <ToastProvider>
            <ThemeColorMeta />
            {children}
            <PwaInstallBanner />
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
