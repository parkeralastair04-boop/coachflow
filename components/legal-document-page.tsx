import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { SUPPORT_EMAIL } from "@/lib/help-support";

type LegalSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
};

type LegalDocumentPageProps = {
  title: string;
  intro: string;
  sections: LegalSection[];
};

export function LegalDocumentPage({ title, intro, sections }: LegalDocumentPageProps) {
  return (
    <div className="mesh-gradient flex min-h-full flex-col">
      <header className="px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-3xl">
          <Link href="/" className="inline-flex" aria-label="Awarix home">
            <BrandLogo size="auth" />
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 pb-16 sm:px-6">
        <article className="glass-panel mx-auto max-w-3xl rounded-2xl p-8 sm:p-10">
          <header>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="text-muted mt-4 text-sm leading-relaxed sm:text-base">{intro}</p>
            <p className="text-muted mt-2 text-xs">Last updated: June 2026</p>
          </header>

          <div className="mt-10 space-y-10">
            {sections.map((section) => (
              <section key={section.id} aria-labelledby={section.id}>
                <h2 id={section.id} className="text-xl font-semibold tracking-tight">
                  {section.title}
                </h2>
                <div className="text-muted mt-4 space-y-3 text-sm leading-relaxed sm:text-base">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <footer className="border-border mt-12 border-t pt-8">
            <h2 className="text-lg font-semibold tracking-tight">Contact</h2>
            <p className="text-muted mt-3 text-sm leading-relaxed">
              Questions about these policies? Email{" "}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-foreground focus-visible:ring-accent/50 font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <nav
              className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm"
              aria-label="Legal pages"
            >
              <Link
                href="/privacy"
                className="text-foreground focus-visible:ring-accent/50 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-foreground focus-visible:ring-accent/50 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              >
                Terms of Service
              </Link>
            </nav>
          </footer>
        </article>
      </main>
    </div>
  );
}
