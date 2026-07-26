import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AcademyContactForm } from "@/components/academy-contact-form";
import { AcademyWebsiteCta } from "@/components/academy-website-cta";
import { buildAcademyWebsitePageMetadata, getAcademyWebsitePaths } from "@/lib/academy-website";
import { getPublicAcademyContext } from "@/lib/academy-website-data";

type ContactPageProps = {
  params: Promise<{ academySlug: string }>;
};

export async function generateMetadata(props: ContactPageProps): Promise<Metadata> {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  return buildAcademyWebsitePageMetadata({
    academy: context?.academy ?? null,
    academySlug,
    page: "contact",
  });
}

export default async function AcademyContactPage(props: ContactPageProps) {
  const { academySlug } = await props.params;
  const context = await getPublicAcademyContext(academySlug);
  if (!context) notFound();

  const { academy } = context;
  const paths = getAcademyWebsitePaths(academySlug);
  const supportEmail = academy.supportEmail?.trim() || null;
  const supportPhone = academy.supportPhone?.trim() || null;

  return (
    <div>
      <section
        className="relative overflow-hidden border-b border-[color-mix(in_srgb,var(--academy-secondary)_14%,transparent)]"
        aria-labelledby="contact-hero-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background: `radial-gradient(ellipse 80% 60% at 10% 0%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 20%, color-mix(in srgb, var(--academy-secondary) 12%, transparent), transparent 50%)`,
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <h1
            id="contact-hero-heading"
            className="text-3xl font-semibold tracking-tight sm:text-4xl sm:leading-tight"
          >
            Contact
          </h1>
          <p className="text-muted mt-3 max-w-2xl text-sm sm:text-base">
            Questions about {academy.name}? Send a message and we will get back to you. For sessions,
            booking online is usually the quickest option.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          <section aria-labelledby="contact-info-heading" className="space-y-6">
            <div>
              <h2 id="contact-info-heading" className="text-2xl font-semibold tracking-tight">
                Contact information
              </h2>
              <p className="text-muted mt-3 text-sm leading-relaxed sm:text-base">
                Reach the {academy.name} team using the details below, or send a general enquiry
                with the form.
              </p>
            </div>

            <dl className="space-y-4">
              <div className="rounded-2xl bg-black/[0.02] px-5 py-4 dark:bg-white/[0.03]">
                <dt className="text-muted text-xs font-medium tracking-wide uppercase">Academy</dt>
                <dd className="mt-1 text-sm font-medium">{academy.name}</dd>
              </div>
              <div className="rounded-2xl bg-black/[0.02] px-5 py-4 dark:bg-white/[0.03]">
                <dt className="text-muted text-xs font-medium tracking-wide uppercase">Email</dt>
                <dd className="mt-1 text-sm font-medium">
                  {supportEmail ? (
                    <a
                      href={`mailto:${supportEmail}`}
                      className="hover:text-accent focus:ring-accent/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus:ring-2"
                    >
                      {supportEmail}
                    </a>
                  ) : (
                    <span className="text-muted">Not published yet</span>
                  )}
                </dd>
              </div>
              {supportPhone ? (
                <div className="rounded-2xl bg-black/[0.02] px-5 py-4 dark:bg-white/[0.03]">
                  <dt className="text-muted text-xs font-medium tracking-wide uppercase">Phone</dt>
                  <dd className="mt-1 text-sm font-medium">
                    <a
                      href={`tel:${supportPhone}`}
                      className="hover:text-accent focus:ring-accent/40 rounded-sm underline-offset-4 hover:underline focus:outline-none focus:ring-2"
                    >
                      {supportPhone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {academy.address?.trim() ? (
                <div className="rounded-2xl bg-black/[0.02] px-5 py-4 dark:bg-white/[0.03]">
                  <dt className="text-muted text-xs font-medium tracking-wide uppercase">Address</dt>
                  <dd className="mt-1 text-sm font-medium whitespace-pre-line">
                    {academy.address.trim()}
                  </dd>
                </div>
              ) : null}
            </dl>

            <AcademyWebsiteCta
              title="Ready to book training?"
              description={`Browse available sessions and book online with ${academy.name}.`}
              bookHref={paths.book}
              parentLoginHref={paths.parentLogin}
            />
          </section>

          <section
            className="rounded-3xl bg-black/[0.02] p-5 sm:p-8 dark:bg-white/[0.03]"
            aria-label="General enquiry form"
          >
            <AcademyContactForm academySlug={academySlug} />
          </section>
        </div>
      </div>

      <div className="sticky bottom-3 z-30 px-4 pb-3 lg:hidden">
        <Link
          href={paths.book}
          className="bg-accent text-accent-foreground focus:ring-accent/40 shadow-lg inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          Book Training
        </Link>
      </div>
    </div>
  );
}
