import Link from "next/link";

/** Persistent demo notice on the public Riverside United website. */
export function DemoAcademyWebsiteBanner() {
  return (
    <div
      className="border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-50 border-b px-4 py-2.5 text-center text-sm"
      role="status"
    >
      <strong className="font-semibold">Demo academy</strong>
      {" — "}
      Sample Riverside United content. Bookings and contact forms are simulated
      (no email or payments).{" "}
      <Link href="/demo" className="font-medium underline underline-offset-2">
        Open product demo
      </Link>
    </div>
  );
}
