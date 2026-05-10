import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CoachFlow — The operating system for football coaching businesses",
    template: "%s · CoachFlow",
  },
  description:
    "Bookings, parent CRM, attendance, payments, and AI progress reports — built for modern football academies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
