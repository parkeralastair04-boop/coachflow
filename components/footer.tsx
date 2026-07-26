import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const footerLinks = [
  { label: "Product", href: "/#product" },
  { label: "Coaches", href: "/#testimonials" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "Demo", href: "/demo" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Sign in", href: "/login" },
];

export function Footer() {
  return (
    <footer className="relative border-t border-emerald-500/10">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/25 to-transparent" aria-hidden />
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <Link href="/" className="inline-flex leading-none" aria-label="Awarix home">
            <BrandLogo size="footer" />
          </Link>
          <p className="text-muted mt-1 max-w-sm text-sm">
            Football intelligence for coaches who develop players.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted" aria-label="Footer navigation">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <Link className="hover:text-foreground transition-colors" href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm lg:text-right">
          © {new Date().getFullYear()} Awarix. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
