import Link from "next/link";

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
          <p className="font-semibold tracking-tight">CoachFlow</p>
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
