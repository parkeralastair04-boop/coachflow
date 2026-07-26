import Link from "next/link";

export default function AcademyNotFound() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-16 text-center sm:px-6">
        <p className="text-muted text-sm font-medium tracking-wide uppercase">Academy website</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Academy not found</h1>
        <p className="text-muted mt-4 text-sm leading-relaxed">
          We could not find an academy website for this address. Check the link and try again.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="bg-foreground text-background hover:opacity-90 focus:ring-accent/40 inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold transition-opacity focus:outline-none focus:ring-2 focus:ring-offset-2"
          >
            Return Home
          </Link>
        </div>
      </main>
    </div>
  );
}
