import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

const footerLinks = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Sign in", href: "/login" },
];

export function Footer() {
  return (
    <footer className="border-t border-black/[0.06] dark:border-white/[0.08]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <Link href="/" className="inline-flex" aria-label="CoachFlow home">
            <BrandLogo className="h-16" />
          </Link>
          <p className="text-muted mt-1 max-w-sm text-sm">
            The operating system for football coaching businesses.
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted">
          {footerLinks.map((link) => (
            <li key={link.href}>
              <Link className="hover:text-foreground transition-colors" href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-muted text-sm lg:text-right">
          © {new Date().getFullYear()} CoachFlow. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
