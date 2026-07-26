import Link from "next/link";
import { getAcademyWebsitePaths } from "@/lib/academy-website";
import type { PublicAcademy } from "@/lib/academy-website-types";

type AcademyWebsiteFooterProps = {
  academy: PublicAcademy;
  academySlug: string;
};

export function AcademyWebsiteFooter({ academy, academySlug }: AcademyWebsiteFooterProps) {
  const paths = getAcademyWebsitePaths(academySlug);
  const supportEmail = academy.supportEmail?.trim() || null;

  return (
    <footer
      className="mt-auto border-t border-[color-mix(in_srgb,var(--academy-secondary)_16%,transparent)]"
      role="contentinfo"
    >
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8">
        <div>
          <p className="text-base font-semibold tracking-tight">{academy.name}</p>
          {supportEmail ? (
            <p className="text-muted mt-2 text-sm">
              <a
                href={`mailto:${supportEmail}`}
                className="hover:text-foreground focus-visible:ring-accent/40 rounded-sm underline-offset-4 hover:underline outline-none focus-visible:ring-2"
              >
                {supportEmail}
              </a>
            </p>
          ) : (
            <p className="text-muted mt-2 text-sm">Contact your academy coach for support.</p>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:justify-end" aria-label="Legal">
            <li>
              <Link
                href={paths.contact}
                className="text-muted hover:text-foreground focus-visible:ring-accent/40 inline-flex min-h-11 items-center underline-offset-4 hover:underline outline-none focus-visible:ring-2"
              >
                Contact
              </Link>
            </li>
            <li>
              <Link
                href={paths.privacy}
                className="text-muted hover:text-foreground focus-visible:ring-accent/40 inline-flex min-h-11 items-center underline-offset-4 hover:underline outline-none focus-visible:ring-2"
              >
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link
                href={paths.terms}
                className="text-muted hover:text-foreground focus-visible:ring-accent/40 inline-flex min-h-11 items-center underline-offset-4 hover:underline outline-none focus-visible:ring-2"
              >
                Terms of Service
              </Link>
            </li>
          </ul>
          <p className="text-muted text-xs sm:text-right">
            Powered by{" "}
            <Link
              href="/"
              className="focus-visible:ring-accent/40 rounded-sm underline-offset-2 hover:underline outline-none focus-visible:ring-2"
            >
              Awarix
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
