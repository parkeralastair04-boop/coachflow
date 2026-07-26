"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type AcademyWebsiteNavLinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  activeClassName?: string;
  exact?: boolean;
  onNavigate?: () => void;
};

function isActivePath(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AcademyWebsiteNavLink({
  href,
  children,
  className,
  activeClassName,
  exact = false,
  onNavigate,
}: AcademyWebsiteNavLinkProps) {
  const pathname = usePathname() ?? "";
  const active = isActivePath(pathname, href, exact);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(className, active && activeClassName)}
    >
      {children}
    </Link>
  );
}
